import type {CategoryGroup} from "../types";
import {DEFAULT_GROUP_COLORS} from "../utils/colorUtils.ts";
import {UNCATEGORIZED_GROUP_ID} from "../constants.ts";
import {
    GROUP_ID_CRITICAL,
    GROUP_ID_IMPORTANT,
    GROUP_ID_INCOME,
    GROUP_ID_OPTIONAL,
    GROUP_ID_SAVINGS
} from "./seedData.ts";

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