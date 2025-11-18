import {v4 as uuidv4} from 'uuid';
import {db} from './db';
import type {ExchangeRate, ExchangeRateApiProviderType, ExchangeRateSource} from '../types';
import {logger} from '../utils';

/**
 * Exchange Rate Manager - Handles currency conversion rates
 * Phase 2: Multi-currency support
 */

/**
 * Add or update an exchange rate
 */
export async function setExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    date: Date = new Date(),
    source: ExchangeRateSource = 'manual'
): Promise<ExchangeRate> {
    // Check if a rate already exists for this date
    const existing = await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([fromCurrency, toCurrency])
        .and(r => r.date.toDateString() === date.toDateString())
        .first();

    if (existing) {
        // Update existing rate
        await db.exchangeRates.update(existing.id, {
            rate,
            source,
        });
        return {...existing, rate, source};
    }

    // Create new rate
    const exchangeRate: ExchangeRate = {
        id: uuidv4(),
        fromCurrency,
        toCurrency,
        rate,
        date,
        source,
        createdAt: new Date(),
    };

    await db.exchangeRates.add(exchangeRate);
    return exchangeRate;
}

/**
 * Get exchange rate for a specific date
 * If no exact match, finds the closest previous rate
 */
export async function getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
): Promise<number | null> {
    // Same currency = 1.0
    if (fromCurrency === toCurrency) {
        return 1.0;
    }

    // Try to find exact match for the date
    const exactMatch = await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([fromCurrency, toCurrency])
        .and(r => r.date.toDateString() === date.toDateString())
        .first();

    if (exactMatch) {
        return exactMatch.rate;
    }

    // Find closest previous rate
    const previousRates = await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([fromCurrency, toCurrency])
        .and(r => r.date <= date)
        .reverse()
        .sortBy('date');

    if (previousRates.length > 0) {
        return previousRates[0].rate;
    }

    // Try inverse rate (e.g., USD->EUR instead of EUR->USD)
    const inverseRate = await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([toCurrency, fromCurrency])
        .and(r => r.date <= date)
        .reverse()
        .sortBy('date');

    if (inverseRate.length > 0) {
        return 1 / inverseRate[0].rate;
    }

    return null;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
): Promise<{ convertedAmount: number; rate: number | null }> {
    const rate = await getExchangeRate(fromCurrency, toCurrency, date);

    if (rate === null) {
        return {
            convertedAmount: amount,
            rate: null,
        };
    }

    return {
        convertedAmount: amount * rate,
        rate,
    };
}

/**
 * Get all exchange rates for a currency pair
 */
export async function getExchangeRateHistory(
    fromCurrency: string,
    toCurrency: string
): Promise<ExchangeRate[]> {
    return await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([fromCurrency, toCurrency])
        .reverse()
        .sortBy('date');
}

/**
 * Get all unique currencies that have exchange rates
 */
export async function getAvailableCurrencies(): Promise<string[]> {
    const rates = await db.exchangeRates.toArray();
    const currencies = new Set<string>();

    rates.forEach(rate => {
        currencies.add(rate.fromCurrency);
        currencies.add(rate.toCurrency);
    });

    // Always include common currencies
    currencies.add('EUR');
    currencies.add('USD');
    currencies.add('GBP');

    return Array.from(currencies).sort();
}

/**
 * Delete an exchange rate
 */
export async function deleteExchangeRate(rateId: string): Promise<void> {
    await db.exchangeRates.delete(rateId);
}

/**
 * Get the latest exchange rate for a currency pair
 */
export async function getLatestExchangeRate(
    fromCurrency: string,
    toCurrency: string
): Promise<ExchangeRate | null> {
    const rates = await db.exchangeRates
        .where('[fromCurrency+toCurrency]')
        .equals([fromCurrency, toCurrency])
        .reverse()
        .sortBy('date');

    return rates.length > 0 ? rates[0] : null;
}

/**
 * Bulk import exchange rates
 */
export async function bulkImportExchangeRates(
    rates: Array<{
        fromCurrency: string;
        toCurrency: string;
        rate: number;
        date: Date;
        source?: ExchangeRateSource;
    }>
): Promise<number> {
    let importedCount = 0;

    for (const rateData of rates) {
        await setExchangeRate(
            rateData.fromCurrency,
            rateData.toCurrency,
            rateData.rate,
            rateData.date,
            rateData.source || 'manual'
        );
        importedCount++;
    }

    return importedCount;
}

