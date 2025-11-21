import type {Pattern} from '@/types';
import {logger} from '@/utils';
import {db} from '@/services/db';

/**
 * Checks if a pattern needs migration (has old 'field' property instead of 'fields')
 */
export function needsMigration(pattern: Pattern): boolean {
  return pattern.field !== undefined && !pattern.fields;
}

/**
 * Migrates a pattern from V1 (single field) to V2 (multiple fields)
 */
export function migratePattern(pattern: Pattern): Pattern {
  if (!needsMigration(pattern)) {
    return pattern;
  }

  const { field, ...rest } = pattern;
  return {
    ...rest,
    fields: field ? [field] : ['payee'], // Default to payee if field is undefined
  };
}

/**
 * Migrates all patterns in all category rules from V1 to V2
 * This should be called once on app initialization
 */
export async function migrateAllPatterns(): Promise<{
  migrated: number;
  total: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let migrated = 0;
  let total = 0;

  try {
    const rules = await db.categoryRules.toArray();
    total = rules.length;

    for (const rule of rules) {
      try {
        let needsUpdate = false;
        const migratedPatterns = rule.patterns.map(pattern => {
          if (needsMigration(pattern)) {
            needsUpdate = true;
            return migratePattern(pattern);
          }
          return pattern;
        });

        if (needsUpdate) {
          await db.categoryRules.update(rule.id, {
            patterns: migratedPatterns,
            updatedAt: new Date(),
          });
          migrated++;
        }
      } catch (error) {
        const errorMsg = `Failed to migrate rule ${rule.id} (${rule.name}): ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info(`Pattern migration complete: ${migrated}/${total} rules migrated`);
    return { migrated, total, errors };
  } catch (error) {
    const errorMsg = `Failed to migrate patterns: ${error}`;
    logger.error(errorMsg);
    errors.push(errorMsg);
    return { migrated, total, errors };
  }
}

/**
 * Validates that all patterns have been migrated
 */
export async function validateMigration(): Promise<{
  valid: boolean;
  unmigrated: string[];
}> {
  const unmigrated: string[] = [];

  try {
    const rules = await db.categoryRules.toArray();

    for (const rule of rules) {
      const hasUnmigratedPatterns = rule.patterns.some(needsMigration);
      if (hasUnmigratedPatterns) {
        unmigrated.push(rule.name);
      }
    }

    return {
      valid: unmigrated.length === 0,
      unmigrated,
    };
  } catch (error) {
    logger.error('Failed to validate migration:', error);
    return {
      valid: false,
      unmigrated: ['Error during validation'],
    };
  }
}
