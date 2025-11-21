import type {CategoryGroup, CategoryRule} from '@/types';
import {db} from './db';
import {initializeDefaultAccounts} from './accountManager';
import {initializeDefaultExchangeRates} from './exchangeRateManager';
import {defaultGroups} from "./defaultGroups.ts";
import {defaultRules} from "./defaultRules.ts";
import {logger} from '@/utils';


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
        } catch (bulkError: unknown) {
            // If ConstraintError, rules were added by another concurrent initialization
            const error = bulkError as { name?: string; failures?: Array<{ name?: string }> };
            if (error?.name === 'ConstraintError' || error?.failures?.every(f => f?.name === 'ConstraintError')) {
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
        logger.error('Failed to initialize default rules:', error);
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
        } catch (bulkError: unknown) {
            // If ConstraintError, groups were added by another concurrent initialization
            const error = bulkError as { name?: string; failures?: Array<{ name?: string }> };
            if (error?.name === 'ConstraintError' || error?.failures?.every(f => f?.name === 'ConstraintError')) {
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
        logger.error('Failed to initialize default groups:', error);
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
        logger.info("Initializing default category groups...");
        const groupsResult = await initializeDefaultGroups();

        // Initialize rules
        logger.info("Initializing default category rules...");
        const rulesResult = await initializeDefaultRules();

        // Initialize default accounts (Phase 1: Double-entry accounting)
        await initializeDefaultAccounts();

        // Initialize default exchange rates (Phase 2: Multi-currency)
        await initializeDefaultExchangeRates();

        const success = groupsResult.success && rulesResult.success;
        const message = `${groupsResult.message} ${rulesResult.message}`.trim();

        return {
            success,
            message,
        };
    } catch (error) {
        logger.error('Failed to initialize defaults:', error);
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
                logger.info(`Cleaned up ${toDelete.length} duplicate rules for category: ${name}`);
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
                logger.info(`Cleaned up ${toDelete.length} duplicate groups: ${name}`);
            }
        }
    } catch (error) {
        logger.error('Error cleaning up duplicates:', error);
        // Don't throw - initialization should continue even if cleanup fails
    }
}
