import { v4 as uuidv4 } from 'uuid';
import type { CategoryRule } from '../types';
import { db } from './db';

/**
 * Default category rules to be initialized on first app launch
 * These rules provide automatic categorization for common transaction patterns
 */
export const defaultRules: CategoryRule[] = [
  {
    id: uuidv4(),
    name: 'Groceries',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['NOVUS', 'SILPO', 'SELVER', 'RIMI', 'PRISMA'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 1,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Fast Food',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['MCDONALDS', 'KFC', 'BURGER KING', 'SUBWAY'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['MCDONALDS 133', 'MCDONALDS 48'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 15, // More specific
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Restaurants & Cafes',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['RESTAURANT', 'CAFE', 'KOHVIK', 'RESTORAN', 'KAFEANOR'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 8,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['3bRepublic', '3B CAFE', 'PESTO CAFE', 'DUMKA', 'Puzata Khata'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 12,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Transportation - Fuel',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['AZS', 'WOG', 'ALEXELA', 'CIRCLE K', 'NESTE'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'regex',
        regex: '\\bAZS\\s+\\d+|WOG\\s+\\d+|fuel|bensin|disel|diesel|bensiin',
        regexFlags: 'i',
        weight: 12,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Transportation - Public Transit',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['METROPOLITEN', 'METRO', 'BUS', 'TRAM'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['KYIVSKYI METROPOLITEN'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 15,
      },
    ],
    patternLogic: 'OR',
    priority: 3, // More specific than general transportation
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Shopping - General',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SHOPPING', 'MALL', 'STORE'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 5,
      },
    ],
    patternLogic: 'OR',
    priority: 1,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Insurance',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SWEDBANK P&C INSURANCE', 'INSURANCE', 'KINDLUSTUS'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Utilities - Phone & Internet',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['TELE2', 'ELISA', 'TELIA', 'KYIVSTAR', 'VODAFONE', 'T-MOBILE'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Utilities - Municipal',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['TALLINNA LINNAKANTSELEI', 'CITY OF TALLINN'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Housing',
    patterns: [
      {
        field: 'payee',
        matchType: 'regex',
        regex: 'MUSTAMÄE TEE.*KÜ|apartment|rent|üür',
        regexFlags: 'i',
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Personal Care',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['BARBER', 'SALON', 'SPA', 'JUUKSUR', 'MANIKÜÜR', 'PEDIKÜÜR'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 8,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['SlipiyBarber'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 12,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Investments - Savings',
    patterns: [
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['Rahakogujasse', 'Kasvukontole', 'save'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'regex',
        regex: 'Fondi.*investeerimine|Mikroinvesteerimine|SWEDBANK ROBUR',
        regexFlags: 'i',
        weight: 12,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Loans & Credit',
    patterns: [
      {
        field: 'description',
        matchType: 'regex',
        regex: 'Laenu põhiosa|loan|intress',
        regexFlags: 'i',
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Pension Contributions',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['PENSIONIKESKUS', 'PENSION'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Salary & Income',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SOTSIAALKINDLUSTUSAMET', 'XYB LIMITED'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 15,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['salary', 'wage', 'palk', 'hüvitamine'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 3,
    type: 'income',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: uuidv4(),
    name: 'Refunds',
    patterns: [
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['Refund', 'tagastus', 'return'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      // Note: 'type' field cannot be used for pattern matching
      // This pattern has been removed as it's not valid per the Pattern interface
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'income',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Initialize default category rules in the database
 * Only inserts rules if none exist yet (first-time setup)
 *
 * @returns Promise with status message
 */
export async function initializeDefaultRules(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Check if any rules already exist
    const existingRulesCount = await db.categoryRules.count();

    if (existingRulesCount > 0) {
      return {
        success: true,
        message: `Rules already initialized. Found ${existingRulesCount} existing rules.`,
      };
    }

    // Insert all default rules
    await db.categoryRules.bulkAdd(defaultRules);

    return {
      success: true,
      message: `Successfully initialized ${defaultRules.length} default category rules.`,
    };
  } catch (error) {
    console.error('Failed to initialize default rules:', error);
    return {
      success: false,
      message: `Failed to initialize default rules: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
