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
// Constants
export const MAX_CATEGORY_GROUPS = 10;

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
  groupId?: string; // Link to CategoryGroup - determines color family
  colorVariant?: number; // 0-N: which variation within the group's color family
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
