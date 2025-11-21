// Backup and Restore Types

export type BackupProvider = 'local' | 'googledrive' | 'dropbox';

export interface BackupSettings {
    enabled: boolean;
    interval: number; // in minutes
    providers: BackupProvider[];
    encryptionKey?: string;
    includeLogs: boolean;
    lastRun?: Date;
}

export interface BackupMetadata {
    id: string;
    timestamp: Date;
    size: number; // in bytes
    encrypted: boolean;
    provider: BackupProvider;
    databaseVersion: number;
    includedLogs: boolean;
    tablesIncluded: string[];
}

export interface BackupRecord {
    id: string;
    timestamp: Date;
    provider: BackupProvider;
    success: boolean;
    encrypted: boolean;
    size?: number;
    error?: string;
    metadata?: BackupMetadata;
}

export interface CloudProviderConfig {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    connected: boolean;
}

export interface BackupData {
    metadata: BackupMetadata;
    data: {
        [tableName: string]: unknown[];
    };
}
