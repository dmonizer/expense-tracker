// Backup Scheduler Service
// Main thread interface to the backup worker

import { logger } from '../utils';
import type { UserSettings } from '../types/userSettingsTypes';

let backupWorker: Worker | null = null;

/**
 * Start the backup scheduler worker
 */
export function startBackupScheduler(settings: UserSettings): Worker | null {
    try {
        if (!settings.backupEnabled) {
            logger.info('[BackupScheduler] Automatic backups are disabled');
            return null;
        }

        if (backupWorker) {
            logger.info('[BackupScheduler] Worker already running');
            return backupWorker;
        }

        logger.info('[BackupScheduler] Starting backup worker');

        // Create worker
        backupWorker = new Worker(
            new URL('../workers/backupWorker.ts', import.meta.url),
            { type: 'module' }
        );

        // Set up message handler
        backupWorker.addEventListener('message', handleWorkerMessage);

        // Set up error handler
        backupWorker.addEventListener('error', (error) => {
            logger.error('[BackupScheduler] Worker error:', error);
        });

        // Send start message
        backupWorker.postMessage({ type: 'start' });

        return backupWorker;
    } catch (error) {
        logger.error('[BackupScheduler] Failed to start worker:', error);
        return null;
    }
}

/**
 * Stop the backup scheduler worker
 */
export function stopBackupScheduler(worker?: Worker): void {
    try {
        const workerToStop = worker || backupWorker;

        if (!workerToStop) {
            return;
        }

        logger.info('[BackupScheduler] Stopping backup worker');

        // Send stop message
        workerToStop.postMessage({ type: 'stop' });

        // Terminate worker
        workerToStop.terminate();

        if (workerToStop === backupWorker) {
            backupWorker = null;
        }
    } catch (error) {
        logger.error('[BackupScheduler] Failed to stop worker:', error);
    }
}

/**
 * Trigger an immediate backup check
 */
export function triggerBackupCheck(): void {
    if (!backupWorker) {
        logger.warn('[BackupScheduler] Worker not running');
        return;
    }

    logger.info('[BackupScheduler] Triggering immediate backup check');
    backupWorker.postMessage({ type: 'check-now' });
}

/**
 * Handle messages from the worker
 */
function handleWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
        case 'init':
            logger.info('[BackupScheduler] Worker initialized:', data);
            break;
        case 'backup-complete':
            logger.info('[BackupScheduler] Backup completed:', data);
            // Could show a toast notification here
            break;
        case 'backup-error':
            logger.error('[BackupScheduler] Backup failed:', data);
            // Could show an error notification here
            break;
        case 'status':
            logger.info('[BackupScheduler] Status update:', data);
            break;
        default:
            logger.warn('[BackupScheduler] Unknown message type:', type);
    }
}

/**
 * Get the current worker instance
 */
export function getBackupWorker(): Worker | null {
    return backupWorker;
}
