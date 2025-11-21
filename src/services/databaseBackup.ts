// Database Backup and Restore Service
// Handles exporting and importing the entire Dexie database

import { db } from './db';
import { logger } from '../utils';
import type { BackupData, BackupMetadata, BackupProvider } from '../types/backupTypes';
import { encryptData, decryptData } from './encryptionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Export the entire database to a JSON string
 * @param options.excludeTables - Array of table names to exclude from export
 */
export async function exportDatabase(options?: { excludeTables?: string[] }): Promise<string> {
    try {
        const excludeTables = options?.excludeTables || [];
        const data: { [tableName: string]: unknown[] } = {};

        // Get all table names from the database
        const tableNames = db.tables.map(table => table.name);
        const tablesToExport = tableNames.filter(name => !excludeTables.includes(name));

        logger.info('[Backup] Exporting database', {
            totalTables: tableNames.length,
            excludedTables: excludeTables,
            exportingTables: tablesToExport,
        });

        // Export each table
        for (const tableName of tablesToExport) {
            const table = db.table(tableName);
            const records = await table.toArray();
            data[tableName] = records;
            logger.info(`[Backup] Exported table: ${tableName}`, { recordCount: records.length });
        }

        const jsonData = JSON.stringify(data, null, 2);
        logger.info('[Backup] Database export completed', {
            size: jsonData.length,
            tables: tablesToExport.length,
        });

        return jsonData;
    } catch (error) {
        logger.error('[Backup] Failed to export database:', error);
        throw new Error('Database export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Import database from JSON string
 * @param jsonData - JSON string containing database data
 * @param options.merge - If true, merge with existing data; if false, replace all data
 * @param options.excludeTables - Array of table names to exclude from import
 */
export async function importDatabase(
    jsonData: string,
    options?: { merge?: boolean; excludeTables?: string[] }
): Promise<void> {
    try {
        const merge = options?.merge || false;
        const excludeTables = options?.excludeTables || [];

        logger.info('[Backup] Importing database', { merge, excludeTables });

        // Parse JSON data
        const data = JSON.parse(jsonData) as { [tableName: string]: unknown[] };

        // If not merging, clear all tables first
        if (!merge) {
            const tableNames = Object.keys(data).filter(name => !excludeTables.includes(name));
            logger.info('[Backup] Clearing existing data', { tables: tableNames });

            for (const tableName of tableNames) {
                const table = db.table(tableName);
                await table.clear();
            }
        }

        // Import data into each table
        for (const [tableName, records] of Object.entries(data)) {
            if (excludeTables.includes(tableName)) {
                logger.info(`[Backup] Skipping table: ${tableName}`);
                continue;
            }

            const table = db.table(tableName);

            if (merge) {
                // In merge mode, use bulkPut which will update existing records
                await table.bulkPut(records);
            } else {
                // In replace mode, use bulkAdd (data should already be cleared)
                await table.bulkAdd(records);
            }

            logger.info(`[Backup] Imported table: ${tableName}`, { recordCount: records.length });
        }

        logger.info('[Backup] Database import completed successfully');
    } catch (error) {
        logger.error('[Backup] Failed to import database:', error);
        throw new Error('Database import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Create a backup with metadata
 */
export async function createBackup(
    provider: BackupProvider,
    options?: {
        encrypt?: boolean;
        encryptionKey?: string;
        includeLogs?: boolean;
    }
): Promise<BackupData> {
    try {
        const encrypt = options?.encrypt || false;
        const includeLogs = options?.includeLogs || false;

        logger.info('[Backup] Creating backup', { provider, encrypt, includeLogs });

        // Determine which tables to exclude
        const excludeTables = includeLogs ? [] : ['log'];

        // Export database
        const jsonData = await exportDatabase({ excludeTables });

        // Get database version
        const databaseVersion = db.verno;

        // Create metadata
        const metadata: BackupMetadata = {
            id: uuidv4(),
            timestamp: new Date(),
            size: jsonData.length,
            encrypted: encrypt,
            provider,
            databaseVersion,
            includedLogs: includeLogs,
            tablesIncluded: db.tables
                .map(t => t.name)
                .filter(name => !excludeTables.includes(name)),
        };

        let finalData = jsonData;

        // Encrypt if requested
        if (encrypt && options?.encryptionKey) {
            logger.info('[Backup] Encrypting backup data');
            const { encrypted, iv, salt } = await encryptData(jsonData, options.encryptionKey);

            // Store encryption info in a wrapper object
            const encryptedWrapper = {
                encrypted,
                iv,
                salt,
                metadata,
            };
            finalData = JSON.stringify(encryptedWrapper);
        }

        const backupData: BackupData = {
            metadata,
            data: encrypt ? { encrypted: [finalData] } : JSON.parse(jsonData),
        };

        logger.info('[Backup] Backup created successfully', {
            id: metadata.id,
            size: finalData.length,
            encrypted: encrypt,
        });

        return backupData;
    } catch (error) {
        logger.error('[Backup] Failed to create backup:', error);
        throw new Error('Backup creation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Restore from backup
 */
export async function restoreBackup(
    backupData: string,
    metadata: BackupMetadata,
    options?: {
        encryptionKey?: string;
        merge?: boolean;
    }
): Promise<void> {
    try {
        logger.info('[Backup] Restoring backup', {
            id: metadata.id,
            encrypted: metadata.encrypted,
            merge: options?.merge,
        });

        let jsonData = backupData;

        // Decrypt if encrypted
        if (metadata.encrypted) {
            if (!options?.encryptionKey) {
                throw new Error('Encryption key required for encrypted backup');
            }

            logger.info('[Backup] Decrypting backup data');
            const encryptedWrapper = JSON.parse(backupData);
            jsonData = await decryptData(
                encryptedWrapper.encrypted,
                encryptedWrapper.iv,
                encryptedWrapper.salt,
                options.encryptionKey
            );
        }

        // Determine which tables to exclude (if logs weren't included in backup, don't try to restore them)
        const excludeTables = metadata.includedLogs ? [] : ['log'];

        // Import database
        await importDatabase(jsonData, {
            merge: options?.merge || false,
            excludeTables,
        });

        logger.info('[Backup] Backup restored successfully');
    } catch (error) {
        logger.error('[Backup] Failed to restore backup:', error);
        throw new Error('Backup restore failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Validate backup data integrity
 */
export async function validateBackup(backupData: string): Promise<boolean> {
    try {
        // Try to parse as JSON
        const parsed = JSON.parse(backupData);

        // Check if it's an encrypted backup
        if (parsed.encrypted && parsed.iv && parsed.salt && parsed.metadata) {
            // Encrypted backup - validate structure
            return (
                typeof parsed.encrypted === 'string' &&
                typeof parsed.iv === 'string' &&
                typeof parsed.salt === 'string' &&
                typeof parsed.metadata === 'object'
            );
        }

        // Regular backup - validate it has table data
        if (typeof parsed === 'object' && parsed !== null) {
            // Check if it looks like database export
            const hasValidStructure = Object.values(parsed).every(
                value => Array.isArray(value)
            );
            return hasValidStructure;
        }

        return false;
    } catch {
        return false;
    }
}
