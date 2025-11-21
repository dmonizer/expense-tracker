// User Settings Types
import type {ExchangeRateApiProvider, PriceApiProvider} from "@/types/apiSettingsTypes.ts";

export interface UserSettings {
    id: string;
    defaultCurrency: string;
    dateFormat: string;
    theme: 'light' | 'dark' | 'auto';
    // Price API Settings - supports multiple providers
    priceApiProviders?: PriceApiProvider[]; // Multiple providers with priorities
    priceApiAutoRefresh?: boolean;
    priceApiRefreshInterval?: number; // in minutes
    priceApiLastRefresh?: Date;
    // Exchange Rate API Settings - supports multiple providers
    exchangeRateApiProviders?: ExchangeRateApiProvider[]; // Multiple providers with priorities
    exchangeRateAutoRefresh?: boolean;
    exchangeRateRefreshInterval?: number; // in minutes
    exchangeRateLastRefresh?: Date;
    // Legacy fields (deprecated, keep for migration)
    priceApiProvider?: 'twelvedata' | 'alphavantage' | 'yahoo' | 'none';
    priceApiKey?: string;
}