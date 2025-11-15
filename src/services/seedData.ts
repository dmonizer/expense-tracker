import type { CategoryRule, CategoryGroup } from '../types';
import { db } from './db';
import { DEFAULT_GROUP_COLORS } from '../utils/colorUtils';
import { UNCATEGORIZED_GROUP_ID } from '../types';
import { initializeDefaultAccounts } from './accountManager';
import { initializeDefaultExchangeRates } from './exchangeRateManager';

/**
 * Predefined group IDs for default category groups
 */
const GROUP_ID_CRITICAL = 'group-critical';
const GROUP_ID_IMPORTANT = 'group-important';
const GROUP_ID_OPTIONAL = 'group-optional';
const GROUP_ID_SAVINGS = 'group-savings';
const GROUP_ID_INCOME = 'group-income';

/**
 * Default category groups to be initialized on first app launch
 * These groups organize categories by spending priority
 */
export const defaultGroups: CategoryGroup[] = [
  {
    id: GROUP_ID_CRITICAL,
    name: 'Critical',
    description: 'Essential expenses required for basic living (housing, food, utilities)',
    baseColor: DEFAULT_GROUP_COLORS.critical,
    priority: 1, // Highest priority
    isDefault: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: GROUP_ID_IMPORTANT,
    name: 'Important',
    description: 'Necessary expenses that are important but have some flexibility',
    baseColor: DEFAULT_GROUP_COLORS.important,
    priority: 2,
    isDefault: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: GROUP_ID_OPTIONAL,
    name: 'Optional',
    description: 'Discretionary spending that can be reduced or eliminated if needed',
    baseColor: DEFAULT_GROUP_COLORS.optional,
    priority: 3,
    isDefault: true,
    sortOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: GROUP_ID_SAVINGS,
    name: 'Savings & Investment',
    description: 'Money set aside for future, retirement, and investments',
    baseColor: DEFAULT_GROUP_COLORS.savings,
    priority: 4,
    isDefault: true,
    sortOrder: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: GROUP_ID_INCOME,
    name: 'Income',
    description: 'Money received from salary, refunds, and other sources',
    baseColor: DEFAULT_GROUP_COLORS.income,
    priority: 0, // Special priority for income
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: UNCATEGORIZED_GROUP_ID,
    name: 'Unknown expenses',
    description: 'Transactions that have not been categorized yet',
    baseColor: DEFAULT_GROUP_COLORS.uncategorized,
    priority: 999, // Lowest priority (should appear last)
    isDefault: true,
    sortOrder: 999,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Default category rules to be initialized on first app launch
 * These rules provide automatic categorization for common transaction patterns
 */
export const defaultRules: CategoryRule[] = [
  {
    id: 'rule-default-groceries',
    name: 'Groceries',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['NOVUS', 'SILPO', 'SELVER', 'KONSUM',  'GROSSI TOIDUKAUBAD', 'RIMI', 'PRISMA', 'NETOMARKET', 'METSA POOD', 'MAKSIMARKET', 'KONSUM'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 1,
    type: 'expense',
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 0,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-fast-food',
    name: 'Fast Food',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['MCDONALDS', 'KFC', 'BURGER KING', 'SUBWAY', 'HESBURGER'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['MCDONALDS'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 15, // More specific
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 0,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-restaurants',
    name: 'Restaurants & Cafes',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['RESTAURANT', 'CAFE', 'KOHVIK', 'RESTORAN', 'KAFEANOR', 'LAKOMKA', 'KAVA'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 8,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['3bRepublic', 'DUMKA', 'Puzata Khata'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 12,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 1,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-transportation-fuel',
    name: 'Transportation - Fuel',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['AZS', 'WOG', 'ALEXELA', 'HEPA', 'CIRCLE K', 'NESTE', 'OLEREX'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      }
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 0,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-transportation-public-transit',
    name: 'Transportation - Public Transit',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['METROPOLITEN', 'METRO', 'BUS', 'TRAM'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      }
    ],
    patternLogic: 'OR',
    priority: 3, // More specific than general transportation
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 1,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-shopping-general',
    name: 'Shopping - General',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SHOPPING', 'MALL', 'STORE', "MAGAZIIN"].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 5,
      },
    ],
    patternLogic: 'OR',
    priority: 1,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 2,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },  {
    id: 'rule-default-shopping-hobbies',
    name: 'Shopping - Hobbies',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['BOBO', ].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 5,
      },
    ],
    patternLogic: 'OR',
    priority: 1,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 2,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-insurance',
    name: 'Insurance',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SWEDBANK P&C INSURANCE', 'INSURANCE', 'KINDLUSTUS', 'IIZI'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 2,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-utilities-phone-and-internet',
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
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 1,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-utilities-municipal',
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
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 2,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-housing',
    name: 'Housing',
    patterns: [
      {
        field: 'payee',
        matchType: 'regex',
        regex: 'MUSTAMÄE TEE.*KÜ|apartment|rent|üür|korteriühistu',
        regexFlags: 'i',
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 3,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-personal-care',
    name: 'Personal Care',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['BARBER', 'SALON', 'JUUKSUR', 'MANIKÜÜR', 'PEDIKÜÜR'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 8,
      }
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 3,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-investments-savings',
    name: 'Investments - Savings',
    patterns: [
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['Rahakogujasse', 'save'].map(text => ({text, negated: false})),
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
    groupId: GROUP_ID_SAVINGS,
    colorVariant: 0,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-loans-and-credit',
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
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 3,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-pension-contributions',
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
    groupId: GROUP_ID_SAVINGS,
    colorVariant: 1,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-salary-and-income',
    name: 'Salary & Income',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SOTSIAALKINDLUSTUSAMET'].map(text => ({text, negated: false})),
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
    groupId: GROUP_ID_INCOME,
    colorVariant: 0,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-refunds',
    name: 'Refunds',
    patterns: [
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['Refund', 'tagastus', 'return'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'income',
    groupId: GROUP_ID_INCOME,
    colorVariant: 1,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-utilities-electricity',
    name: 'Utilities - Electricity',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['ENEFIT AS', 'ENEFIT', "EESTI ENERGIA"].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 4,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-home-utilities-gas',
    name: 'Home Utilities - Gas',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['PROPAAN'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
      {
        field: 'description',
        matchType: 'wordlist',
        words: ['propane', 'gas'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 8,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 5,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-waste-disposal',
    name: 'Waste Disposal',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['JAATMEJAAM', 'JÄÄTMEJAAM'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_CRITICAL,
    colorVariant: 6,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-car-leasing',
    name: 'Car Leasing',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SWEDBANK LIISING AS', 'LIISING', 'LEASE'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 4,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-home-improvement',
    name: 'Home Improvement',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['BAUHOF', 'HORTES', 'HANDYMANN'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 5,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-healthcare-dental',
    name: 'Healthcare - Dental',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['HANZADENT', 'DENTAL', 'HAMBAARST'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 6,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-pharmacies',
    name: 'Pharmacies',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['APTEEK', 'PHARMACY'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 7,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-government-fees',
    name: 'Government Fees',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['RAHANDUSMINISTEERIUM', 'GOVERNMENT', 'TAX OFFICE', 'MAKSU- JA TOLLIAMET'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 8,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-children-sports-and-activities',
    name: 'Children - Sports & Activities',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['SPORDIKULTUUR', 'SPORTS CLUB', 'LOGOSERV'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_IMPORTANT,
    colorVariant: 9,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-healthcare-spa-and-wellness',
    name: 'Healthcare - Spa & Wellness',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['ELAMUSSPA', 'SPA', 'WELLNESS'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 4,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule-default-shopping-electronics',
    name: 'Shopping - Electronics',
    patterns: [
      {
        field: 'payee',
        matchType: 'wordlist',
        words: ['ARVUTITARK', 'KLICK', 'EURONICS', 'ELECTRONICS', 'TECHNIKA'].map(text => ({text, negated: false})),
        caseSensitive: false,
        weight: 10,
      },
    ],
    patternLogic: 'OR',
    priority: 2,
    type: 'expense',
    groupId: GROUP_ID_OPTIONAL,
    colorVariant: 5,
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
    // Get existing rule IDs
    const existingRules = await db.categoryRules.toArray();
    const existingIds = new Set(existingRules.map(r => r.id));

    // Filter out rules that already exist
    const rulesToAdd = defaultRules.filter(r => !existingIds.has(r.id));

    if (rulesToAdd.length === 0) {
      return {
        success: true,
        message: `Rules already initialized. Found ${existingRules.length} existing rules.`,
      };
    }

    // Insert only new rules
    try {
      await db.categoryRules.bulkAdd(rulesToAdd);
    } catch (bulkError: any) {
      // If ConstraintError, rules were added by another concurrent initialization
      if (bulkError?.name === 'ConstraintError' || bulkError?.failures?.every((f: any) => f?.name === 'ConstraintError')) {
        const currentCount = await db.categoryRules.count();
        return {
          success: true,
          message: `Rules already initialized. Found ${currentCount} existing rules.`,
        };
      }
      throw bulkError;
    }

    return {
      success: true,
      message: `Successfully initialized ${rulesToAdd.length} new category rules. Total: ${existingRules.length + rulesToAdd.length}.`,
    };
  } catch (error) {
    console.error('Failed to initialize default rules:', error);
    return {
      success: false,
      message: `Failed to initialize default rules: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Initialize default category groups in the database
 * Only inserts groups if none exist yet (first-time setup)
 *
 * @returns Promise with status message
 */
export async function initializeDefaultGroups(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get existing group IDs
    const existingGroups = await db.categoryGroups.toArray();
    const existingIds = new Set(existingGroups.map(g => g.id));

    // Filter out groups that already exist
    const groupsToAdd = defaultGroups.filter(g => !existingIds.has(g.id));

    if (groupsToAdd.length === 0) {
      return {
        success: true,
        message: `Groups already initialized. Found ${existingGroups.length} existing groups.`,
      };
    }

    // Insert only new groups
    try {
      await db.categoryGroups.bulkAdd(groupsToAdd);
    } catch (bulkError: any) {
      // If ConstraintError, groups were added by another concurrent initialization
      if (bulkError?.name === 'ConstraintError' || bulkError?.failures?.every((f: any) => f?.name === 'ConstraintError')) {
        const currentCount = await db.categoryGroups.count();
        return {
          success: true,
          message: `Groups already initialized. Found ${currentCount} existing groups.`,
        };
      }
      throw bulkError;
    }

    return {
      success: true,
      message: `Successfully initialized ${groupsToAdd.length} new category groups. Total: ${existingGroups.length + groupsToAdd.length}.`,
    };
  } catch (error) {
    console.error('Failed to initialize default groups:', error);
    return {
      success: false,
      message: `Failed to initialize default groups: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Initialize both default groups and rules
 * This is the main initialization function to call on app startup
 *
 * @returns Promise with combined status message
 */
export async function initializeDefaults(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // First clean up any duplicates
    await cleanupDuplicates();
    
    // Initialize groups
    const groupsResult = await initializeDefaultGroups();
    
    // Initialize rules
    const rulesResult = await initializeDefaultRules();

    // Initialize default accounts (Phase 1: Double-entry accounting)
    await initializeDefaultAccounts();

    // Initialize default exchange rates (Phase 2: Multi-currency)
    await initializeDefaultExchangeRates();

    const success = groupsResult.success && rulesResult.success;
    const message = `${groupsResult.message} ${rulesResult.message}`;

    return {
      success,
      message,
    };
  } catch (error) {
    console.error('Failed to initialize defaults:', error);
    return {
      success: false,
      message: `Failed to initialize defaults: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Clean up duplicate category rules and groups
 * Keeps the default version or earliest created version of each duplicate
 */
async function cleanupDuplicates(): Promise<void> {
  try {
    // Clean up duplicate category rules (by name)
    const allRules = await db.categoryRules.toArray();
    const rulesByName = new Map<string, CategoryRule[]>();
    
    // Group rules by name
    for (const rule of allRules) {
      if (!rulesByName.has(rule.name)) {
        rulesByName.set(rule.name, []);
      }
      rulesByName.get(rule.name)!.push(rule);
    }
    
    // For each duplicate set, keep only one
    for (const [name, rules] of Array.from(rulesByName.entries())) {
      if (rules.length > 1) {
        // Sort: default first, then by creation date
        rules.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        
        // Keep first, delete rest
        const toDelete = rules.slice(1).map(r => r.id);
        await db.categoryRules.bulkDelete(toDelete);
        console.log(`Cleaned up ${toDelete.length} duplicate rules for category: ${name}`);
      }
    }
    
    // Clean up duplicate category groups (by name)
    const allGroups = await db.categoryGroups.toArray();
    const groupsByName = new Map<string, CategoryGroup[]>();
    
    // Group groups by name
    for (const group of allGroups) {
      if (!groupsByName.has(group.name)) {
        groupsByName.set(group.name, []);
      }
      groupsByName.get(group.name)!.push(group);
    }
    
    // For each duplicate set, keep only one
    for (const [name, groups] of Array.from(groupsByName.entries())) {
      if (groups.length > 1) {
        // Sort: default first, then by creation date
        groups.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        
        // Keep first, delete rest
        const toDelete = groups.slice(1).map(g => g.id);
        await db.categoryGroups.bulkDelete(toDelete);
        console.log(`Cleaned up ${toDelete.length} duplicate groups: ${name}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    // Don't throw - initialization should continue even if cleanup fails
  }
}
