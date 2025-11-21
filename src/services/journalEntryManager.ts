import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Transaction, Account, CategoryRule } from '../types';
import { logger } from '../utils';
import {
  ensureExpenseAccountForCategory,
  getOrCreateBankAccount,
  getUncategorizedExpenseAccount,
  getUncategorizedIncomeAccount,
} from './accountManager';
import type {JournalEntry, Split} from "@/types/journalTypes.ts";

/**
 * Journal Entry Manager - Handles creation of journal entries in double-entry format
 * Phase 1: Dual-write pattern - creates both Transaction and JournalEntry
 */

/**
 * Validate that journal entry balances (sum of splits = 0)
 */
function validateJournalEntryBalance(splits: Split[]): boolean {
  const total = splits.reduce((sum, split) => sum + split.amount, 0);
  // Allow for small floating point errors
  return Math.abs(total) < 0.01;
}

/**
 * Create a journal entry from a transaction
 * This implements the dual-write pattern for backward compatibility
 * 
 * In double-entry:
 * - Debit transaction (money OUT): Credit bank account, Debit expense account
 * - Credit transaction (money IN): Debit bank account, Credit income account
 */
export async function createJournalEntryFromTransaction(
  transaction: Transaction,
  categoryRule?: CategoryRule
): Promise<JournalEntry> {
  const journalEntryId = uuidv4();

  // Get or create bank account
  const bankAccount = await getOrCreateBankAccount(
    transaction.accountNumber,
    transaction.currency
  );

  // Multi-currency support: Ensure bank account supports the transaction currency
  if (transaction.currency !== bankAccount.currency) {
    const supportedCurrencies = bankAccount.supportedCurrencies || [bankAccount.currency];
    if (!supportedCurrencies.includes(transaction.currency)) {
      // Add new currency to supported currencies
      await db.accounts.update(bankAccount.id, {
        supportedCurrencies: [...supportedCurrencies, transaction.currency],
        updatedAt: new Date()
      });
      // Update local object to reflect change
      bankAccount.supportedCurrencies = [...supportedCurrencies, transaction.currency];
      logger.info(`Added ${transaction.currency} to supported currencies for account ${bankAccount.name}`);
    }
  }

  // Determine expense/income account
  let expenseIncomeAccount: Account;

  if (categoryRule) {
    // Use the category rule's linked account
    expenseIncomeAccount = await ensureExpenseAccountForCategory(categoryRule);
  } else {
    // Use uncategorized account based on transaction type
    if (transaction.type === 'debit') {
      expenseIncomeAccount = await getUncategorizedExpenseAccount();
    } else {
      expenseIncomeAccount = await getUncategorizedIncomeAccount();
    }
  }

  // Handle currency conversion if needed
  const { getExchangeRate } = await import('./exchangeRateManager');

  // Get exchange rate if currencies don't match
  let bankAccountRate: number | null = null;
  let expenseAccountRate: number | null = null;

  if (transaction.currency !== bankAccount.currency) {
    bankAccountRate = await getExchangeRate(
      transaction.currency,
      bankAccount.currency,
      transaction.date
    );
  }

  if (transaction.currency !== expenseIncomeAccount.currency) {
    expenseAccountRate = await getExchangeRate(
      transaction.currency,
      expenseIncomeAccount.currency,
      transaction.date
    );
  }

  // Create splits based on transaction type
  const splits: Split[] = [];

  if (transaction.type === 'debit') {
    // Money OUT of bank account
    // Credit bank account (negative amount = credit)
    const bankSplit: Split = {
      id: uuidv4(),
      journalEntryId: journalEntryId,
      accountId: bankAccount.id,
      amount: -transaction.amount, // Negative = Credit
      currency: transaction.currency,
      reconciled: false,
      memo: `${transaction.payee} - ${transaction.description}`,
    };

    // Add foreign currency info if needed
    if (bankAccountRate !== null) {
      bankSplit.foreignAmount = -transaction.amount * bankAccountRate;
      bankSplit.foreignCurrency = bankAccount.currency;
      bankSplit.exchangeRate = bankAccountRate;
    }

    splits.push(bankSplit);

    // Debit expense account (positive amount = debit)
    const expenseSplit: Split = {
      id: uuidv4(),
      journalEntryId: journalEntryId,
      accountId: expenseIncomeAccount.id,
      amount: transaction.amount, // Positive = Debit
      currency: transaction.currency,
      category: transaction.category,
      categoryConfidence: transaction.categoryConfidence,
      reconciled: false,
      memo: transaction.description,
    };

    // Add foreign currency info if needed
    if (expenseAccountRate !== null) {
      expenseSplit.foreignAmount = transaction.amount * expenseAccountRate;
      expenseSplit.foreignCurrency = expenseIncomeAccount.currency;
      expenseSplit.exchangeRate = expenseAccountRate;
    }

    splits.push(expenseSplit);
  } else {
    // Money INTO bank account (credit transaction)
    // Debit bank account (positive amount = debit)
    const bankSplit: Split = {
      id: uuidv4(),
      journalEntryId: journalEntryId,
      accountId: bankAccount.id,
      amount: transaction.amount, // Positive = Debit
      currency: transaction.currency,
      reconciled: false,
      memo: `${transaction.payee} - ${transaction.description}`,
    };

    // Add foreign currency info if needed
    if (bankAccountRate !== null) {
      bankSplit.foreignAmount = transaction.amount * bankAccountRate;
      bankSplit.foreignCurrency = bankAccount.currency;
      bankSplit.exchangeRate = bankAccountRate;
    }

    splits.push(bankSplit);

    // Credit income account (negative amount = credit)
    const incomeSplit: Split = {
      id: uuidv4(),
      journalEntryId: journalEntryId,
      accountId: expenseIncomeAccount.id,
      amount: -transaction.amount, // Negative = Credit
      currency: transaction.currency,
      category: transaction.category,
      categoryConfidence: transaction.categoryConfidence,
      reconciled: false,
      memo: transaction.description,
    };

    // Add foreign currency info if needed
    if (expenseAccountRate !== null) {
      incomeSplit.foreignAmount = -transaction.amount * expenseAccountRate;
      incomeSplit.foreignCurrency = expenseIncomeAccount.currency;
      incomeSplit.exchangeRate = expenseAccountRate;
    }

    splits.push(incomeSplit);
  }

  // Validate balance (in original currency)
  if (!validateJournalEntryBalance(splits)) {
    logger.warn('Journal entry does not balance, but continuing (multi-currency)');
  }

  // Create journal entry
  const journalEntry: JournalEntry = {
    id: journalEntryId,
    date: transaction.date,
    description: transaction.description || `${transaction.payee}`,
    archiveId: transaction.archiveId,
    splits: splits,
    status: 'cleared',
    originalPayee: transaction.payee,
    originalDescription: transaction.description,
    originalTransactionType: transaction.transactionType,
    manuallyEdited: transaction.manuallyEdited,
    createdAt: transaction.imported,
    updatedAt: transaction.imported,
  };

  // Store journal entry and splits in a transaction
  await db.transaction('rw', db.journalEntries, db.splits, async () => {
    await db.journalEntries.add(journalEntry);

    // Store splits separately for efficient querying
    for (const split of splits) {
      await db.splits.add(split);
    }
  });

  return journalEntry;
}

