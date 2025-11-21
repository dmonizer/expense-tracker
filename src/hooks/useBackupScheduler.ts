import { useEffect } from 'react';
import { startBackupScheduler, stopBackupScheduler } from '../services/backupScheduler';
import { logger } from '../utils';
import type { UserSettings } from '../types';

/**
 * Custom hook to manage automatic backup scheduling
 * Starts/stops backup worker based on settings
 */
export function useBackupScheduler(settings: UserSettings | undefined, isInitialized: boolean): void {
    useEffect(() => {
        if (!isInitialized || !settings) return;

        if (settings.backupEnabled) {
            logger.info('[Auto-Backup] Starting automatic backup scheduler');
            const worker = startBackupScheduler(settings);

            return () => {
                if (worker) {
                    logger.info('[Auto-Backup] Stopping automatic backup scheduler');
                    stopBackupScheduler(worker);
                }
            };
        } else {
            logger.info('[Auto-Backup] Automatic backups are disabled');
        }
    }, [isInitialized, settings]);
}
