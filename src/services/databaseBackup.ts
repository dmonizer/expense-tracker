// Database Backup and Restore Service
// Handles exporting and importing the entire Dexie database

import {db} from './db';
import {logger} from '@/utils';
import type {BackupData, BackupMetadata, BackupProvider, BackupTables} from '../types/backupTypes';
import {decryptData, encryptData} from './encryptionService';
import {v4 as uuidv4} from 'uuid';

// Regex to detect ISO 8601 date strings
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

/**
 * JSON Reviver function to convert date strings back to Date objects
 */
export function dateReviver(_key: string, value: any) {
    if (typeof value === 'string' && isoDateRegex.test(value)) {
        return new Date(value);
    }
    return value;
}

/**
 * Helper to revive dates in an existing object structure (mutates the object)
 * Optimized for BackupTables structure
 */
function reviveBackupTables(tables: BackupTables): BackupTables {
    for (const tableName in tables) {
        const rows = tables[tableName];
        if (!Array.isArray(rows)) continue;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as any;
            if (!row || typeof row !== 'object') continue;

            for (const key in row) {
                const value = row[key];
                if (typeof value === 'string' && isoDateRegex.test(value)) {
                    row[key] = new Date(value);
                }
            }
        }
    }
    return tables;
}

/**
 * Export the entire database to a JSON string
 * @param options.excludeTables - Array of table names to exclude from export
 */
