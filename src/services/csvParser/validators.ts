import type {Transaction} from '@/types';

/**
 * Detect if a transaction is an investment transaction
 */
export function isInvestmentTransaction(transaction: Partial<Transaction>): boolean {
    return transaction.quantity !== undefined ||
        transaction.price !== undefined ||
        transaction.symbol !== undefined;
}

/**
 * Apply smart defaults for investment transactions
 */
export function applyInvestmentDefaults(transaction: Partial<Transaction>): void {
    if (!transaction.currency) transaction.currency = 'EUR';
    if (!transaction.type) transaction.type = 'debit';
    if (!transaction.payee) {
        transaction.payee = transaction.securityName || transaction.symbol || 'Investment';
    }
    if (!transaction.description) {
        const desc = [];
        if (transaction.quantity) desc.push(`${transaction.quantity} units`);
        if (transaction.symbol) desc.push(transaction.symbol);
        transaction.description = desc.length > 0 ? desc.join(' - ') : 'Investment transaction';
    }
}

/**
 * Validate required fields for a transaction
 */
export function validateRequiredFields(transaction: Partial<Transaction>, isInvestment: boolean): void {
    // Common required fields
    if (!transaction.date) throw new Error('Missing date');
    if (transaction.amount === undefined) throw new Error('Missing amount');

    // Investment transactions have relaxed requirements
    if (isInvestment) return;

    // Regular transaction - all fields required
    if (!transaction.currency) throw new Error('Missing currency');
    if (!transaction.type) throw new Error('Missing type');
    if (!transaction.payee) throw new Error('Missing payee');
    if (!transaction.description) throw new Error('Missing description');
}

/**
 * Apply default values for optional fields
 */
export function applyDefaultFields(transaction: Partial<Transaction>, isInvestment: boolean): void {
    if (!transaction.accountNumber) transaction.accountNumber = 'Unknown';
    if (!transaction.transactionType) {
        transaction.transactionType = isInvestment ? 'Investment' : 'Unknown';
    }
    if (!transaction.archiveId) {
        transaction.archiveId = `${transaction.date!.getTime()}-${transaction.amount}`;
    }
}
