// Transaction Types
import type {ExchangeRateApiProviderType} from "@/types/apiSettingsTypes.ts";

export interface Transaction {
    id: string; // UUID
    accountNumber: string; // "Kliendi konto"
    payeeAccountNumber?: string; // "Saaja/maksja konto" - Payee/Recipient account number
    date: Date; // "Kuupäev"
    payee: string; // "Saaja/Maksja"
    description: string; // "Selgitus"
    amount: number; // "Summa"
    currency: string; // "Valuuta"
    type: 'debit' | 'credit'; // "Deebet/Kreedit" (D/K)
    category?: string; // Auto or manually assigned
    categoryConfidence?: number; // Match confidence score (0-100)
    manuallyEdited: boolean;
    transactionType: string; // "Tehingu tüüp"
    archiveId: string; // "Arhiveerimistunnus" - for deduplication
    imported: Date; // When imported
    ignored?: boolean; // Exclude from calculations

    // Investment transaction fields (optional)
    symbol?: string; // Security symbol/ISIN (e.g., "SE0014261756")
    quantity?: number; // Number of shares/units purchased/sold
    price?: number; // Price per share/unit
    fee?: number; // Transaction fee/commission
    securityName?: string; // Full name of security
}


// CSV Row Types (for parsing)
export interface SwedBankCSVRow {
    'Kliendi konto': string;
    'Reatüüp': string;
    'Kuupäev': string;
    'Saaja/Maksja': string;
    'Selgitus': string;
    'Summa': string;
    'Valuuta': string;
    'Deebet/Kreedit': string;
    'Arhiveerimistunnus': string;
    'Tehingu tüüp': string;
    'Viitenumber': string;
    'Dokumendi number': string;
}

// Filter Types
export interface TransactionFilters {
    dateFrom?: Date;
    dateTo?: Date;
    categories?: string[];
    groups?: string[]; // Filter by category groups (including UNCATEGORIZED_GROUP_ID)
    currencies?: string[];
    minAmount?: number;
    maxAmount?: number;
    transactionType?: 'income' | 'expense' | 'both';
    searchQuery?: string;
    sortField?: 'date' | 'payee' | 'amount' | 'category' | 'description';
    sortDirection?: 'asc' | 'desc';
}

// ============================================
// Double-Entry Accounting Types (Phase 1)
// ============================================

// Account Types
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type AccountSubtype = 'checking' | 'savings' | 'investment' | 'credit_card' | 'cash' | 'loan' | 'other';

export interface Account {
    id: string;
    name: string; // "Swedbank Main", "Cash Wallet", "Groceries"
    type: AccountType;
    subtype?: AccountSubtype;
    currency: string; // Primary currency
    institution?: string; // "Swedbank", "LHV"
    accountNumber?: string; // Original bank account number

    // Multi-currency support
    supportedCurrencies: string[]; // ["EUR", "USD", "GBP"]

    // Metadata
    isActive: boolean;
    openingBalance: number;
    openingBalanceDate: Date;
    description?: string;
    color?: string; // For UI

    // System accounts (cannot be deleted)
    isSystem: boolean; // true for expense category accounts

    // Link to category system (for expense/income accounts)
    categoryRuleId?: string; // Links to existing CategoryRule
    groupId?: string; // Links to CategoryGroup

    createdAt: Date;
    updatedAt: Date;
}

// Exchange Rate Types
export type ExchangeRateSource = 'manual' | 'api' | 'ecb';

export interface ExchangeRate {
    id: string;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    date: Date;
    source: ExchangeRateSource;
    apiProvider?: ExchangeRateApiProviderType; // Which API provider fetched this rate (if source is 'api')
    createdAt: Date;
}

// Account Balance Types (for caching/performance)
export interface AccountBalance {
    accountId: string;
    currency: string;
    balance: number;
    date: Date; // As of this date
    lastUpdated: Date;
}

export interface LogDefinition {
    id: string,
    level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    timestamp: Date,
    source?: string,
    data: string,
    error?: string,
    stack?: string,
    meta?: string,
    context?: string
}

export * from "./categoryTypes.ts";
export * from "./apiSettingsTypes.ts";
export * from "./chartDataTypes.ts";
export * from "./importFormatTypes.ts";
export * from "./importHistoryTypes.ts";
export * from "./userSettingsTypes.ts";
export * from "./journalTypes.ts";
export * from "./holdingTypes.ts";
