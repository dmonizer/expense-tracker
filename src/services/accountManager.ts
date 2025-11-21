import {v4 as uuidv4, v5 as uuidv5} from 'uuid';
import {db} from './db';
import type {Account, AccountSubtype, CategoryRule} from '@/types';
import {logger} from '@/utils';

/**
 * Account Manager - Handles account creation and management for double-entry accounting
 * Phase 1: Backend setup with dual-write pattern
 */

// Namespace UUID for system accounts (random UUID, used as namespace for v5)
const SYSTEM_ACCOUNT_NAMESPACE = '550e8400-e29b-41d4-a716-446655440000';

// System account names as constants to avoid magic strings
const OPENING_BALANCES_ACCOUNT_NAME = 'Opening Balances';
const UNCATEGORIZED_EXPENSES_ACCOUNT_NAME = 'Uncategorized Expenses';
const UNCATEGORIZED_INCOME_ACCOUNT_NAME = 'Uncategorized Income';

// Default currency and supported currencies for system accounts
const DEFAULT_CURRENCY = 'EUR';
const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;

/**
 * Generate a deterministic UUID for a system account based on its name
 * This prevents race conditions during initialization by ensuring the same account
 * always gets the same ID
 */
function getSystemAccountId(accountName: string): string {
  return uuidv5(accountName, SYSTEM_ACCOUNT_NAMESPACE);
}

/**
 * Helper function to create or get a system account with race condition safety
 * Implements DRY principle by consolidating common logic for system accounts
 */
async function getOrCreateSystemAccount(
  name: string,
  type: 'equity' | 'expense' | 'income',
  description: string
): Promise<Account> {
  const accountId = getSystemAccountId(name);
  
  // First try to get by deterministic ID (faster and more reliable)
  const existingAccount = await db.accounts.get(accountId);
  if (existingAccount) {
    return existingAccount;
  }

  const account: Account = {
    id: accountId,
    name,
    type,
    currency: DEFAULT_CURRENCY,
    supportedCurrencies: [...SUPPORTED_CURRENCIES],
    isActive: true,
    isSystem: true,
    openingBalance: 0,
    openingBalanceDate: new Date(),
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await db.accounts.add(account);
  } catch (error) {
    // If add fails due to duplicate key (race condition), fetch and return existing
    const existing = await db.accounts.get(accountId);
    if (existing) {
      return existing;
    }
    throw error; // Re-throw if it's a different error
  }

  return account;
}

/**
 * Helper function to get the color for a category group
 * Returns default gray color if no group is specified
 */
async function getGroupColor(groupId?: string): Promise<string> {
  const DEFAULT_COLOR = 'hsl(0, 0%, 50%)';
  
  if (!groupId) {
    return DEFAULT_COLOR;
  }

  const group = await db.categoryGroups.get(groupId);
  return group?.baseColor ?? DEFAULT_COLOR;
}

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

  // Get the category group color information
  const groupColor = await getGroupColor(categoryRule.groupId);

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
  return getOrCreateSystemAccount(
    OPENING_BALANCES_ACCOUNT_NAME,
    'equity',
    'System account for opening balances'
  );
}

/**
 * Get or create the "Uncategorized Expenses" account
 * Used for transactions that don't match any category rule
 */
export async function getUncategorizedExpenseAccount(): Promise<Account> {
  return getOrCreateSystemAccount(
    UNCATEGORIZED_EXPENSES_ACCOUNT_NAME,
    'expense',
    'Default account for uncategorized expenses'
  );
}

/**
 * Get or create the "Uncategorized Income" account
 * Used for income transactions that don't match any category rule
 */
export async function getUncategorizedIncomeAccount(): Promise<Account> {
  return getOrCreateSystemAccount(
    UNCATEGORIZED_INCOME_ACCOUNT_NAME,
    'income',
    'Default account for uncategorized income'
  );
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
  return db.accounts.get(accountId);
}

/**
 * Get all bank accounts (asset type)
 */
export async function getBankAccounts(): Promise<Account[]> {
  return db.accounts.where('type').equals('asset').toArray();
}

/**
 * Get all expense accounts
 */
export async function getExpenseAccounts(): Promise<Account[]> {
  return db.accounts.where('type').equals('expense').toArray();
}

/**
 * Get all income accounts
 */
export async function getIncomeAccounts(): Promise<Account[]> {
  return db.accounts.where('type').equals('income').toArray();
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
  const updateData: Partial<Account> = {
    openingBalance,
    updatedAt: new Date(),
  };

  if (openingBalanceDate) {
    updateData.openingBalanceDate = openingBalanceDate;
  }

  await db.accounts.update(accountId, updateData);
}

/**
 * Update account details
 * Allows editing of description, color, institution, subtype, isActive, and accountNumber
 * Has validations to prevent breaking changes
 */
export async function updateAccount(
  accountId: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    institution?: string;
    subtype?: AccountSubtype;
    isActive?: boolean;
    accountNumber?: string;
    supportedCurrencies?: string[];
  }
): Promise<void> {
  // Get the account
  const account = await db.accounts.get(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Check if account has transactions (splits)
  const splitCount = await db.splits.where('accountId').equals(accountId).count();
  const hasTransactions = splitCount > 0;

  // Get holdings if investment account
  const holdings = account.subtype === 'investment' 
    ? await db.holdings.where('accountId').equals(accountId).toArray()
    : [];
  const hasHoldings = holdings.length > 0;

  // Validate: Cannot change accountNumber if it has transactions (warns in UI)
  // We allow it but it's risky
  if (updates.accountNumber !== undefined && updates.accountNumber !== account.accountNumber && hasTransactions) {
    logger.warn(`Changing account number for account with ${splitCount} transactions. This may affect CSV imports.`);
  }

  // Validate: Cannot change subtype away from investment if holdings exist
  if (updates.subtype !== undefined && account.subtype === 'investment' && updates.subtype !== 'investment' && hasHoldings) {
    throw new Error(`Cannot change subtype from investment while account has ${hasHoldings} holdings. Please remove holdings first.`);
  }

  // Validate: System accounts have limited editing (only description, color, isActive)
  if (account.isSystem) {
    const allowedFields: (keyof typeof updates)[] = ['description', 'color', 'isActive'];
    const attemptedFields = Object.keys(updates) as (keyof typeof updates)[];
    const disallowedFields = attemptedFields.filter(field => !allowedFields.includes(field) && updates[field] !== undefined);
    
    if (disallowedFields.length > 0) {
      throw new Error(`System accounts can only edit: description, color, isActive. Attempted to edit: ${disallowedFields.join(', ')}`);
    }
  }

  // Validate: supportedCurrencies must include primary currency
  if (updates.supportedCurrencies !== undefined) {
    if (!updates.supportedCurrencies.includes(account.currency)) {
      throw new Error(`Supported currencies must include the account's primary currency (${account.currency})`);
    }
  }

  // Build update data
  const updateData: Partial<Account> = {
    ...updates,
    updatedAt: new Date(),
  };

  // Apply updates
  await db.accounts.update(accountId, updateData);
}
