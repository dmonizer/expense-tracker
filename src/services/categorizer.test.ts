import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import type {Transaction, CategoryRule, Pattern} from '../types';
import {
    matchesPattern,
    calculateMatchScore,
    categorizeTransaction,
    categorizeBatch,
    recategorizeAll,
    detectPatternConflicts,
} from './categorizer';
import {db} from './db';

describe('categorizer', () => {
    beforeEach(async () => {
        // Clear all tables before each test
        await db.categoryRules.clear();
        await db.transactions.clear();
    });

    afterEach(async () => {
        // Clean up after each test
        await db.categoryRules.clear();
        await db.transactions.clear();
    });

    // Helper function to create a transaction
    const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
        id: 'txn-1',
        date: new Date('2024-01-15'),
        payee: 'McDonald\'s',
        description: 'Fast food purchase',
        amount: -15.50,
        currency: 'USD',
        type: 'debit',
        accountNumber: 'ACC-001',
        transactionType: 'CARD',
        archiveId: 'ARCH-001',
        imported: new Date(),
        manuallyEdited: false,
        ignored: false,
        ...overrides,
    });

    // Helper function to create a pattern
    const createPattern = (overrides: Partial<Pattern> = {}): Pattern => ({
        fields: ['payee'],
        matchType: 'wordlist',
        words: [{text: 'McDonald', negated: false}],
        caseSensitive: false,
        weight: 5,
        ...overrides,
    });

    // Helper function to create a category rule
    const createRule = (overrides: Partial<CategoryRule> = {}): CategoryRule => ({
        id: 'rule-1',
        name: 'Fast Food',
        patterns: [createPattern()],
        patternLogic: 'OR',
        priority: 5,
        type: 'expense',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    describe('matchesPattern', () => {
        describe('field selection', () => {
            it('should match against payee field', () => {
                const transaction = createTransaction({payee: 'Starbucks Coffee'});
                const pattern = createPattern({
                    fields: ['payee'],
                    words: [{text: 'Starbucks', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match against description field', () => {
                const transaction = createTransaction({description: 'Coffee and snacks'});
                const pattern = createPattern({
                    fields: ['description'],
                    words: [{text: 'Coffee', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match against accountNumber field', () => {
                const transaction = createTransaction({accountNumber: 'ACCT-12345'});
                const pattern = createPattern({
                    fields: ['accountNumber'],
                    words: [{text: 'ACCT-12345', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match against transactionType field', () => {
                const transaction = createTransaction({transactionType: 'CARD'});
                const pattern = createPattern({
                    fields: ['transactionType'],
                    words: [{text: 'CARD', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match against currency field', () => {
                const transaction = createTransaction({currency: 'EUR'});
                const pattern = createPattern({
                    fields: ['currency'],
                    words: [{text: 'EUR', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match against archiveId field', () => {
                const transaction = createTransaction({archiveId: 'ARCH-2024-001'});
                const pattern = createPattern({
                    fields: ['archiveId'],
                    words: [{text: 'ARCH-2024', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should use default payee field when fields is empty array', () => {
                const transaction = createTransaction({payee: 'Target Store'});
                const pattern = createPattern({
                    fields: [],
                    words: [{text: 'Target', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });

            it('should default to payee field when both fields and field are undefined', () => {
                const transaction = createTransaction({payee: 'Amazon Store'});
                const pattern = {
                    matchType: 'wordlist' as const,
                    words: [{text: 'Amazon', negated: false}],
                    caseSensitive: false,
                    weight: 5,
                } as Pattern;

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should support legacy single field property', () => {
                const transaction = createTransaction({payee: 'Amazon'});
                const pattern = {
                    field: 'payee' as const,
                    matchType: 'wordlist' as const,
                    words: [{text: 'Amazon', negated: false}],
                    caseSensitive: false,
                    weight: 5,
                };

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match if ANY field matches (OR logic across fields)', () => {
                const transaction = createTransaction({
                    payee: 'Unknown Merchant',
                    description: 'Grocery shopping',
                });
                const pattern = createPattern({
                    fields: ['payee', 'description'],
                    words: [{text: 'Grocery', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle unknown field gracefully', () => {
                const transaction = createTransaction();
                const pattern = createPattern({
                    fields: ['unknownField'],
                    words: [{text: 'test', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });

            it('should handle undefined/null field values with fallback', () => {
                const transaction = createTransaction({
                    payee: undefined as unknown as string,
                    description: null as unknown as string,
                    accountNumber: undefined as unknown as string,
                    currency: undefined as unknown as string,
                    archiveId: null as unknown as string,
                    transactionType: undefined as unknown as string,
                });
                const pattern = createPattern({
                    fields: ['payee', 'description', 'accountNumber', 'currency', 'archiveId', 'transactionType'],
                    words: [{text: 'test', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });
        });

        describe('wordlist matching', () => {
            it('should match case-insensitive by default', () => {
                const transaction = createTransaction({payee: 'McDonald\'s Restaurant'});
                const pattern = createPattern({
                    words: [{text: 'mcdonald', negated: false}],
                    caseSensitive: false,
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match case-sensitive when specified', () => {
                const transaction = createTransaction({payee: 'McDonald\'s Restaurant'});
                const patternMatch = createPattern({
                    words: [{text: 'McDonald', negated: false}],
                    caseSensitive: true,
                });
                const patternNoMatch = createPattern({
                    words: [{text: 'mcdonald', negated: false}],
                    caseSensitive: true,
                });

                expect(matchesPattern(transaction, patternMatch)).toBe(true);
                expect(matchesPattern(transaction, patternNoMatch)).toBe(false);
            });

            it('should match with substring', () => {
                const transaction = createTransaction({payee: 'Starbucks Coffee Shop'});
                const pattern = createPattern({
                    words: [{text: 'Starbucks', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match when at least one positive word matches', () => {
                const transaction = createTransaction({payee: 'Walmart Supercenter'});
                const pattern = createPattern({
                    words: [
                        {text: 'Target', negated: false},
                        {text: 'Walmart', negated: false},
                        {text: 'Costco', negated: false},
                    ],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should not match when no positive words match', () => {
                const transaction = createTransaction({payee: 'Local Shop'});
                const pattern = createPattern({
                    words: [
                        {text: 'Target', negated: false},
                        {text: 'Walmart', negated: false},
                    ],
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });

            it('should match when no positive words are defined (only negated)', () => {
                const transaction = createTransaction({payee: 'Regular Store'});
                const pattern = createPattern({
                    words: [{text: 'Amazon', negated: true}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should not match when negated word is present', () => {
                const transaction = createTransaction({payee: 'Amazon Marketplace'});
                const pattern = createPattern({
                    words: [
                        {text: 'Amazon', negated: false},
                        {text: 'Marketplace', negated: true},
                    ],
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });

            it('should match when positive word matches and negated word absent', () => {
                const transaction = createTransaction({payee: 'Amazon Prime'});
                const pattern = createPattern({
                    words: [
                        {text: 'Amazon', negated: false},
                        {text: 'Marketplace', negated: true},
                    ],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle empty words array', () => {
                const transaction = createTransaction();
                const pattern = createPattern({
                    words: [],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle undefined words array with fallback', () => {
                const transaction = createTransaction({payee: 'Test'});
                const pattern = {
                    ...createPattern(),
                    words: undefined,
                } as Pattern;

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle fuzzy matching with punctuation normalization', () => {
                const transaction = createTransaction({payee: 'Selver AS, selver.ee'});
                const pattern = createPattern({
                    words: [{text: 'Selver AS selver.ee', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle fuzzy matching with whitespace normalization', () => {
                const transaction = createTransaction({payee: 'Store   Name   Inc'});
                const pattern = createPattern({
                    words: [{text: 'Store Name Inc', negated: false}],
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle negated words with case sensitivity', () => {
                const transaction = createTransaction({payee: 'Special OFFER'});
                const patternCaseSensitive = createPattern({
                    words: [{text: 'OFFER', negated: true}],
                    caseSensitive: true,
                });
                const patternCaseInsensitive = createPattern({
                    words: [{text: 'offer', negated: true}],
                    caseSensitive: false,
                });

                expect(matchesPattern(transaction, patternCaseSensitive)).toBe(false);
                expect(matchesPattern(transaction, patternCaseInsensitive)).toBe(false);
            });
        });

        describe('regex matching', () => {
            it('should match with valid regex pattern', () => {
                const transaction = createTransaction({payee: 'Store-123'});
                const pattern = createPattern({
                    matchType: 'regex',
                    regex: 'Store-\\d+',
                    regexFlags: '',
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should not match when regex does not match', () => {
                const transaction = createTransaction({payee: 'Store ABC'});
                const pattern = createPattern({
                    matchType: 'regex',
                    regex: 'Store-\\d+',
                    regexFlags: '',
                });

                expect(matchesPattern(transaction, pattern)).toBe(false);
            });

            it('should support regex flags', () => {
                const transaction = createTransaction({payee: 'starbucks coffee'});
                const pattern = createPattern({
                    matchType: 'regex',
                    regex: 'STARBUCKS',
                    regexFlags: 'i',
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should handle invalid regex gracefully', () => {
                const transaction = createTransaction({payee: 'Test'});
                const pattern = createPattern({
                    matchType: 'regex',
                    regex: '[invalid(regex',
                    regexFlags: '',
                });

                const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
                });
                expect(matchesPattern(transaction, pattern)).toBe(false);
                expect(consoleSpy).toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('should handle empty regex pattern', () => {
                const transaction = createTransaction({payee: 'Test'});
                const pattern = createPattern({
                    matchType: 'regex',
                    regex: '',
                    regexFlags: '',
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });

            it('should match regex against multiple fields', () => {
                const transaction = createTransaction({
                    payee: 'Unknown',
                    description: 'Payment-12345',
                });
                const pattern = createPattern({
                    fields: ['payee', 'description'],
                    matchType: 'regex',
                    regex: 'Payment-\\d+',
                });

                expect(matchesPattern(transaction, pattern)).toBe(true);
            });
        });
    });

    describe('calculateMatchScore', () => {
        describe('OR logic (default)', () => {
            it('should return 0 when no patterns match', () => {
                const transaction = createTransaction({payee: 'Unknown Store'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'Target', negated: false}]}),
                        createPattern({words: [{text: 'Walmart', negated: false}]}),
                    ],
                    priority: 5,
                });

                expect(calculateMatchScore(transaction, rule)).toBe(0);
            });

            it('should sum weights of matching patterns', () => {
                const transaction = createTransaction({payee: 'McDonald\'s Restaurant'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'McDonald', negated: false}], weight: 5}),
                        createPattern({words: [{text: 'Restaurant', negated: false}], weight: 3}),
                    ],
                    priority: 1,
                });

                // (5 + 3) * (1 + 1 * 0.1) = 8 * 1.1 = 8.8
                expect(calculateMatchScore(transaction, rule)).toBe(8.8);
            });

            it('should only count weight once if same pattern matches multiple times', () => {
                const transaction = createTransaction({payee: 'McDonald\'s McDonald\'s'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'McDonald', negated: false}], weight: 5}),
                    ],
                    priority: 1,
                });

                // 5 * (1 + 1 * 0.1) = 5 * 1.1 = 5.5
                expect(calculateMatchScore(transaction, rule)).toBe(5.5);
            });

            it('should apply priority multiplier correctly', () => {
                const transaction = createTransaction({payee: 'Test'});
                const rule = createRule({
                    patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 10})],
                    priority: 5,
                });

                // 10 * (1 + 5 * 0.1) = 10 * 1.5 = 15
                expect(calculateMatchScore(transaction, rule)).toBe(15);
            });

            it('should handle priority 1 correctly', () => {
                const transaction = createTransaction({payee: 'Test'});
                const rule = createRule({
                    patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 10})],
                    priority: 1,
                });

                // 10 * (1 + 1 * 0.1) = 10 * 1.1 = 11
                expect(calculateMatchScore(transaction, rule)).toBe(11);
            });

            it('should handle priority 10 correctly', () => {
                const transaction = createTransaction({payee: 'Test'});
                const rule = createRule({
                    patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 10})],
                    priority: 10,
                });

                // 10 * (1 + 10 * 0.1) = 10 * 2 = 20
                expect(calculateMatchScore(transaction, rule)).toBe(20);
            });
        });

        describe('AND logic', () => {
            it('should return 0 when not all patterns match', () => {
                const transaction = createTransaction({payee: 'McDonald\'s'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'McDonald', negated: false}]}),
                        createPattern({words: [{text: 'Starbucks', negated: false}]}),
                    ],
                    patternLogic: 'AND',
                    priority: 1,
                });

                expect(calculateMatchScore(transaction, rule)).toBe(0);
            });

            it('should return sum of all weights when all patterns match', () => {
                const transaction = createTransaction({payee: 'McDonald\'s Restaurant'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'McDonald', negated: false}], weight: 5}),
                        createPattern({words: [{text: 'Restaurant', negated: false}], weight: 3}),
                    ],
                    patternLogic: 'AND',
                    priority: 1,
                });

                // (5 + 3) * (1 + 1 * 0.1) = 8 * 1.1 = 8.8
                expect(calculateMatchScore(transaction, rule)).toBe(8.8);
            });

            it('should apply priority multiplier in AND mode', () => {
                const transaction = createTransaction({payee: 'McDonald\'s Restaurant'});
                const rule = createRule({
                    patterns: [
                        createPattern({words: [{text: 'McDonald', negated: false}], weight: 5}),
                        createPattern({words: [{text: 'Restaurant', negated: false}], weight: 5}),
                    ],
                    patternLogic: 'AND',
                    priority: 5,
                });

                // (5 + 5) * (1 + 5 * 0.1) = 10 * 1.5 = 15
                expect(calculateMatchScore(transaction, rule)).toBe(15);
            });

            it('should handle single pattern in AND mode', () => {
                const transaction = createTransaction({payee: 'Test'});
                const rule = createRule({
                    patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 10})],
                    patternLogic: 'AND',
                    priority: 1,
                });

                // 10 * (1 + 1 * 0.1) = 10 * 1.1 = 11
                expect(calculateMatchScore(transaction, rule)).toBe(11);
            });

            it('should return 0 for empty patterns array in AND mode', () => {
                const transaction = createTransaction();
                const rule = createRule({
                    patterns: [],
                    patternLogic: 'AND',
                    priority: 1,
                });

                expect(calculateMatchScore(transaction, rule)).toBe(0);
            });
        });
    });

    describe('categorizeTransaction', () => {
        it('should return null when no rules exist', async () => {
            const transaction = createTransaction();
            const result = await categorizeTransaction(transaction);

            expect(result).toBeNull();
        });

        it('should return null when no rules match', async () => {
            const rule = createRule({
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const transaction = createTransaction({payee: 'Grocery Store'});
            const result = await categorizeTransaction(transaction);

            expect(result).toBeNull();
        });

        it('should return category and confidence when rule matches', async () => {
            const rule = createRule({
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}], weight: 10})],
                priority: 5,
            });
            await db.categoryRules.add(rule);

            const transaction = createTransaction({payee: 'McDonald\'s'});
            const result = await categorizeTransaction(transaction);

            expect(result).not.toBeNull();
            expect(result?.category).toBe('Fast Food');
            expect(result?.confidence).toBeGreaterThan(0);
            expect(result?.confidence).toBeLessThanOrEqual(100);
        });

        it('should select rule with highest score when multiple rules match', async () => {
            const rule1 = createRule({
                id: 'rule-1',
                name: 'Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}], weight: 5})],
                priority: 1,
            });
            const rule2 = createRule({
                id: 'rule-2',
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}], weight: 10})],
                priority: 5,
            });
            await db.categoryRules.bulkAdd([rule1, rule2]);

            const transaction = createTransaction({payee: 'McDonald\'s'});
            const result = await categorizeTransaction(transaction);

            expect(result?.category).toBe('Fast Food'); // Higher score due to higher weight and priority
        });

        it('should calculate confidence correctly', async () => {
            const rule = createRule({
                name: 'Test',
                patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 50})],
                priority: 5,
            });
            await db.categoryRules.add(rule);

            const transaction = createTransaction({payee: 'Test'});
            const result = await categorizeTransaction(transaction);

            // Score = 50 * (1 + 5 * 0.1) = 50 * 1.5 = 75
            // Confidence = min(100, (75 / MAX_REASONABLE_SCORE) * 100) = 75
            expect(result?.confidence).toBe(75);
        });

        it('should cap confidence at 100', async () => {
            const rule = createRule({
                name: 'Test',
                patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 100})],
                priority: 10,
            });
            await db.categoryRules.add(rule);

            const transaction = createTransaction({payee: 'Test'});
            const result = await categorizeTransaction(transaction);

            // Score = 100 * (1 + 10 * 0.1) = 100 * 2 = 200
            // Confidence = min(100, (200 / 100) * 100) = 100
            expect(result?.confidence).toBe(100);
        });

        it('should round confidence to integer', async () => {
            const rule = createRule({
                name: 'Test',
                patterns: [createPattern({words: [{text: 'Test', negated: false}], weight: 13})],
                priority: 3,
            });
            await db.categoryRules.add(rule);

            const transaction = createTransaction({payee: 'Test'});
            const result = await categorizeTransaction(transaction);

            // Score = 13 * (1 + 3 * 0.1) = 13 * 1.3 = 16.9
            // Confidence = min(100, (16.9 / 100) * 100) = 16.9, rounded to 17
            expect(result?.confidence).toBe(17);
        });
    });

    describe('categorizeBatch', () => {
        it('should clear categories and set manuallyEdited to false when no rules exist', async () => {
            const transactions = [
                createTransaction({id: 'txn-1', category: 'Old Category', manuallyEdited: true}),
                createTransaction({id: 'txn-2'}),
            ];
            const result = await categorizeBatch(transactions);

            expect(result).toHaveLength(2);
            expect(result[0].category).toBeUndefined();
            expect(result[0].categoryConfidence).toBeUndefined();
            expect(result[0].manuallyEdited).toBe(false);
            expect(result[1].category).toBeUndefined();
            expect(result[1].manuallyEdited).toBe(false);
        });

        it('should return empty array for empty input', async () => {
            const result = await categorizeBatch([]);

            expect(result).toEqual([]);
        });

        it('should categorize all matching transactions', async () => {
            const rule = createRule({
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}], weight: 10})],
                priority: 5,
            });
            await db.categoryRules.add(rule);

            const transactions = [
                createTransaction({id: 'txn-1', payee: 'McDonald\'s'}),
                createTransaction({id: 'txn-2', payee: 'McDonald\'s Restaurant'}),
            ];
            const result = await categorizeBatch(transactions);

            expect(result).toHaveLength(2);
            expect(result[0].category).toBe('Fast Food');
            expect(result[0].categoryConfidence).toBeGreaterThan(0);
            expect(result[0].manuallyEdited).toBe(false);
            expect(result[1].category).toBe('Fast Food');
            expect(result[1].categoryConfidence).toBeGreaterThan(0);
            expect(result[1].manuallyEdited).toBe(false);
        });

        it('should handle mix of matching and non-matching transactions', async () => {
            const rule = createRule({
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const transactions = [
                createTransaction({id: 'txn-1', payee: 'McDonald\'s'}),
                createTransaction({id: 'txn-2', payee: 'Grocery Store'}),
                createTransaction({id: 'txn-3', payee: 'McDonald\'s'}),
            ];
            const result = await categorizeBatch(transactions);

            expect(result).toHaveLength(3);
            expect(result[0].category).toBe('Fast Food');
            expect(result[1].category).toBeUndefined();
            expect(result[1].categoryConfidence).toBeUndefined();
            expect(result[2].category).toBe('Fast Food');
        });

        it('should select highest scoring rule for each transaction', async () => {
            const rule1 = createRule({
                id: 'rule-1',
                name: 'Food',
                patterns: [createPattern({words: [{text: 'Store', negated: false}], weight: 5})],
                priority: 1,
            });
            const rule2 = createRule({
                id: 'rule-2',
                name: 'Grocery',
                patterns: [createPattern({words: [{text: 'Grocery', negated: false}], weight: 10})],
                priority: 5,
            });
            await db.categoryRules.bulkAdd([rule1, rule2]);

            const transactions = [
                createTransaction({id: 'txn-1', payee: 'Grocery Store'}),
            ];
            const result = await categorizeBatch(transactions);

            expect(result[0].category).toBe('Grocery'); // Higher score
        });

        it('should set manuallyEdited to false for all categorized transactions', async () => {
            const rule = createRule({
                name: 'Test',
                patterns: [createPattern({words: [{text: 'Test', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const transactions = [
                createTransaction({payee: 'Test Store', manuallyEdited: true}),
            ];
            const result = await categorizeBatch(transactions);

            expect(result[0].manuallyEdited).toBe(false);
        });
    });

    describe('recategorizeAll', () => {
        it('should return 0 when no transactions need recategorization', async () => {
            const result = await recategorizeAll();

            expect(result).toBe(0);
        });

        it('should recategorize all non-manually-edited transactions', async () => {
            const rule = createRule({
                name: 'Fast Food',
                patterns: [createPattern({words: [{text: 'McDonald', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const txn1 = createTransaction({id: 'txn-1', payee: 'McDonald\'s', manuallyEdited: false});
            const txn2 = createTransaction({id: 'txn-2', payee: 'McDonald\'s', manuallyEdited: false});
            await db.transactions.bulkAdd([txn1, txn2]);

            const result = await recategorizeAll();

            expect(result).toBe(2);

            const updated1 = await db.transactions.get('txn-1');
            const updated2 = await db.transactions.get('txn-2');
            expect(updated1?.category).toBe('Fast Food');
            expect(updated1?.manuallyEdited).toBe(false);
            expect(updated2?.category).toBe('Fast Food');
            expect(updated2?.manuallyEdited).toBe(false);
        });

        it('should not update manually edited transactions', async () => {
            const txn = createTransaction({id: 'txn-1', payee: 'Test', manuallyEdited: true, category: 'Manual'});
            await db.transactions.add(txn);

            const result = await recategorizeAll();

            expect(result).toBe(0);
            const updated = await db.transactions.get('txn-1');
            expect(updated?.category).toBe('Manual');
        });

        it('should update transactions with new categories', async () => {
            const rule = createRule({
                name: 'Coffee',
                patterns: [createPattern({words: [{text: 'Starbucks', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const txn = createTransaction({
                id: 'txn-1',
                payee: 'Starbucks',
                category: 'Old Category',
                manuallyEdited: false
            });
            await db.transactions.add(txn);

            const result = await recategorizeAll();

            expect(result).toBe(1);
            const updated = await db.transactions.get('txn-1');
            expect(updated?.category).toBe('Coffee');
        });

        it('should clear category when no rules match', async () => {
            const txn = createTransaction({
                id: 'txn-1',
                payee: 'Unknown Store',
                category: 'Old Category',
                manuallyEdited: false
            });
            await db.transactions.add(txn);

            const result = await recategorizeAll();

            expect(result).toBe(1);
            const updated = await db.transactions.get('txn-1');
            expect(updated?.category).toBeUndefined();
            expect(updated?.categoryConfidence).toBeUndefined();
        });
    });

    describe('detectPatternConflicts', () => {
        it('should return empty array when no conflicts exist', async () => {
            const rule = createRule({
                name: 'Food',
                patterns: [createPattern({field: 'payee', words: [{text: 'Restaurant', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'McDonald', negated: false}],
            });
            const transaction = createTransaction({payee: 'McDonald\'s'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toEqual([]);
        });

        it('should detect conflicts with same field patterns', async () => {
            const rule = createRule({
                name: 'Food',
                patterns: [createPattern({field: 'payee', words: [{text: 'McDonald', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'McDonald', negated: false}],
            });
            const transaction = createTransaction({payee: 'McDonald\'s'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toContain('Food');
        });

        it('should not detect conflicts with different field patterns', async () => {
            const rule = createRule({
                name: 'Food',
                patterns: [createPattern({field: 'description', words: [{text: 'McDonald', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'McDonald', negated: false}],
            });
            const transaction = createTransaction({payee: 'McDonald\'s', description: 'Something else'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toEqual([]);
        });

        it('should not report target category as conflict', async () => {
            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'McDonald', negated: false}],
            });
            const transaction = createTransaction({payee: 'McDonald\'s'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toEqual([]);
        });

        it('should detect multiple conflicts', async () => {
            const rule1 = createRule({
                id: 'rule-1',
                name: 'Food',
                patterns: [createPattern({field: 'payee', words: [{text: 'Fast', negated: false}]})],
            });
            const rule2 = createRule({
                id: 'rule-2',
                name: 'Restaurants',
                patterns: [createPattern({field: 'payee', words: [{text: 'Food', negated: false}]})],
            });
            await db.categoryRules.bulkAdd([rule1, rule2]);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'Fast Food', negated: false}],
            });
            const transaction = createTransaction({payee: 'Fast Food Place'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toContain('Food');
            expect(result).toContain('Restaurants');
            expect(result).toHaveLength(2);
        });

        it('should only add each conflicting category once', async () => {
            const rule = createRule({
                name: 'Food',
                patterns: [
                    createPattern({field: 'payee', words: [{text: 'Fast', negated: false}]}),
                    createPattern({field: 'payee', words: [{text: 'Food', negated: false}]}),
                ],
            });
            await db.categoryRules.add(rule);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'Fast Food', negated: false}],
            });
            const transaction = createTransaction({payee: 'Fast Food Place'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toEqual(['Food']);
        });

        it('should not detect conflict when existing pattern does not match transaction', async () => {
            const rule = createRule({
                name: 'Food',
                patterns: [createPattern({field: 'payee', words: [{text: 'Starbucks', negated: false}]})],
            });
            await db.categoryRules.add(rule);

            const newPattern = createPattern({
                field: 'payee',
                words: [{text: 'McDonald', negated: false}],
            });
            const transaction = createTransaction({payee: 'McDonald\'s'});

            const result = await detectPatternConflicts(newPattern, 'Fast Food', transaction);

            expect(result).toEqual([]);
        });
    });
});
