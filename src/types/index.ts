// Transaction Types
export interface Transaction {
  id: string; // UUID
  accountNumber: string; // "Kliendi konto"
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
}

// Category Rule Types
export interface Pattern {
  field: 'payee' | 'description';
  matchType: 'wordlist' | 'regex';
  // For wordlist mode
  words?: Array<{text: string, negated: boolean}>; // [{text: "MCDONALDS", negated: false}, {text: "LIDL", negated: true}]
  caseSensitive?: boolean;
  // For regex mode
  regex?: string; // Raw regex string (stored, not RegExp object)
  regexFlags?: string; // "i", "gi", etc.
  // Common
  weight: number; // Specificity weight
}

export interface CategoryRule {
  id: string;
  name: string; // e.g., "Groceries", "Transportation"
  patterns: Pattern[]; // Multiple matching patterns
  patternLogic: 'OR' | 'AND'; // How patterns are combined: OR = any match, AND = all match
  priority: number; // For handling conflicts (higher = more specific)
  type: 'income' | 'expense';
  isDefault: boolean; // Track if it was a default rule (for UI hints)
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

// User Settings Types
export interface UserSettings {
  id: string;
  defaultCurrency: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
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

export interface MonthlySummary {
  month: string; // YYYY-MM
  categories: Record<string, number>;
  total: number;
}

export interface BalancePoint {
  date: Date;
  balance: number;
}
