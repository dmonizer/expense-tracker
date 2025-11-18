import { db } from './db';
import { createJournalEntryFromTransaction } from './journalEntryManager';
import { initializeDefaultAccounts } from './accountManager';
import type { CategoryRule } from '../types';
import { logger } from '../utils';

/**
 * Database Cleanup Utilities
 * Use these to fix issues with duplicate accounts or corrupted data
 */

/**
 * Remove ALL duplicate accounts, keeping only the first created one for each name+type combination
 * This fixes the bug where multiple accounts were created for the same category
 */
export async function cleanupDuplicateAccounts(): Promise<{
  totalAccounts: number;
  duplicatesRemoved: number;
  uniqueAccountsKept: number;
}> {
  logger.info('Starting duplicate account cleanup...');
  
  // Get all accounts
  const allAccounts = await db.accounts.toArray();
  const totalAccounts = allAccounts.length;
  
  // Group by name + type (each category should have exactly one account)
  const accountGroups = new Map<string, typeof allAccounts>();
  
  for (const account of allAccounts) {
    const key = `${account.name}|${account.type}`;
    if (!accountGroups.has(key)) {
      accountGroups.set(key, []);
    }
    accountGroups.get(key)!.push(account);
  }
  
  // For each group, keep the oldest account and delete the rest
  let duplicatesRemoved = 0;
  const accountsToKeep = new Set<string>();
  const accountsToDelete: string[] = [];
  
  for (const [, accounts] of accountGroups.entries()) {
    if (accounts.length > 1) {
      // Sort by creation date (oldest first)
      accounts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      // Keep the first one
      const keepAccount = accounts[0];
      accountsToKeep.add(keepAccount.id);
      
      logger.info(`Found ${accounts.length} duplicates for "${accounts[0].name}" (${accounts[0].type})`);
      logger.info(`  Keeping: ${keepAccount.id} (created ${keepAccount.createdAt})`);
      
      // Mark the rest for deletion
      for (let i = 1; i < accounts.length; i++) {
        accountsToDelete.push(accounts[i].id);
        duplicatesRemoved++;
        logger.info(`  Deleting: ${accounts[i].id} (created ${accounts[i].createdAt})`);
      }
      
      // Update any category rules pointing to duplicate accounts to point to the kept account
      for (let i = 1; i < accounts.length; i++) {
        const duplicateAccountId = accounts[i].id;
        await db.categoryRules
          .where('accountId')
          .equals(duplicateAccountId)
          .modify({ accountId: keepAccount.id });
      }
      
      // Update any splits pointing to duplicate accounts to point to the kept account
      for (let i = 1; i < accounts.length; i++) {
        const duplicateAccountId = accounts[i].id;
        await db.splits
          .where('accountId')
          .equals(duplicateAccountId)
          .modify({ accountId: keepAccount.id });
      }
    } else {
      accountsToKeep.add(accounts[0].id);
    }
  }
  
  // Delete duplicate accounts
  if (accountsToDelete.length > 0) {
    await db.accounts.bulkDelete(accountsToDelete);
    logger.info(`Deleted ${accountsToDelete.length} duplicate accounts`);
  }
  
  logger.info('Cleanup complete!');
  logger.info(`  Total accounts before: ${totalAccounts}`);
  logger.info(`  Duplicates removed: ${duplicatesRemoved}`);
  logger.info(`  Unique accounts kept: ${accountsToKeep.size}`);
  
  return {
    totalAccounts,
    duplicatesRemoved,
    uniqueAccountsKept: accountsToKeep.size,
  };
}

/**
 * Clear all accounting data (accounts, journal entries, splits) but keep transactions and categories
 * Use this to start fresh with the double-entry system while keeping your old data
 */
export async function clearAccountingData(): Promise<void> {
  logger.info('Clearing all accounting data...');
  
  // Clear accounting tables in one transaction
  await db.transaction('rw', db.accounts, db.journalEntries, db.splits, db.accountBalances, db.exchangeRates, async () => {
    await db.accounts.clear();
    await db.journalEntries.clear();
    await db.splits.clear();
    await db.accountBalances.clear();
    await db.exchangeRates.clear();
  });
  
  // Clear accountId links from category rules in a separate transaction
  await db.categoryRules.toCollection().modify(rule => {
    rule.accountId = undefined;
  });
  
  logger.info('Accounting data cleared. Transactions and categories are preserved.');
}

/**
 * Get statistics about accounts in the database
 */
