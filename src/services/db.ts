import Dexie, {type Table} from 'dexie';
import { logger } from '../utils';
import type {
    Transaction,
    CategoryRule,
    CategoryGroup,
    ImportRecord,
    Pattern,
    Account,
    ExchangeRate,
    AccountBalance,
    ImportFormatDefinition, LogDefinition,
} from '../types';
import type {UserSettings} from "@/types/userSettingsTypes.ts";
import type {Holding} from "@/types/holdingTypes.ts";
import type {JournalEntry, Split} from "@/types/journalTypes.ts";

/**
 * Database class extending Dexie for IndexedDB operations
 * Manages transactions, category rules, import history, and user settings
 */
class ExpenseTrackerDatabase extends Dexie {
    // Define tables with their TypeScript types
    transactions!: Table<Transaction>;
    categoryRules!: Table<CategoryRule>;
    categoryGroups!: Table<CategoryGroup>;
    importHistory!: Table<ImportRecord>;
    settings!: Table<UserSettings>;

    // Double-entry accounting tables (Phase 1)
    accounts!: Table<Account>;
    journalEntries!: Table<JournalEntry>;
    splits!: Table<Split>;
    exchangeRates!: Table<ExchangeRate>;
    accountBalances!: Table<AccountBalance>;

    // Investment tracking (Phase 5)
    holdings!: Table<Holding>;

    // Import format definitions
    importFormats!: Table<ImportFormatDefinition>;

    log!: Table<LogDefinition>

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

        // Version 5: Add categoryGroups table and groupId/colorVariant to categoryRules
        this.version(5).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
        }).upgrade(tx => {
            // Migration: Add groupId and colorVariant to existing rules
            // They will remain undefined until user assigns groups
            return tx.table('categoryRules').toCollection().modify(rule => {
                if (!rule.groupId) {
                    rule.groupId = undefined;
                }
                if (rule.colorVariant === undefined) {
                    rule.colorVariant = 0;
                }
            });
        });

        // Version 6: Add double-entry accounting tables (Phase 1: Backend setup)
        this.version(6).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            // New double-entry accounting tables
            accounts: 'id, type, currency, isActive, categoryRuleId',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date',
            accountBalances: '[accountId+currency+date], accountId',
        }).upgrade(async (tx) => {
            // Migration: Add accountId field to existing category rules (will be populated later)
            await tx.table('categoryRules').toCollection().modify(rule => {
                if (!rule.accountId) {
                    rule.accountId = undefined;
                }
            });
        });

        // Version 7: Fix indexes on accounts table (add name and accountNumber)
        this.version(7).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            // Double-entry accounting tables with corrected indexes
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date',
            accountBalances: '[accountId+currency+date], accountId',
        });

        // Version 8: Add holdings table for investment tracking
        this.version(8).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date',
            accountBalances: '[accountId+currency+date], accountId',
            // Investment tracking
            holdings: 'id, accountId, symbol, type',
        });

        // Version 9: Multiple API providers support + holding provider tracking
        this.version(9).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date',
            accountBalances: '[accountId+currency+date], accountId',
            // Investment tracking - add priceApiProvider index
            holdings: 'id, accountId, symbol, type, priceApiProvider',
        }).upgrade(async (tx) => {
            // Migrate legacy single provider to new multi-provider format
            const settings = await tx.table('settings').get('default');
            if (settings?.priceApiProvider && settings.priceApiProvider !== 'none') {
                // Convert legacy single provider to array format
                const providers = [{
                    type: settings.priceApiProvider,
                    apiKey: settings.priceApiKey || '',
                    enabled: true,
                    priority: 1,
                }];

                await tx.table('settings').update('default', {
                    priceApiProviders: providers,
                });

                logger.info('[Migration v9] Converted legacy API provider to multi-provider format');
            }
        });

        // Version 10: Multiple exchange rate API providers support
        this.version(10).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            // Add apiProvider index to exchange rates
            exchangeRates: 'id, [fromCurrency+toCurrency], date, apiProvider',
            accountBalances: '[accountId+currency+date], accountId',
            holdings: 'id, accountId, symbol, type, priceApiProvider',
        });

        // Version 11: Add import format definitions table
        this.version(11).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date, apiProvider',
            accountBalances: '[accountId+currency+date], accountId',
            holdings: 'id, accountId, symbol, type, priceApiProvider',
            // Import format definitions
            importFormats: 'id, name, isDefault, isBuiltIn, createdAt',
        });

        this.version(12).stores({
            transactions: 'id, date, category, archiveId',
            categoryRules: 'id, priority, type, name, groupId',
            categoryGroups: 'id, priority, sortOrder',
            importHistory: 'id, importDate',
            settings: 'id',
            accounts: 'id, name, type, currency, isActive, categoryRuleId, accountNumber',
            journalEntries: 'id, date, status, importId, archiveId',
            splits: 'id, journalEntryId, accountId, category',
            exchangeRates: 'id, [fromCurrency+toCurrency], date, apiProvider',
            accountBalances: '[accountId+currency+date], accountId',
            holdings: 'id, accountId, symbol, type, priceApiProvider',
            // Import format definitions
            importFormats: 'id, name, isDefault, isBuiltIn, createdAt',
            log: 'id, level, message, timestamp, source, data, error, stack, meta, context'
        });
    }
}

// Export a singleton instance of the database
export const db = new ExpenseTrackerDatabase();

// Export the database class for testing or advanced usage
export type {ExpenseTrackerDatabase};
