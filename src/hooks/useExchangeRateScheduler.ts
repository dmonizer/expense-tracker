import {useCallback} from 'react';
import {refreshCommonExchangeRates} from '../services/exchangeRateManager';
import {logger} from '@/utils';
import {useScheduler} from './useScheduler';
import type {UserSettings} from '@/types';

/**
 * Custom hook to manage automatic exchange rate refresh scheduling
 * Runs exchange rate refresh at configured intervals when enabled
 */
export function useExchangeRateScheduler(settings: UserSettings | undefined, isInitialized: boolean): void {
    const hasEnabledProviders = settings?.exchangeRateApiProviders?.some(p => p.enabled);

    const enabled = Boolean(
        isInitialized &&
        settings &&
        settings.exchangeRateAutoRefresh &&
        hasEnabledProviders
    );

    const task = useCallback(async () => {
        const results = await refreshCommonExchangeRates();
        logger.info(`Exchange rate refresh: ${results.success}/${results.total} updated, ${results.failed} failed`);
    }, []);

    useScheduler({
        enabled,
        intervalMinutes: settings?.exchangeRateRefreshInterval || 1440,
        taskName: 'Auto-Refresh-Rates',
        task,
    });
}