export async function getAccountStats(): Promise<{
  totalAccounts: number;
  assetAccounts: number;
  expenseAccounts: number;
  incomeAccounts: number;
  liabilityAccounts: number;
  equityAccounts: number;
  systemAccounts: number;
  accountsWithTransactions: number;
  accountsWithoutTransactions: number;
  potentialDuplicates: Array<{ name: string; type: string; count: number }>;
}> {
  const allAccounts = await db.accounts.toArray();
  
  // Count by type
  const stats = {
    totalAccounts: allAccounts.length,
    assetAccounts: allAccounts.filter(a => a.type === 'asset').length,
    expenseAccounts: allAccounts.filter(a => a.type === 'expense').length,
    incomeAccounts: allAccounts.filter(a => a.type === 'income').length,
    liabilityAccounts: allAccounts.filter(a => a.type === 'liability').length,
    equityAccounts: allAccounts.filter(a => a.type === 'equity').length,
    systemAccounts: allAccounts.filter(a => a.isSystem).length,
    accountsWithTransactions: 0,
    accountsWithoutTransactions: 0,
    potentialDuplicates: [] as Array<{ name: string; type: string; count: number }>,
  };
  
  // Count accounts with/without transactions
  for (const account of allAccounts) {
    const splitCount = await db.splits.where('accountId').equals(account.id).count();
    if (splitCount > 0) {
      stats.accountsWithTransactions++;
    } else {
      stats.accountsWithoutTransactions++;
    }
  }
  
  // Find potential duplicates (multiple accounts with same name+type)
  const nameTypeMap = new Map<string, number>();
  for (const account of allAccounts) {
    const key = `${account.name}|${account.type}`;
    nameTypeMap.set(key, (nameTypeMap.get(key) || 0) + 1);
  }
  
  for (const [key, count] of nameTypeMap.entries()) {
    if (count > 1) {
      const [name, type] = key.split('|');
      stats.potentialDuplicates.push({ name, type, count });
    }
  }
  
  return stats;
}

/**
 * Rebuild all journal entries from existing transactions
 * This will:
 * 1. Clear all accounts, journal entries, and splits
 * 2. Recreate accounts from category rules
 * 3. Recreate journal entries from all existing transactions
 * 
 * Use this to fix categorization issues or rebuild the double-entry system
 */
export async function rebuildAccountingFromTransactions(): Promise<{
  transactionsProcessed: number;
  accountsCreated: number;
  journalEntriesCreated: number;
}> {
  logger.info('Rebuilding accounting data from transactions...');
  
  // Step 1: Clear all accounting data
  logger.info('Step 1: Clearing existing accounting data...');
  await clearAccountingData();
  
  // Step 2: Initialize default accounts
  logger.info('Step 2: Initializing default accounts...');
  await initializeDefaultAccounts();
  
  // Step 3: Get all transactions
  logger.info('Step 3: Loading all transactions...');
  const allTransactions = await db.transactions.toArray();
  logger.info(`Found ${allTransactions.length} transactions to process`);
  
  if (allTransactions.length === 0) {
    return {
      transactionsProcessed: 0,
      accountsCreated: 0,
      journalEntriesCreated: 0,
    };
  }
  
  // Step 4: Get all category rules for lookup
  logger.info('Step 4: Loading category rules...');
  const categoryRules = await db.categoryRules.toArray();
  const categoryRuleMap = new Map<string, CategoryRule>();
  categoryRules.forEach(rule => {
    categoryRuleMap.set(rule.name, rule);
  });
  
  // Step 5: Create journal entries for each transaction
  logger.info('Step 5: Creating journal entries...');
  let journalEntriesCreated = 0;
  
  for (const transaction of allTransactions) {
    try {
      // Find the category rule if transaction is categorized
      const categoryRule = transaction.category 
        ? categoryRuleMap.get(transaction.category)
        : undefined;

      // Create journal entry with proper double-entry splits
      await createJournalEntryFromTransaction(transaction, categoryRule);
      journalEntriesCreated++;
      
      if (journalEntriesCreated % 100 === 0) {
        logger.info(`  Processed ${journalEntriesCreated}/${allTransactions.length} transactions...`);
      }
    } catch (error) {
      logger.error(`Failed to create journal entry for transaction ${transaction.id}:`, error);
      // Continue with other transactions
    }
  }
  
  // Step 6: Count created accounts
  const accountsCreated = await db.accounts.count();
  
  logger.info('Rebuild complete!');
  logger.info(`  Transactions processed: ${allTransactions.length}`);
  logger.info(`  Journal entries created: ${journalEntriesCreated}`);
  logger.info(`  Accounts created: ${accountsCreated}`);
  
  return {
    transactionsProcessed: allTransactions.length,
    accountsCreated,
    journalEntriesCreated,
  };
}
