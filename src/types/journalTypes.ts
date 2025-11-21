// Journal Entry and Split Types
export type JournalEntryStatus = 'pending' | 'cleared' | 'reconciled';

export interface Split {
    id: string;
    journalEntryId: string;

    accountId: string; // Which account is affected

    // Amount in account's currency (positive = debit, negative = credit)
    amount: number;
    currency: string;

    // Multi-currency: original amount if different from account currency
    foreignAmount?: number;
    foreignCurrency?: string;
    exchangeRate?: number;

    // Categorization (for expense/income accounts)
    category?: string; // From CategoryRule
    categoryConfidence?: number;

    // Reconciliation
    reconciled: boolean;
    reconciledDate?: Date;

    memo?: string; // Split-specific note
}

export interface JournalEntry {
    id: string;
    date: Date;
    description: string;

    // Import tracking
    importId?: string; // Link to ImportRecord
    archiveId?: string; // Original archiveId for deduplication

    // Multi-split support
    splits: Split[];

    // Status
    status: JournalEntryStatus;

    // Original transaction data (for reference)
    originalPayee?: string;
    originalDescription?: string;
    originalTransactionType?: string;

    // Metadata
    notes?: string;
    tags?: string[];
    manuallyEdited: boolean;

    createdAt: Date;
    updatedAt: Date;
}