/**
 * Initialize default exchange rates (common conversions)
 * These are just placeholders - users should update with real rates
 */
export async function initializeDefaultExchangeRates(): Promise<void> {
    const today = new Date();

    // Check if we already have rates
    const existingRates = await db.exchangeRates.count();
    if (existingRates > 0) {
        return; // Already initialized
    }

    // Add some common default rates (approximate, as of 2025)
    const defaultRates = [
        {fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92},
        {fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.09},
        {fromCurrency: 'GBP', toCurrency: 'EUR', rate: 1.17},
        {fromCurrency: 'EUR', toCurrency: 'GBP', rate: 0.85},
        {fromCurrency: 'USD', toCurrency: 'GBP', rate: 0.79},
        {fromCurrency: 'GBP', toCurrency: 'USD', rate: 1.27},
    ];

    await bulkImportExchangeRates(
        defaultRates.map(r => ({
            ...r,
            date: today,
            source: 'manual' as ExchangeRateSource,
        }))
    );
}

/**
 * ========================================
 * Exchange Rate API Integration
 * ========================================
 */

export interface ExchangeRateApiResult {
    rate: number;
    provider: string;
    date: Date;
}

/**
 * Fetch exchange rate from exchangerate-api.io (Free tier: 1500 requests/month)
 * Docs: https://www.exchangerate-api.com/docs/overview
 */
