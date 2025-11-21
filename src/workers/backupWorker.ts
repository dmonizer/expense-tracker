// Backup Worker
// Runs in background to handle automatic backup scheduling
// This worker checks periodically if a backup is due and triggers it
// NOTE: Only local backups are supported in the worker since cloud providers
// require browser APIs (OAuth, window.location) that aren't available in workers

import { db } from '../services/db';
import { createBackup } from '../services/databaseBackup';
import * as localProvider from '../services/backupProviders/localBackupProvider';
import type { BackupProvider } from '../types/backupTypes';

const CHECK_INTERVAL = 60000; // Check every minute

interface BackupWorkerMessage {
    type: 'init' | 'backup-complete' | 'backup-error' | 'status';
    data?: unknown;
}

// Worker state
let checkIntervalId: number | null = null;

/**
 * Check if backup is due and trigger if necessary
 */
async function checkAndBackup() {
    try {
        // Get settings from database
        const settings = await db.settings.get('default');

        if (!settings || !settings.backupEnabled) {
            return;
        }

        const now = Date.now();
        const lastRun = settings.backupLastRun ? new Date(settings.backupLastRun).getTime() : 0;
        const interval = (settings.backupInterval || 1440) * 60 * 1000; // Convert minutes to ms

        // Check if backup is due
        if (now - lastRun >= interval) {
            postMessage({
                type: 'status',
                data: { message: 'Backup is due, starting...' },
            } as BackupWorkerMessage);

            // Perform backup for each configured provider
            // NOTE: Only local provider is supported in workers
            const providers = (settings.backupProviders || ['local']).filter(p => p === 'local');

            if (providers.length === 0) {
                postMessage({
                    type: 'backup-error',
                    data: {
                        error: 'Automatic backups only support local provider. Cloud providers require manual backup.',
                    },
                } as BackupWorkerMessage);
                return;
            }

            const includeLogs = settings.backupIncludeLogs || false;
            const encrypt = !!settings.backupEncryptionKey;
            const encryptionKey = settings.backupEncryptionKey;

            for (const provider of providers) {
                try {
                    // Create backup
                    const backupData = await createBackup(provider, {
                        encrypt,
                        encryptionKey,
                        includeLogs,
                    });

                    // Save backup using local provider
                    await saveBackupWithProvider(provider, backupData);

                    // Record successful backup
                    await db.backupHistory.add({
                        id: backupData.metadata.id,
                        timestamp: new Date(),
                        provider,
                        success: true,
                        encrypted: encrypt,
                        size: backupData.metadata.size,
                        metadata: backupData.metadata,
                    });

                    postMessage({
                        type: 'backup-complete',
                        data: {
                            provider,
                            metadata: backupData.metadata,
                        },
                    } as BackupWorkerMessage);
                } catch (error) {
                    // Record failed backup
                    await db.backupHistory.add({
                        id: crypto.randomUUID(),
                        timestamp: new Date(),
                        provider,
                        success: false,
                        encrypted: encrypt,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });

                    postMessage({
                        type: 'backup-error',
                        data: {
                            provider,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                    } as BackupWorkerMessage);
                }
            }

            // Update last run timestamp
            await db.settings.update('default', {
                backupLastRun: new Date(),
            });
        }
    } catch (error) {
        postMessage({
            type: 'backup-error',
            data: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
        } as BackupWorkerMessage);
    }
}

/**
 * Save backup using the appropriate provider
 */
async function saveBackupWithProvider(
    provider: BackupProvider,
    backupData: any
): Promise<void> {
    const dataString = JSON.stringify(backupData);

    switch (provider) {
        case 'local':
            await localProvider.saveBackup(dataString, backupData.metadata);
            break;
        default:
            throw new Error(`Provider ${provider} not supported in automatic backups. Use manual backup instead.`);
    }
}

/**
 * Start the backup checker
 */
function startChecker() {
    if (checkIntervalId !== null) {
        return; // Already running
    }

    // Run initial check
    checkAndBackup();

    // Set up interval
    checkIntervalId = setInterval(checkAndBackup, CHECK_INTERVAL) as unknown as number;

    postMessage({
        type: 'init',
        data: { message: 'Backup worker started' },
    } as BackupWorkerMessage);
}

/**
 * Stop the backup checker
 */
function stopChecker() {
    if (checkIntervalId !== null) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
    }
}

// Listen for messages from main thread
self.addEventListener('message', (event: MessageEvent) => {
    const { type } = event.data;

    switch (type) {
        case 'start':
            startChecker();
            break;
        case 'stop':
            stopChecker();
            break;
        case 'check-now':
            checkAndBackup();
            break;
    }
});

// Start automatically when worker is created
startChecker();
