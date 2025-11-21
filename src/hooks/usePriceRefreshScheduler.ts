import { useCallback } from 'react';
import { refreshAllPrices } from '../services/priceFetcher';
import { logger } from '../utils';
import { useScheduler } from './useScheduler';
import type { UserSettings } from '../types';

/**
 * Custom hook to manage automatic price refresh scheduling
 * Runs price refresh at configured intervals when enabled
 */
export function usePriceRefreshScheduler(settings: UserSettings | undefined, isInitialized: boolean): void {
    const hasEnabledProviders = settings?.priceApiProviders?.some(p => p.enabled) ||
        (settings?.priceApiProvider && settings.priceApiProvider !== 'none' && settings.priceApiKey);

    const enabled = Boolean(
        isInitialized &&
        settings &&
        settings.priceApiAutoRefresh &&
        hasEnabledProviders
    );

    const task = useCallback(async () => {
        const results = await refreshAllPrices();
        logger.info(`Price refresh: ${results.success}/${results.total} updated, ${results.failed} failed`);
    }, []);

    useScheduler({
        enabled,
        intervalMinutes: settings?.priceApiRefreshInterval || 60,
        taskName: 'Auto-Refresh-Prices',
        task,
    });
}
