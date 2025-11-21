import {db} from '../db';
import type {Transaction} from '@/types';
import type {DuplicateCheckResult} from './types';

/**
 * Creates a composite key for duplicate detection
 * Format: "YYYY-MM-DD_amount_payee"
 */
function createCompositeKey(transaction: Transaction): string {
    const dateStr = transaction.date.toISOString().split('T')[0]; // YYYY-MM-DD
    const amount = transaction.amount.toFixed(2);
    const payee = (transaction.payee || '').toLowerCase().trim();
    return `${dateStr}_${amount}_${payee}`;
}

/**
 * Checks for duplicate transactions in the database
 * Primary method: Compare archiveId
 * Fallback method: Compare date + amount + payee
 */
export async function detectDuplicates(
    transactions: Transaction[]
): Promise<DuplicateCheckResult> {
    const newTransactions: Transaction[] = [];
    const duplicateTransactions: Transaction[] = [];

    // Get all archive IDs from transactions to check
    const archiveIds = transactions
        .map((t) => t.archiveId)
        .filter((id) => id && id.length > 0);

    // Query database for existing transactions with these archive IDs
    const existingByArchiveId = await db.transactions
        .where('archiveId')
        .anyOf(archiveIds)
        .toArray();

    // Create a set of existing archive IDs for quick lookup
    const existingArchiveIds = new Set(
        existingByArchiveId.map((t) => t.archiveId)
    );

    // For fallback duplicate detection, get all transactions
    // within the date range of the input transactions
    const dates = transactions.map((t) => t.date);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const existingInDateRange = await db.transactions
        .where('date')
        .between(minDate, maxDate, true, true)
        .toArray();

    // Create a map for fallback duplicate detection
    const existingByComposite = new Map<string, Transaction>();
    existingInDateRange.forEach((t) => {
        const key = createCompositeKey(t);
        existingByComposite.set(key, t);
    });

    // Check each transaction for duplicates
    transactions.forEach((transaction) => {
        let isDuplicate = false;

        // Primary check: archiveId
        if (transaction.archiveId && existingArchiveIds.has(transaction.archiveId)) {
            isDuplicate = true;
        }

        // Fallback check: date + amount + payee
        if (!isDuplicate) {
            const compositeKey = createCompositeKey(transaction);
            if (existingByComposite.has(compositeKey)) {
                isDuplicate = true;
            }
        }

        if (isDuplicate) {
            duplicateTransactions.push(transaction);
        } else {
            newTransactions.push(transaction);
        }
    });

    return {
        newTransactions,
        duplicateTransactions,
    };
}
