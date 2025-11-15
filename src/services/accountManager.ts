import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Account, CategoryRule } from '../types';

/**
 * Account Manager - Handles account creation and management for double-entry accounting
 * Phase 1: Backend setup with dual-write pattern
 */

/**
 * Ensure an expense/income account exists for a category rule
 * This creates the one-to-one mapping between CategoryRule and Account
 */
export async function ensureExpenseAccountForCategory(
  categoryRule: CategoryRule
): Promise<Account> {
  // FIRST: Check if account already exists in database by looking for linked account
  if (categoryRule.accountId) {
    const existingAccount = await db.accounts.get(categoryRule.accountId);
    if (existingAccount) {
      return existingAccount;
    }
  }

  // SECOND: Check if an account with this name already exists
  // This prevents duplicates when categoryRule.accountId is not yet set
  const existingByName = await db.accounts
    .where('name')
    .equals(categoryRule.name)
    .and(account => account.type === (categoryRule.type === 'expense' ? 'expense' : 'income'))
    .first();
  
  if (existingByName) {
    // Link the category rule to this account if not already linked
    if (categoryRule.accountId !== existingByName.id) {
      await db.categoryRules.update(categoryRule.id, { 
        accountId: existingByName.id 
      });
    }
    return existingByName;
  }

  // Get the category group for color information
  let groupColor = 'hsl(0, 0%, 50%)';
  if (categoryRule.groupId) {
    const group = await db.categoryGroups.get(categoryRule.groupId);
    if (group) {
      groupColor = group.baseColor;
    }
  }

  // Create matching expense/income account
  const account: Account = {
    id: uuidv4(),
    name: categoryRule.name,
    type: categoryRule.type === 'expense' ? 'expense' : 'income',
    currency: 'EUR', // Default currency
    supportedCurrencies: ['EUR'], // Can be extended later
    isActive: true,
    isSystem: true, // System account (linked to category)
    categoryRuleId: categoryRule.id,
    groupId: categoryRule.groupId,
    color: groupColor,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.accounts.add(account);

  // Update category rule with account link
  await db.categoryRules.update(categoryRule.id, {
    accountId: account.id,
  });

  return account;
}

/**
 * Get or create a bank account based on account number
 * Used during CSV import to manage user's bank accounts
 */
export async function getOrCreateBankAccount(
  accountNumber: string,
  currency: string = 'EUR',
  institution?: string
): Promise<Account> {
  // Check if account already exists
  const existingAccount = await db.accounts
    .where('accountNumber')
    .equals(accountNumber)
    .first();

  if (existingAccount) {
    return existingAccount;
  }

  // Create new bank account
  const account: Account = {
    id: uuidv4(),
    name: `Bank Account ${accountNumber.substring(0, 8)}...`, // Default name
    type: 'asset',
    subtype: 'checking',
    currency: currency,
    supportedCurrencies: [currency],
    accountNumber: accountNumber,
    institution: institution,
    isActive: true,
    isSystem: false,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    description: 'Auto-created from CSV import',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.accounts.add(account);

  return account;
}

/**
 * Get or create the "Opening Balances" equity account
 * Used for initial balances when setting up accounts
 */
export async function getOpeningBalancesAccount(): Promise<Account> {
  const openingBalancesName = 'Opening Balances';
  
  const existingAccount = await db.accounts
    .where('name')
    .equals(openingBalancesName)
    .first();

  if (existingAccount) {
    return existingAccount;
  }

  const account: Account = {
    id: uuidv4(),
    name: openingBalancesName,
    type: 'equity',
    currency: 'EUR',
    supportedCurrencies: ['EUR', 'USD', 'GBP'], // Support all currencies
    isActive: true,
    isSystem: true,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    description: 'System account for opening balances',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.accounts.add(account);

  return account;
}

/**
 * Get or create the "Uncategorized Expenses" account
 * Used for transactions that don't match any category rule
 */
export async function getUncategorizedExpenseAccount(): Promise<Account> {
  const uncategorizedName = 'Uncategorized Expenses';
  
  const existingAccount = await db.accounts
    .where('name')
    .equals(uncategorizedName)
    .first();

  if (existingAccount) {
    return existingAccount;
  }

  const account: Account = {
    id: uuidv4(),
    name: uncategorizedName,
    type: 'expense',
    currency: 'EUR',
    supportedCurrencies: ['EUR', 'USD', 'GBP'], // Support all currencies
    isActive: true,
    isSystem: true,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    description: 'Default account for uncategorized expenses',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.accounts.add(account);

  return account;
}

/**
 * Get or create the "Uncategorized Income" account
 * Used for income transactions that don't match any category rule
 */
export async function getUncategorizedIncomeAccount(): Promise<Account> {
  const uncategorizedName = 'Uncategorized Income';
  
  const existingAccount = await db.accounts
    .where('name')
    .equals(uncategorizedName)
    .first();

  if (existingAccount) {
    return existingAccount;
  }

  const account: Account = {
    id: uuidv4(),
    name: uncategorizedName,
    type: 'income',
    currency: 'EUR',
    supportedCurrencies: ['EUR', 'USD', 'GBP'], // Support all currencies
    isActive: true,
    isSystem: true,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    description: 'Default account for uncategorized income',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.accounts.add(account);

  return account;
}

/**
 * Initialize default system accounts on first run
 * Should be called when the app first starts
 */
export async function initializeDefaultAccounts(): Promise<void> {
  // Create system accounts if they don't exist
  await getOpeningBalancesAccount();
  await getUncategorizedExpenseAccount();
  await getUncategorizedIncomeAccount();
}

/**
 * Get account by ID
 */
export async function getAccount(accountId: string): Promise<Account | undefined> {
  return await db.accounts.get(accountId);
}

/**
 * Get all bank accounts (asset type)
 */
export async function getBankAccounts(): Promise<Account[]> {
  return await db.accounts.where('type').equals('asset').toArray();
}

/**
 * Get all expense accounts
 */
export async function getExpenseAccounts(): Promise<Account[]> {
  return await db.accounts.where('type').equals('expense').toArray();
}

/**
 * Get all income accounts
 */
export async function getIncomeAccounts(): Promise<Account[]> {
  return await db.accounts.where('type').equals('income').toArray();
}

/**
 * Update account name (user-friendly naming for bank accounts)
 */
export async function updateAccountName(accountId: string, newName: string): Promise<void> {
  await db.accounts.update(accountId, {
    name: newName,
    updatedAt: new Date(),
  });
}

/**
 * Update account opening balance
 */
export async function updateAccountOpeningBalance(
  accountId: string,
  openingBalance: number,
  openingBalanceDate?: Date
): Promise<void> {
  const updateData: any = {
    openingBalance,
    updatedAt: new Date(),
  };

  if (openingBalanceDate) {
    updateData.openingBalanceDate = openingBalanceDate;
  }

  await db.accounts.update(accountId, updateData);
}
