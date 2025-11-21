import { useEffect } from 'react';
import { logger } from '../utils';

interface SchedulerConfig {
    enabled: boolean;
    intervalMinutes: number;
    taskName: string;
    task: () => Promise<void>;
}

/**
 * Generic scheduler hook for running tasks at regular intervals
 * Automatically starts/stops based on enabled flag and cleans up on unmount
 */
export function useScheduler({ enabled, intervalMinutes, taskName, task }: SchedulerConfig): void {
    useEffect(() => {
        if (!enabled) {
            logger.info(`[${taskName}] Scheduler is disabled`);
            return;
        }

        const intervalMs = intervalMinutes * 60 * 1000;
        logger.info(`[${taskName}] Setting up scheduler every ${intervalMinutes} minutes`);

        const intervalId = setInterval(async () => {
            try {
                logger.info(`[${taskName}] Running scheduled task...`);
                await task();
                logger.info(`[${taskName}] Completed successfully`);
            } catch (error) {
                logger.error(`[${taskName}] Failed:`, error);
            }
        }, intervalMs);

        return () => {
            logger.info(`[${taskName}] Cleaning up scheduler`);
            clearInterval(intervalId);
        };
    }, [enabled, intervalMinutes, taskName, task]);
}
