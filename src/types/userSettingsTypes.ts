// User Settings Types
import type { ExchangeRateApiProvider, PriceApiProvider } from "@/types/apiSettingsTypes.ts";
import type { BackupProvider, CloudProviderConfig } from "@/types/backupTypes.ts";

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
    // Backup Settings
    backupEnabled?: boolean;
    backupInterval?: number; // in minutes
    backupProviders?: BackupProvider[];
    backupEncryptionKey?: string;
    backupIncludeLogs?: boolean;
    backupLastRun?: Date;
    googleDriveConfig?: CloudProviderConfig;
    dropboxConfig?: CloudProviderConfig;
    // Legacy fields (deprecated, keep for migration)
    priceApiProvider?: 'twelvedata' | 'alphavantage' | 'yahoo' | 'none';
    priceApiKey?: string;
}