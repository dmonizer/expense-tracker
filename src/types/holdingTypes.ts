import type {PriceApiProviderType} from "@/types/apiSettingsTypes.ts";

export type HoldingType = 'stock' | 'fund' | 'etf' | 'bond' | 'crypto' | 'other';

/**
 * Holding represents a security/instrument held in an investment account
 * (stocks, funds, crypto, etc.)
 */
export interface Holding {
    id: string;
    accountId: string; // Link to the account that holds this
    symbol: string; // Ticker symbol or identifier (e.g., "SWED-A", "AAPL", "BTC")
    name?: string; // Full name (e.g., "Swedbank AB Class A")
    type: HoldingType;
    quantity: number; // Number of shares/units
    purchasePrice: number; // Average purchase price per unit
    purchaseCurrency: string; // Currency of purchase price
    purchaseDate?: Date; // When acquired
    currentPrice?: number; // Latest fetched price
    currentPriceCurrency?: string; // Currency of current price
    currentPriceDate?: Date; // When the price was last updated
    priceApiProvider?: PriceApiProviderType; // Which provider successfully fetched the price
    notes?: string; // User notes
    createdAt: Date;
    updatedAt: Date;
}