async function fetchFromExchangeRateApi(
    fromCurrency: string,
    toCurrency: string,
    apiKey?: string
): Promise<ExchangeRateApiResult | null> {
    try {
        // API key is optional - free tier available without key
        const baseUrl = apiKey
            ? `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${fromCurrency}/${toCurrency}`
            : `https://open.er-api.com/v6/latest/${fromCurrency}`;

        const response = await fetch(baseUrl);

        if (!response.ok) {
            logger.error(`exchangerate-api error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.result === 'error') {
            logger.error(`exchangerate-api error: ${data['error-type']}`);
            return null;
        }

        const rate = apiKey ? data.conversion_rate : data.rates[toCurrency];

        if (!rate) {
            logger.error(`No rate found for ${fromCurrency} to ${toCurrency}`);
            return null;
        }

        return {
            rate,
            provider: 'exchangerate-api',
            date: new Date(),
        };
    } catch (error) {
        logger.error(`Error fetching from exchangerate-api:`, error);
        return null;
    }
}

/**
 * Fetch exchange rate from Fixer.io (Requires API key, free tier: 100 requests/month)
 * Docs: https://fixer.io/documentation
 */
async function fetchFromFixer(
    fromCurrency: string,
    toCurrency: string,
    apiKey: string
): Promise<ExchangeRateApiResult | null> {
    try {
        if (!apiKey) {
            logger.error('Fixer API key required');
            return null;
        }

        const url = `http://data.fixer.io/api/latest?access_key=${apiKey}&base=${fromCurrency}&symbols=${toCurrency}`;
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

        const response = await fetch(proxiedUrl);

        if (!response.ok) {
            logger.error(`Fixer API error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data.success) {
            logger.error(`Fixer API error: ${data.error?.info || 'Unknown error'}`);
            return null;
        }

        const rate = data.rates[toCurrency];

        if (!rate) {
            logger.error(`No rate found for ${fromCurrency} to ${toCurrency}`);
            return null;
        }

        return {
            rate,
            provider: 'fixer',
            date: new Date(data.date),
        };
    } catch (error) {
        logger.error(`Error fetching from Fixer:`, error);
        return null;
    }
}

/**
 * Fetch exchange rate from ECB (European Central Bank - Free, no API key required)
 * Docs: https://www.ecb.europa.eu/stats/eurofxref/
 */
async function fetchFromECB(
    fromCurrency: string,
    toCurrency: string
): Promise<ExchangeRateApiResult | null> {
    try {
        // ECB provides rates against EUR only
        const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

        const response = await fetch(proxiedUrl);

        if (!response.ok) {
            logger.error(`ECB API error: ${response.status}`);
            return null;
        }
        logger.debug("Fetched ECB data successfully");

        const xmlText = await response.text();

        // Parse XML to extract rates (simple regex approach)
        const rateRegex = new RegExp(`currency='(${fromCurrency}|${toCurrency})'\\s+rate='([0-9.]+)'`, 'g');
        const matches = [...xmlText.matchAll(rateRegex)];

        if (matches.length === 0) {
            logger.error(`No rates found in ECB data`);
            return null;
        }

        // Build rates map
        const rates: Record<string, number> = {EUR: 1.0};

        for (const match of matches) {
            rates[match[1]] = Number.parseFloat(match[2]);
        }
        logger.debug('Parsed ECB rates:', rates);

        // Calculate conversion rate
        let rate: number;
        if (fromCurrency === 'EUR' && rates[toCurrency]) {
            rate = rates[toCurrency];
        } else if (toCurrency === 'EUR' && rates[fromCurrency]) {
            rate = 1 / rates[fromCurrency];
        } else if (rates[fromCurrency] && rates[toCurrency]) {
            // Cross rate through EUR
            rate = rates[toCurrency] / rates[fromCurrency];
        } else {
            logger.error(`Cannot calculate rate for ${fromCurrency} to ${toCurrency}`);
            return null;
        }

        return {
            rate,
            provider: 'ecb',
            date: new Date(),
        };
    } catch (error) {
        console.error(`Error fetching from ECB:`, error);
        logger.error(`Error fetching from ECB:`, error);
        return null;
    }
}

/**
 * Fetch exchange rate from Open Exchange Rates (Requires API key, free tier: 1000 requests/month)
 * Docs: https://docs.openexchangerates.org/
 */
async function fetchFromOpenExchangeRates(
    fromCurrency: string,
    toCurrency: string,
    apiKey: string
): Promise<ExchangeRateApiResult | null> {
    try {
        if (!apiKey) {
            logger.error('Open Exchange Rates API key required');
            return null;
        }

        // Free tier only supports USD as base currency
        const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}`;
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

        const response = await fetch(proxiedUrl);

        if (!response.ok) {
            logger.error(`Open Exchange Rates API error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.error) {
            logger.error(`Open Exchange Rates error: ${data.message}`);
            return null;
        }

        const rates = data.rates;

        // Calculate conversion rate (always through USD)
        let rate: number;
        if (fromCurrency === 'USD' && rates[toCurrency]) {
            rate = rates[toCurrency];
        } else if (toCurrency === 'USD' && rates[fromCurrency]) {
            rate = 1 / rates[fromCurrency];
        } else if (rates[fromCurrency] && rates[toCurrency]) {
            // Cross rate through USD
            rate = rates[toCurrency] / rates[fromCurrency];
        } else {
            logger.error(`Cannot calculate rate for ${fromCurrency} to ${toCurrency}`);
            return null;
        }

        return {
            rate,
            provider: 'openexchangerates',
            date: new Date(data.timestamp * 1000),
        };
    } catch (error) {
        logger.error(`Error fetching from Open Exchange Rates:`, error);
        return null;
    }
}

/**
 * Fetch exchange rate using configured providers with fallback
 * Tries providers in priority order until one succeeds
 */
export async function fetchExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    preferredProvider?: string
): Promise<ExchangeRateApiResult | null> {
    try {
        // Get settings
        const settings = await db.settings.get('default');

        if (!settings) {
            logger.info('No settings found');
            return null;
        }

        // Get enabled providers sorted by priority
        const providers = settings.exchangeRateApiProviders?.filter(p => p.enabled) || [];

        if (providers.length === 0) {
            logger.info('No exchange rate API providers configured');
            return null;
        }

        // Sort by priority (lower number = higher priority)
        providers.sort((a, b) => a.priority - b.priority);

        // If preferred provider is specified, try it first
        if (preferredProvider) {
            const preferred = providers.find(p => p.type === preferredProvider);
            if (preferred) {
                logger.info(`[FetchExchangeRate] Trying preferred provider ${preferredProvider} for ${fromCurrency}/${toCurrency}`);
                const result = await fetchFromProvider(fromCurrency, toCurrency, preferred.type, preferred.apiKey);
                if (result) {
                    return result;
                }
                // Remove from list so we don't try again
                providers.splice(providers.indexOf(preferred), 1);
            }
        }

        // Try each provider in priority order
        for (const provider of providers) {
            logger.info(`[FetchExchangeRate] Trying ${provider.type} for ${fromCurrency}/${toCurrency}`);
            const result = await fetchFromProvider(fromCurrency, toCurrency, provider.type, provider.apiKey);
            if (result) {
                logger.info(`[FetchExchangeRate] Successfully fetched ${fromCurrency}/${toCurrency} from ${provider.type}`);
                return result;
            }
        }

        logger.info(`[FetchExchangeRate] All providers failed for ${fromCurrency}/${toCurrency}`);
        return null;
    } catch (error) {
        logger.error(`Error in fetchExchangeRate for ${fromCurrency}/${toCurrency}:`, error);
        return null;
    }
}

/**
 * Helper function to fetch from a specific provider
 */
async function fetchFromProvider(
    fromCurrency: string,
    toCurrency: string,
    providerType: string,
    apiKey?: string
): Promise<ExchangeRateApiResult | null> {
    try {
        switch (providerType) {
            case 'exchangerate-api':
                return await fetchFromExchangeRateApi(fromCurrency, toCurrency, apiKey);

            case 'fixer':
                if (!apiKey) {
                    logger.error('Fixer requires API key');
                    return null;
                }
                return await fetchFromFixer(fromCurrency, toCurrency, apiKey);

            case 'ecb':
                return await fetchFromECB(fromCurrency, toCurrency);

            case 'openexchangerates':
                if (!apiKey) {
                    logger.error('Open Exchange Rates requires API key');
                    return null;
                }
                return await fetchFromOpenExchangeRates(fromCurrency, toCurrency, apiKey);

            default:
                logger.error(`Unknown exchange rate provider: ${providerType}`);
                return null;
        }
    } catch (error) {
        logger.error(`Error fetching from ${providerType}:`, error);
        return null;
    }
}

/**
 * Fetch and save exchange rate from API providers
 */
export async function fetchAndSaveExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
): Promise<ExchangeRate | null> {
    const result = await fetchExchangeRate(fromCurrency, toCurrency);

    if (!result) {
        return null;
    }

    // Save to database
    return await setExchangeRate(
        fromCurrency,
        toCurrency,
        result.rate,
        date,
        'api'
    ).then(async (rate) => {
        // Update with provider info
        await db.exchangeRates.update(rate.id, {
            apiProvider: result.provider as ExchangeRateApiProviderType,
        });
        return {...rate, apiProvider: result.provider as ExchangeRateApiProviderType};
    });
}

/**
 * Refresh all exchange rates for commonly used currency pairs
 */
export async function refreshCommonExchangeRates(): Promise<{
    success: number;
    failed: number;
    total: number;
}> {
    // Get all unique currency pairs from accounts and settings
    const accounts = await db.accounts.toArray();
    logger.debug("Accounts fetched for currency extraction:", accounts);
    const currencies = [...new Set(accounts.map(a => a.currency))];
    logger.debug('Unique currencies from accounts:', currencies);

    const settings = await db.settings.get('default');
    if (settings?.defaultCurrency && !currencies.includes(settings.defaultCurrency)) {
        currencies.push(settings.defaultCurrency);
    }
    logger.debug('Final currency list after adding default currency:', currencies);
    // Generate all pairs
    const pairs: Array<{ from: string; to: string }> = [];
    for (const from of currencies) {
        for (const to of currencies) {
            if (from !== to) {
                pairs.push({from, to});
            }
        }
    }
    logger.debug('Final currency pairs:', pairs);

    const results = {success: 0, failed: 0, total: pairs.length};

    // Rate limiting: delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const pair of pairs) {
        const result = await fetchAndSaveExchangeRate(pair.from, pair.to);
        if (result) {
            results.success++;
        } else {
            results.failed++;
        }

        // Wait 1 second between requests
        if (pair !== pairs[pairs.length - 1]) {
            await delay(1000);
        }
    }

    // Update last refresh timestamp
    await db.settings.update('default', {
        exchangeRateLastRefresh: new Date(),
    });

    return results;
}
