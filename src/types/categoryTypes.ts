// Category Rule Types
// Constants



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

    // Amount condition (optional)
    amountCondition?: {
        operator: 'lt' | 'lte' | 'eq' | 'gte' | 'gt'; // less than, less/equal, equal, greater/equal, greater than
        value: number; // amount to compare against
    };

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