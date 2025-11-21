// Price API Provider Types
export type PriceApiProviderType = 'twelvedata' | 'alphavantage' | 'yahoo';

export interface PriceApiProvider {
    type: PriceApiProviderType;
    apiKey: string;
    enabled: boolean;
    priority: number; // Lower number = higher priority (try first)
}

// Exchange Rate API Provider Types
export type ExchangeRateApiProviderType = 'exchangerate-api' | 'fixer' | 'ecb' | 'openexchangerates';

export interface ExchangeRateApiProvider {
    type: ExchangeRateApiProviderType;
    apiKey?: string; // Optional - some APIs don't need keys (like ECB)
    enabled: boolean;
    priority: number; // Lower number = higher priority (try first)
}
