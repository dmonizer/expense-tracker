import { db } from './db';

/**
 * Price fetching service - supports multiple API providers
 * Currently supports: Twelve Data, Alpha Vantage, Yahoo Finance
 */

export interface PriceQuote {
  symbol: string;
  price: number;
  currency: string;
  timestamp: Date;
  source: string;
}

/**
 * Fetch price from Twelve Data API
 * Docs: https://twelvedata.com/docs
 */
async function fetchPriceFromTwelveData(
  symbol: string,
  apiKey: string
): Promise<PriceQuote | null> {
  try {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Twelve Data API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'error') {
      console.error(`Twelve Data error: ${data.message}`);
      return null;
    }

    if (!data.price) {
      console.error(`No price data for ${symbol}`);
      return null;
    }

    return {
      symbol,
      price: parseFloat(data.price),
      currency: 'USD', // Twelve Data defaults to USD, would need another call for currency
      timestamp: new Date(),
      source: 'twelvedata',
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch price from Alpha Vantage API
 * Docs: https://www.alphavantage.co/documentation/
 */
async function fetchPriceFromAlphaVantage(
  symbol: string,
  apiKey: string
): Promise<PriceQuote | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Alpha Vantage API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data['Error Message']) {
      console.error(`Alpha Vantage error: ${data['Error Message']}`);
      return null;
    }

    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      console.error(`No price data for ${symbol}`);
      return null;
    }

    return {
      symbol,
      price: parseFloat(quote['05. price']),
      currency: 'USD',
      timestamp: new Date(),
      source: 'alphavantage',
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch price from Yahoo Finance (Free, no API key required)
 * Uses Yahoo Finance v8 Chart API through a CORS proxy
 * Docs: https://query1.finance.yahoo.com/v8/finance/chart/
 *
 * Note: For international stocks, use proper Yahoo symbol format:
 * - Stockholm: SYMBOL.ST (e.g., SWED-A.ST)
 * - London: SYMBOL.L (e.g., HSBA.L)
 * - Paris: SYMBOL.PA (e.g., MC.PA)
 *
 * CORS Note: Yahoo Finance doesn't allow direct browser requests,
 * so we use a CORS proxy (corsproxy.io) to fetch the data.
 */
async function fetchPriceFromYahoo(
  symbol: string
): Promise<PriceQuote | null> {
  try {
    // Yahoo Finance v8 Chart API - free, no authentication required
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;

    // Use CORS proxy to avoid browser CORS restrictions
    const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;

    const response = await fetch(proxiedUrl);

    if (!response.ok) {
      console.error(`Yahoo Finance API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Check for errors in response
    if (data.chart?.error) {
      console.error(`Yahoo Finance error: ${data.chart.error.description}`);
      return null;
    }

    const result = data.chart?.result?.[0];
    if (!result) {
      console.error(`No data found for ${symbol}`);
      return null;
    }

    // Get the latest price from meta
    const price = result.meta?.regularMarketPrice;
    const currency = result.meta?.currency || 'USD';

    if (!price) {
      console.error(`No price data for ${symbol}`);
      return null;
    }

    return {
      symbol,
      price,
      currency: currency.toUpperCase(),
      timestamp: new Date(),
      source: 'yahoo',
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Main function to fetch price for a symbol
 * Tries multiple configured API providers in priority order until one succeeds
 *
 * @param symbol - The ticker symbol to fetch
 * @param preferredProvider - Optional: if set, try this provider first (for holdings with known working provider)
 * @returns PriceQuote with price data, or null if all providers fail
 */
export async function fetchPrice(
  symbol: string,
  preferredProvider?: string
): Promise<PriceQuote | null> {
  try {
    // Get settings
    const settings = await db.settings.get('default');

    if (!settings) {
      console.log('No settings found');
      return null;
    }

    // Get enabled providers sorted by priority
    let providers = settings.priceApiProviders?.filter(p => p.enabled) || [];

    // If no providers in new format, check legacy format
    if (providers.length === 0 && settings.priceApiProvider && settings.priceApiProvider !== 'none') {
      providers = [{
        type: settings.priceApiProvider as any,
        apiKey: settings.priceApiKey || '',
        enabled: true,
        priority: 1,
      }];
    }

    if (providers.length === 0) {
      console.log('No API providers configured');
      return null;
    }

    // Sort by priority (lower number = higher priority)
    providers.sort((a, b) => a.priority - b.priority);

    // If preferred provider is specified, try it first
    if (preferredProvider) {
      const preferred = providers.find(p => p.type === preferredProvider);
      if (preferred) {
        console.log(`[FetchPrice] Trying preferred provider ${preferredProvider} for ${symbol}`);
        const quote = await fetchPriceFromProvider(symbol, preferred.type, preferred.apiKey);
        if (quote) {
          return quote;
        }
        // Remove preferred from list so we don't try it again
        providers = providers.filter(p => p.type !== preferredProvider);
      }
    }

    // Try each provider in priority order
    for (const provider of providers) {
      console.log(`[FetchPrice] Trying ${provider.type} for ${symbol}`);
      const quote = await fetchPriceFromProvider(symbol, provider.type, provider.apiKey);
      if (quote) {
        console.log(`[FetchPrice] Successfully fetched ${symbol} from ${provider.type}`);
        return quote;
      }
    }

    console.log(`[FetchPrice] All providers failed for ${symbol}`);
    return null;
  } catch (error) {
    console.error(`Error in fetchPrice for ${symbol}:`, error);
    return null;
  }
}

/**
 * Helper function to fetch price from a specific provider
 */
async function fetchPriceFromProvider(
  symbol: string,
  providerType: string,
  apiKey: string
): Promise<PriceQuote | null> {
  try {
    switch (providerType) {
      case 'twelvedata':
        if (!apiKey) {
          console.error('Twelve Data API key not configured');
          return null;
        }
        return await fetchPriceFromTwelveData(symbol, apiKey);

      case 'alphavantage':
        if (!apiKey) {
          console.error('Alpha Vantage API key not configured');
          return null;
        }
        return await fetchPriceFromAlphaVantage(symbol, apiKey);

      case 'yahoo':
        return await fetchPriceFromYahoo(symbol);

      default:
        console.error(`Unknown API provider: ${providerType}`);
        return null;
    }
  } catch (error) {
    console.error(`Error fetching from ${providerType}:`, error);
    return null;
  }
}

/**
 * Update price for a single holding
 * Uses the preferred provider from the holding if available
 */
export async function updateHoldingPrice(holdingId: string): Promise<boolean> {
  try {
    const holding = await db.holdings.get(holdingId);
    if (!holding) {
      console.error(`Holding ${holdingId} not found`);
      return false;
    }

    // Try to fetch price, using preferred provider if known
    const quote = await fetchPrice(holding.symbol, holding.priceApiProvider);
    if (!quote) {
      return false;
    }

    // Save the price and remember which provider worked
    await db.holdings.update(holdingId, {
      currentPrice: quote.price,
      currentPriceCurrency: quote.currency,
      currentPriceDate: quote.timestamp,
      priceApiProvider: quote.source as any, // Remember which provider succeeded
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error(`Error updating price for holding ${holdingId}:`, error);
    return false;
  }
}

/**
 * Update prices for all holdings
 */
export async function refreshAllPrices(): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  try {
    const holdings = await db.holdings.toArray();
    const results = { success: 0, failed: 0, total: holdings.length };

    // Rate limiting: delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const holding of holdings) {
      const success = await updateHoldingPrice(holding.id);
      if (success) {
        results.success++;
      } else {
        results.failed++;
      }

      // Wait 1 second between requests to respect rate limits
      if (holding !== holdings[holdings.length - 1]) {
        await delay(1000);
      }
    }

    // Update last refresh timestamp
    await db.settings.update('default', {
      priceApiLastRefresh: new Date(),
    });

    return results;
  } catch (error) {
    console.error('Error refreshing all prices:', error);
    throw error;
  }
}

/**
 * Update prices for holdings in a specific account
 */
export async function refreshAccountPrices(accountId: string): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  try {
    const holdings = await db.holdings
      .where('accountId')
      .equals(accountId)
      .toArray();

    const results = { success: 0, failed: 0, total: holdings.length };

    // Rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const holding of holdings) {
      const success = await updateHoldingPrice(holding.id);
      if (success) {
        results.success++;
      } else {
        results.failed++;
      }

      if (holding !== holdings[holdings.length - 1]) {
        await delay(1000);
      }
    }

    return results;
  } catch (error) {
    console.error(`Error refreshing prices for account ${accountId}:`, error);
    throw error;
  }
}
