// Transaction Types
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

// Category Rule Types
// Constants
export const MAX_CATEGORY_GROUPS = 10;

// Re-export constants for backward compatibility
export {UNCATEGORIZED_GROUP_ID} from '../constants';

// Category Group Types
export interface CategoryGroup {
    id: string;
    name: string; // e.g., "Critical", "Important", "Optional"
    description: string; // "Core living expenses", "Important but adjustable", etc.
    baseColor: string; // Base HSL color for the family (e.g., "hsl(0, 70%, 50%)")
    priority: number; // 1 = highest priority (most critical), higher numbers = lower priority
    isDefault: boolean; // System-defined groups
    sortOrder: number; // Display order
    createdAt: Date;
    updatedAt: Date;
}

export type PatternWord = { text: string, negated: boolean };

export interface Pattern {
    fields?: string[]; // Array of fields to match against (e.g., ['payee', 'description'])
    matchType: 'wordlist' | 'regex';
    // For wordlist mode
    words?: Array<PatternWord>; // [{text: "MCDONALDS", negated: false}, {text: "LIDL", negated: true}]
    caseSensitive?: boolean;
    // For regex mode
    regex?: string; // Raw regex string (stored, not RegExp object)
    regexFlags?: string; // "i", "gi", etc.
    // Common
    weight: number; // Specificity weight

    // Legacy field for migration (will be removed in future version)
    field?: 'payee' | 'description';
}

export interface CategoryRule {
    id: string;
    name: string; // e.g., "Groceries", "Transportation"
    patterns: Pattern[]; // Multiple matching patterns
    patternLogic: 'OR' | 'AND'; // How patterns are combined: OR = any match, AND = all match
    priority: number; // For handling conflicts (higher = more specific)
    type: 'income' | 'expense';
    groupId?: string; // Link to CategoryGroup - determines color family
    colorVariant?: number; // 0-N: which variation within the group's color family
    isDefault: boolean; // Track if it was a default rule (for UI hints)
    accountId?: string; // Link to Account (for double-entry accounting)
    createdAt: Date;
    updatedAt: Date;
}

// Import History Types
export interface ImportRecord {
    id: string;
    fileName: string;
    importDate: Date;
    transactionCount: number;
    newCount: number;
    duplicateCount: number;
}

// Import Format Types
export type TransactionField =
    | 'accountNumber'
    | 'payeeAccountNumber'
    | 'date'
    | 'payee'
    | 'description'
    | 'amount'
    | 'currency'
    | 'type'
    | 'transactionType'
    | 'archiveId'
    | 'symbol'
    | 'quantity'
    | 'price'
    | 'fee'
    | 'securityName'
    | 'ignore'; // For columns we want to skip

export interface FieldTransform {
    type: 'date' | 'number' | 'currency' | 'debitCredit' | 'custom';

    // Date transform
    dateFormat?: string; // 'dd.MM.yyyy', 'MM/dd/yyyy', etc.

    // Number transform
    decimalSeparator?: '.' | ',';
    thousandsSeparator?: '.' | ',' | ' ' | '';

    // Debit/Credit transform
    debitValue?: string; // What represents debit (e.g., 'D', '-', 'out')
    creditValue?: string; // What represents credit (e.g., 'K', '+', 'in')

    // Custom transform (JavaScript expression)
    customExpression?: string; // e.g., "value.toUpperCase()"
}

export interface FieldMapping {
    targetField: TransactionField; // What field in our Transaction type
    sourceType: 'column' | 'static'; // Whether to map from column or use static value
    sourceColumn?: string | number; // Column name or index (for 'column' type)
    staticValue?: string; // Static value to use (for 'static' type)
    transform?: FieldTransform; // Optional transformation
    required: boolean;
    defaultValue?: string; // Use if column is missing
}

export interface CSVSettings {
    delimiter: string; // ';', ',', '	'
    hasHeader: boolean;
    encoding: string; // 'utf-8', 'windows-1252', etc.
    skipEmptyLines: boolean;
    skipRows?: number; // Number of rows to skip at start
}