/**
 * Create a simple journal entry manually (for future use)
 * This allows creating journal entries without going through the Transaction model
 */
export async function createJournalEntry(
  date: Date,
  description: string,
  splits: Omit<Split, 'id' | 'journalEntryId'>[]
): Promise<JournalEntry> {
  const journalEntryId = uuidv4();

  // Add IDs to splits
  const completeSplits: Split[] = splits.map(split => ({
    ...split,
    id: uuidv4(),
    journalEntryId: journalEntryId,
  }));

  // Validate balance
  if (!validateJournalEntryBalance(completeSplits)) {
    throw new Error('Journal entry does not balance. Sum of debits must equal sum of credits.');
  }

  const journalEntry: JournalEntry = {
    id: journalEntryId,
    date: date,
    description: description,
    splits: completeSplits,
    status: 'pending',
    manuallyEdited: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store journal entry and splits in a transaction
  await db.transaction('rw', db.journalEntries, db.splits, async () => {
    await db.journalEntries.add(journalEntry);

    for (const split of completeSplits) {
      await db.splits.add(split);
    }
  });

  return journalEntry;
}

/**
 * Get journal entry by ID
 */
export async function getJournalEntry(id: string): Promise<JournalEntry | undefined> {
  return await db.journalEntries.get(id);
}

/**
 * Get all splits for a journal entry
 */
export async function getSplitsForJournalEntry(journalEntryId: string): Promise<Split[]> {
  return await db.splits.where('journalEntryId').equals(journalEntryId).toArray();
}

/**
 * Get all splits for an account within a date range
 */
export async function getSplitsForAccount(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Split[]> {
  const query = db.splits.where('accountId').equals(accountId);

  // Note: We'll need to join with journalEntries to filter by date
  // For now, get all splits and filter in memory
  const splits = await query.toArray();

  if (startDate || endDate) {
    const journalEntries = await db.journalEntries
      .where('id')
      .anyOf(splits.map(s => s.journalEntryId))
      .toArray();

    const journalEntryMap = new Map(journalEntries.map(je => [je.id, je]));

    return splits.filter(split => {
      const je = journalEntryMap.get(split.journalEntryId);
      if (!je) return false;

      if (startDate && je.date < startDate) return false;
      return !(endDate && je.date > endDate);


    });
  }

  return splits;
}

/**
 * Calculate account balance up to a specific date
 */
export async function calculateAccountBalance(
  accountId: string,
  upToDate: Date
): Promise<{ balance: number; currency: string; balances: Record<string, number> }> {
  const account = await db.accounts.get(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const splits = await getSplitsForAccount(accountId, undefined, upToDate);

  // Sum all splits by currency
  const balances: Record<string, number> = {};

  // Initialize with 0 for all supported currencies of the account
  // This ensures we return 0 for currencies that have no transactions yet
  if (account.supportedCurrencies) {
    account.supportedCurrencies.forEach(currency => {
      balances[currency] = 0;
    });
  }

  // Always ensure primary currency is present
  if (balances[account.currency] === undefined) {
    balances[account.currency] = 0;
  }

  // Add opening balance to primary currency
  balances[account.currency] += account.openingBalance;

  splits.forEach(split => {
    const currency = split.currency;
    if (balances[currency] === undefined) {
      balances[currency] = 0;
    }
    balances[currency] += split.amount;
  });

  return {
    balance: balances[account.currency], // Keep primary balance for backward compatibility
    currency: account.currency,
    balances: balances, // New multi-currency balances
  };
}

/**
 * Get the display balance for an account.
 * Income and liability accounts show inverted balances for user-friendly display.
 * 
 * In double-entry accounting:
 * - Income accounts have CREDIT balances (negative in our system)
 * - But users expect to see income as positive
 * - Liability accounts also have CREDIT balances (negative = you owe less)
 */
export function getDisplayBalance(balance: number, accountType: string): number {
  // Income and liability accounts: flip the sign for display
  if (accountType === 'income' || accountType === 'liability') {
    return -balance;
  }
  // Assets, expenses, equity: show as-is
  return balance;
}

/**
 * Update journal entry status
 */
export async function updateJournalEntryStatus(
  journalEntryId: string,
  status: 'pending' | 'cleared' | 'reconciled'
): Promise<void> {
  await db.journalEntries.update(journalEntryId, {
    status,
    updatedAt: new Date(),
  });
}

/**
 * Mark a split as reconciled
 */
export async function reconcileSplit(splitId: string): Promise<void> {
  await db.splits.update(splitId, {
    reconciled: true,
    reconciledDate: new Date(),
  });
}
