// Local Backup Provider
// Handles downloading and uploading backup files using browser APIs

import {logger} from '@/utils';
import type {BackupData, BackupMetadata} from '@/types/backupTypes.ts';

/**
 * Save backup to local file (download)
 */
export async function saveBackup(data: string, metadata: BackupMetadata): Promise<void> {
    try {
        logger.info('[LocalBackup] Saving backup to local file', { id: metadata.id });

        // Create blob from data
        const blob = new Blob([data], { type: 'application/json' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = metadata.timestamp.toISOString().split('T')[0];
        const encrypted = metadata.encrypted ? '-encrypted' : '';
        link.download = `expense-tracker-backup-${timestamp}${encrypted}.json`;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        logger.info('[LocalBackup] Backup saved successfully', { filename: link.download });
    } catch (error) {
        logger.error('[LocalBackup] Failed to save backup:', error);
        throw new Error('Failed to save backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Load backup from local file (upload)
 * Returns a promise that resolves when user selects a file
 */
export async function loadBackup(): Promise<BackupData> {
    return new Promise((resolve, reject) => {
        try {
            logger.info('[LocalBackup] Loading backup from local file');

            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (event) => {
                try {
                    const file = (event.target as HTMLInputElement).files?.[0];
                    if (!file) {
                        reject(new Error('No file selected'));
                        return;
                    }

                    logger.info('[LocalBackup] Reading file', { filename: file.name, size: file.size });

                    // Read file content
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = e.target?.result as string;

                            // Try to parse and extract metadata
                            const parsed = JSON.parse(data);

                            // Check if it's an encrypted backup with metadata
                            let metadata: BackupMetadata;
                            if (parsed.metadata) {
                                metadata = {
                                    ...parsed.metadata,
                                    timestamp: new Date(parsed.metadata.timestamp),
                                };
                            } else {
                                // Create basic metadata for unencrypted backup
                                metadata = {
                                    id: 'imported',
                                    timestamp: new Date(),
                                    size: data.length,
                                    encrypted: false,
                                    provider: 'local',
                                    databaseVersion: 0,
                                    includedLogs: true,
                                    tablesIncluded: Object.keys(parsed),
                                };
                            }

                            logger.info('[LocalBackup] Backup loaded successfully', { size: data.length });
                            resolve({...parsed, metadata});
                        } catch (error) {
                            logger.error('[LocalBackup] Failed to parse backup file:', error);
                            reject(new Error('Invalid backup file format'));
                        }
                    };

                    reader.onerror = () => {
                        logger.error('[LocalBackup] Failed to read file');
                        reject(new Error('Failed to read file'));
                    };

                    reader.readAsText(file);
                } catch (error) {
                    logger.error('[LocalBackup] Error handling file selection:', error);
                    reject(error);
                }
            };

            input.oncancel = () => {
                reject(new Error('File selection cancelled'));
            };

            // Trigger file picker
            input.click();
        } catch (error) {
            logger.error('[LocalBackup] Failed to load backup:', error);
            reject(error);
        }
    });
}