export interface DetectionPattern {
    headerPattern?: string[]; // Match header columns
    sampleRowPattern?: string; // Regex for first data row
    fileNamePattern?: string; // Regex for filename
}

export interface ImportFormatDefinition {
    id: string;
    name: string;
    description?: string;
    fileType: 'csv' | 'xml'; // Start with CSV, XML later

    // CSV-specific settings
    csvSettings?: CSVSettings;

    // Field mappings
    fieldMappings: FieldMapping[];

    // Detection pattern (for auto-detection)
    detectionPattern?: DetectionPattern;

    // Metadata
    isBuiltIn: boolean; // true for Swedbank (non-editable)
    isDefault: boolean; // Use as default if no format detected
    createdAt: Date;
    updatedAt: Date;
}

// Price API Provider Types
export type PriceApiProviderType = 'twelvedata' | 'alphavantage' | 'yahoo';

export interface PriceApiProvider {
    type: PriceApiProviderType;
    apiKey: string;
    enabled: boolean;
    priority: number; // Lower number = higher priority (try first)
}

// Exchange Rate API Provider Types
export type ExchangeRateApiProviderType = 'exchangerate-api' | 'fixer' | 'ecb' | 'openexchangerates';

export interface ExchangeRateApiProvider {
    type: ExchangeRateApiProviderType;
    apiKey?: string; // Optional - some APIs don't need keys (like ECB)
    enabled: boolean;
    priority: number; // Lower number = higher priority (try first)
}

// User Settings Types
export interface UserSettings {
    id: string;
    defaultCurrency: string;
    dateFormat: string;
    theme: 'light' | 'dark' | 'auto';
    // Price API Settings - supports multiple providers
    priceApiProviders?: PriceApiProvider[]; // Multiple providers with priorities
    priceApiAutoRefresh?: boolean;
    priceApiRefreshInterval?: number; // in minutes
    priceApiLastRefresh?: Date;
    // Exchange Rate API Settings - supports multiple providers
    exchangeRateApiProviders?: ExchangeRateApiProvider[]; // Multiple providers with priorities
    exchangeRateAutoRefresh?: boolean;
    exchangeRateRefreshInterval?: number; // in minutes
    exchangeRateLastRefresh?: Date;
    // Legacy fields (deprecated, keep for migration)
    priceApiProvider?: 'twelvedata' | 'alphavantage' | 'yahoo' | 'none';
    priceApiKey?: string;
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

// Chart Data Types
export interface CategorySummary {
    category: string;
    amount: number;
    count: number;
    percentage: number;
}

export interface GroupSummary {
    groupId: string;
    groupName: string;
    baseColor: string;
    priority: number;
    amount: number;
    count: number;
    percentage: number;
    categories: CategorySummary[]; // Drill-down data
}

export interface MonthlySummary {
    month: string; // YYYY-MM
    categories: Record<string, number>;
    total: number;
}

export interface BalancePoint {
    date: Date;
    balance: number;
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

/**
 * Holding represents a security/instrument held in an investment account
 * (stocks, funds, crypto, etc.)
 */
export interface Holding {
    id: string;
    accountId: string; // Link to the account that holds this
    symbol: string; // Ticker symbol or identifier (e.g., "SWED-A", "AAPL", "BTC")
    name?: string; // Full name (e.g., "Swedbank AB Class A")
    type: 'stock' | 'fund' | 'etf' | 'bond' | 'crypto' | 'other';
    quantity: number; // Number of shares/units
    purchasePrice: number; // Average purchase price per unit
    purchaseCurrency: string; // Currency of purchase price
    purchaseDate?: Date; // When acquired
    currentPrice?: number; // Latest fetched price
    currentPriceCurrency?: string; // Currency of current price
    currentPriceDate?: Date; // When the price was last updated
    priceApiProvider?: PriceApiProviderType; // Which provider successfully fetched the price
    notes?: string; // User notes
    createdAt: Date;
    updatedAt: Date;
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