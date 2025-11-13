import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  CategoryRule,
  ImportRecord,
  UserSettings,
  Pattern,
} from '../types/index';

/**
 * Database class extending Dexie for IndexedDB operations
 * Manages transactions, category rules, import history, and user settings
 */
class ExpenseTrackerDatabase extends Dexie {
  // Define tables with their TypeScript types
  transactions!: Table<Transaction>;
  categoryRules!: Table<CategoryRule>;
  importHistory!: Table<ImportRecord>;
  settings!: Table<UserSettings>;

  constructor() {
    super('ExpenseTrackerDB');

    // Define database schema version 1 (initial schema)
    this.version(1).stores({
      transactions: 'id, date, category, archiveId',
      categoryRules: 'id, priority, type',
      importHistory: 'id, importDate',
      settings: 'id',
    });

    // Version 2: Add name index to categoryRules for sorting
    this.version(2).stores({
      transactions: 'id, date, category, archiveId',
      categoryRules: 'id, priority, type, name',
      importHistory: 'id, importDate',
      settings: 'id',
    });

    // Version 3: Add patternLogic field to categoryRules (OR/AND logic support)
    this.version(3).stores({
      transactions: 'id, date, category, archiveId',
      categoryRules: 'id, priority, type, name',
      importHistory: 'id, importDate',
      settings: 'id',
    }).upgrade(tx => {
      // Migration: Add patternLogic field to all existing rules (default to 'OR')
      return tx.table('categoryRules').toCollection().modify(rule => {
        if (!rule.patternLogic) {
          rule.patternLogic = 'OR';
        }
      });
    });

    // Version 4: Migrate words array from string[] to Array<{text: string, negated: boolean}>
    this.version(4).stores({
      transactions: 'id, date, category, archiveId',
      categoryRules: 'id, priority, type, name',
      importHistory: 'id, importDate',
      settings: 'id',
    }).upgrade(tx => {
      // Migration: Convert words from string[] to {text, negated} objects
      return tx.table('categoryRules').toCollection().modify(rule => {
        if (rule.patterns && Array.isArray(rule.patterns)) {
          rule.patterns = rule.patterns.map((pattern: Pattern) => {
            if (pattern.matchType === 'wordlist' && pattern.words && Array.isArray(pattern.words)) {
              // Check if words are already in new format
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const words = pattern.words as any;
              if (words.length > 0 && typeof words[0] === 'string') {
                // Convert from string[] to {text, negated}[]
                pattern.words = (words as string[]).map((word: string) => ({
                  text: word,
                  negated: false,
                }));
              }
            }
            return pattern;
          });
        }
      });
    });
  }
}

// Export a singleton instance of the database
export const db = new ExpenseTrackerDatabase();

// Export the database class for testing or advanced usage
export type { ExpenseTrackerDatabase };
