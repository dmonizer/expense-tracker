import {v4 as uuidv4} from 'uuid';
import {db} from '../db';
import type {CategoryRule, ImportRecord, Transaction} from '@/types';
import type {ImportResult} from './types';
import {createJournalEntryFromTransaction} from '../journalEntryManager';
import {initializeDefaultAccounts} from '../accountManager';
import {logger} from '@/utils';

/**
 * Imports new transactions into the database
 *
 * - Performs batch insert using bulkAdd for performance
 * - Creates an import history record
 * - Returns import statistics
 */
export async function importTransactions(
    transactions: Transaction[],
    fileName: string,
    totalCount: number,
    duplicateCount: number
): Promise<ImportResult> {
    try {
        // Initialize default accounts if they don't exist
        await initializeDefaultAccounts();

        // Create import record
        const importRecord: ImportRecord = {
            id: uuidv4(),
            fileName: fileName,
            importDate: new Date(),
            transactionCount: totalCount,
            newCount: transactions.length,
            duplicateCount: duplicateCount,
        };

        // Get all category rules once for efficient lookup
        const categoryRules = await db.categoryRules.toArray();
        const categoryRuleMap = new Map<string, CategoryRule>();
        categoryRules.forEach(rule => {
            categoryRuleMap.set(rule.name, rule);
        });

        // Perform batch operations in a transaction for consistency
        // Phase 1: DUAL-WRITE - Create both old Transaction and new JournalEntry
        await db.transaction(
            'rw',
            db.transactions,
            db.importHistory,
            async () => {
                // Bulk insert transactions (OLD FORMAT - backward compatibility)
                if (transactions.length > 0) {
                    await db.transactions.bulkAdd(transactions);
                }

                // Add import history record
                await db.importHistory.add(importRecord);
            }
        );

        // Create journal entries (NEW FORMAT - double-entry accounting)
        // This is done outside the main transaction because createJournalEntryFromTransaction
        // handles its own database operations and transactions
        for (const transaction of transactions) {
            // Find the category rule if transaction is categorized
            const categoryRule = transaction.category
                ? categoryRuleMap.get(transaction.category)
                : undefined;

            // Create journal entry with proper double-entry splits
            await createJournalEntryFromTransaction(transaction, categoryRule);
        }

        return {
            success: true,
            newCount: transactions.length,
            duplicateCount: duplicateCount,
            importRecordId: importRecord.id,
        };
    } catch (error) {
        logger.error('Import error:', error);
        return {
            success: false,
            newCount: 0,
            duplicateCount: 0,
            importRecordId: '',
        };
    }
}