export async function exportDatabase(options?: { excludeTables?: string[] }): Promise<BackupTables> {
    try {
        const excludeTables = options?.excludeTables || [];
        const data: BackupTables = {};

        // Get all table names from the database
        const tableNames = db.tables.map(table => table.name);
        const tablesToExport = tableNames.filter(name => !excludeTables.includes(name));

        logger.info('[exportDatabase] Exporting database', {
            totalTables: tableNames.length,
            excludedTables: excludeTables,
            allTables: tableNames,
            exportingTables: tablesToExport,
        });

        // Export each table
        for (const tableName of tablesToExport) {
            const table = db.table(tableName);
            const records = await table.toArray();
            data[tableName] = records;
            logger.info(`[exportDatabase] Exported table: ${tableName}`, {recordCount: records.length});
        }

        return data;
    } catch (error) {
        logger.error('[Backup] Failed to export database:', error);
        throw new Error('Database export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

async function clearTables(backupTables: BackupTables, excludeTables: string[]) {
    const tableNames = Object.keys(backupTables).filter(name => !excludeTables.includes(name));
    logger.info('[importDatabase] Clearing existing data', {tables: tableNames});

    for (const tableName of tableNames) {
        if (tableName === 'log') {
            logger.info('[importDatabase] Skipping clearing log table');
        } else {
            const table = db.table(tableName);
            await table.clear();
        }
    }
}

/**
 * Import database from JSON string
 * @param backupTables - JSON string containing database data
 * @param options
 * @param options.merge - If true, merge with existing data; if false, replace all data
 * @param options.excludeTables - Array of table names to exclude from import
 */
export async function importDatabase(
    backupTables: BackupTables,
    options?: { merge?: boolean; excludeTables?: string[] }
): Promise<void> {
    try {
        const merge = options?.merge || false;
        const excludeTables = options?.excludeTables || [];

        logger.info('[importDatabase] Importing database', {merge, excludeTables});

        // If not merging, clear all tables first
        if (!merge) {
            await clearTables(backupTables, excludeTables);
        }

        // Import data into each table
        for (const [tableName, records] of Object.entries(backupTables)) {
            if (excludeTables.includes(tableName)) {
                logger.info(`[importDatabase] Skipping table: ${tableName}`);
                continue;
            }

            const table = db.table(tableName);

            if (merge || tableName === 'log') { // always merge logs
                // In merge mode, use bulkPut which will update existing records
                await table.bulkPut(records);
            } else {
                // In replace mode, use bulkAdd (data should already be cleared)
                await table.bulkAdd(records);
            }

            logger.info(`[importDatabase] Imported table: ${tableName}`, {recordCount: records.length});
        }

        logger.info('[importDatabase] Database import completed successfully');
    } catch (error) {
        logger.error('[importDatabase] Failed to import database:', error);
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

        logger.info('[createBackup] Creating backup', {provider, encrypt, includeLogs});

        // Determine which tables to exclude
        const excludeTables = includeLogs ? [] : ['log'];

        // Export database
        const tables = await exportDatabase({excludeTables});

        // Get database version
        const databaseVersion = db.verno;

        // Create metadata
        const metadata: BackupMetadata = {
            id: uuidv4(),
            timestamp: new Date(),
            size: JSON.stringify(tables).length,
            encrypted: encrypt,
            provider,
            databaseVersion,
            includedLogs: includeLogs,
            tablesIncluded: db.tables
                .map(t => t.name)
                .filter(name => !excludeTables.includes(name)),
        };

        // Encrypt if requested
        if (encrypt && options?.encryptionKey) {
            logger.info('[createBackup] Encrypting backup data');
            const {encrypted, iv, salt} = await encryptData(JSON.stringify(tables), options.encryptionKey);
            metadata.iv = iv;
            metadata.salt = salt;
            return {
                metadata,
                encryptedTables: encrypted,
            };
        }


        logger.info('[createBackup] Backup created successfully', {
            id: metadata.id,
            size: metadata.size,
            encrypted: encrypt,
        });

        return {
            metadata,
            tables
        };
    } catch (error) {
        logger.error('[createBackup] Failed to create backup:', error);
        throw new Error('[createBackup] Backup creation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

function isPresent(value: string | undefined): string {
    return value ? "present" : "missing";
}

async function getTablesFromBackup(backupData: BackupData, encryptionKey?: string): Promise<BackupTables> {
    const {metadata} = backupData;
    if (metadata.encrypted) {
        if (!encryptionKey || !backupData.encryptedTables || !metadata.iv || !metadata.salt) {
            throw new Error(`[restoreBackup] Decryption failed (
                        encrypted data: ${isPresent(backupData?.encryptedTables)},\n
                        encryption key: ${isPresent(encryptionKey)},\n                 
                        iv: ${isPresent(metadata.iv)},\n
                        salt: ${isPresent(metadata.salt)}\n                
                        )`);
        }

        logger.info('[restoreBackup] Decrypting backup data');
        const encryptedTables = backupData.encryptedTables;
        const decrypted = await decryptData(
            encryptedTables,
            metadata.iv,
            metadata.salt,
            encryptionKey
        );
        return JSON.parse(decrypted, dateReviver) as BackupTables;
    } else {
        if (!backupData?.tables) {
            throw new Error('[restoreBackup] Backup data is missing table data');
        }
        return backupData.tables;
    }

}

/**
 * Restore from backup
 */
export async function restoreBackup(
    backupData: BackupData,
    options?: {
        encryptionKey?: string;
        merge?: boolean;
    }
): Promise<void> {
    try {
        logger.info('[restoreBackup] Restoring backup', {
            id: backupData.metadata.id,
            encrypted: backupData.metadata.encrypted,
            merge: options?.merge,
        });

        const metadata: BackupMetadata = backupData.metadata;
        let backupTables: BackupTables = await getTablesFromBackup(backupData, options?.encryptionKey);

        // Ensure dates are Date objects (fix for unencrypted backups loaded via JSON.parse without reviver)
        if (!metadata.encrypted) {
            backupTables = reviveBackupTables(backupTables);
        }

        // Determine which tables to exclude (if logs weren't included in backup, don't try to restore them)
        const excludeTables = metadata.includedLogs ? [] : ['log'];

        // Import database
        await importDatabase(backupTables, {
            merge: options?.merge || false,
            excludeTables,
        });

        logger.info('[restoreBackup] Backup restored successfully');
    } catch (error) {
        logger.error('[restoreBackup] Failed to restore backup:', error);
        throw new Error('[restoreBackup] Backup restore failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Validate backup data integrity
 */
export async function validateBackup(backupData: BackupData): Promise<boolean> {
    logger.info('[validateBackup] validating backup: ', {dataType: typeof backupData});

    if (!backupData || typeof backupData !== 'object' || !backupData.metadata) {
        logger.warn('[validateBackup] invalid backup data structure');
        return false;
    }
    const {metadata} = backupData;
    if (metadata.encrypted) {
        const requiredDataItemsPresent = (!!backupData?.encryptedTables && metadata.encrypted && !!metadata.iv && !!metadata.salt)
        logger.info('[validateBackup] backup is encrypted, skipping detailed structure validation - required data items present:' + requiredDataItemsPresent ? 'yes' : 'no');
        return requiredDataItemsPresent
    }
    if (!backupData?.tables) {
        logger.warn('[validateBackup] backup is not encrypted but missing tables data');
        return false;
    }

    const {tables} = backupData;


    logger.info(`[validateBackup] backup data (tables length: ${tables.length})`);
    return true
}
