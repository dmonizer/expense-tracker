// Dropbox Backup Provider
// Handles OAuth authentication and file operations with Dropbox API

import {logger} from '@/utils';
import type {BackupMetadata, CloudProviderConfig} from '@/types/backupTypes.ts';

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DROPBOX_LIST_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const DROPBOX_DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const REDIRECT_URI = window.location.origin;

/**
 * Authenticate with Dropbox using OAuth 2.0 (implicit grant flow)
 */
export async function authenticate(config: CloudProviderConfig): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            if (!config.clientId) {
                reject(new Error('Dropbox App Key not configured'));
                return;
            }

            logger.info('[Dropbox] Starting OAuth authentication');

            // Generate state for CSRF protection
            const state = Math.random().toString(36).substring(7);

            // Build OAuth URL (using implicit grant flow for browser apps)
            const params = new URLSearchParams({
                client_id: config.clientId,
                redirect_uri: REDIRECT_URI,
                response_type: 'token',
                state: state,
            });

            const authUrl = `${DROPBOX_AUTH_URL}?${params.toString()}`;

            // Open popup for OAuth
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                authUrl,
                'Dropbox Authentication',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                reject(new Error('Failed to open authentication popup. Please allow popups for this site.'));
                return;
            }

            // Listen for OAuth callback
            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'dropbox-oauth-callback') {
                    window.removeEventListener('message', handleMessage);

                    if (event.data.error) {
                        logger.error('[Dropbox] OAuth error:', event.data.error);
                        reject(new Error(event.data.error));
                    } else if (event.data.accessToken) {
                        logger.info('[Dropbox] OAuth authentication successful');
                        resolve(event.data.accessToken);
                    }
                }
            };

            window.addEventListener('message', handleMessage);

            // Check if popup was closed
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', handleMessage);
                    reject(new Error('Authentication cancelled'));
                }
            }, 1000);
        } catch (error) {
            logger.error('[Dropbox] Authentication failed:', error);
            reject(error);
        }
    });
}

/**
 * Save backup to Dropbox
 */
export async function saveBackup(
    data: string,
    metadata: BackupMetadata,
    accessToken: string
): Promise<void> {
    try {
        logger.info('[Dropbox] Uploading backup', { id: metadata.id });

        const filename = `expense-tracker-backup-${metadata.timestamp.toISOString().split('T')[0]}.json`;
        const path = `/expense-tracker-backups/${filename}`;

        const response = await fetch(DROPBOX_UPLOAD_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                    path: path,
                    mode: 'add',
                    autorename: true,
                    mute: false,
                }),
            },
            body: data,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
        }

        const result = await response.json();
        logger.info('[Dropbox] Backup uploaded successfully', { path: result.path_display });
    } catch (error) {
        logger.error('[Dropbox] Failed to save backup:', error);
        throw new Error('Failed to save to Dropbox: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * List available backups from Dropbox
 */
export async function listBackups(accessToken: string): Promise<BackupMetadata[]> {
    try {
        logger.info('[Dropbox] Listing backups');

        const response = await fetch(DROPBOX_LIST_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: '/expense-tracker-backups',
                recursive: false,
            }),
        });

        if (!response.ok) {
            // Folder might not exist yet
            if (response.status === 409) {
                logger.info('[Dropbox] Backup folder does not exist yet');
                return [];
            }
            throw new Error('Failed to list backups');
        }

        const result = await response.json();
        const backups: BackupMetadata[] = result.entries
            .filter((entry: any) => entry['.tag'] === 'file' && entry.name.includes('expense-tracker-backup'))
            .map((file: any) => ({
                id: file.id,
                timestamp: new Date(file.client_modified),
                size: file.size,
                encrypted: file.name.includes('encrypted'),
                provider: 'dropbox' as const,
                databaseVersion: 0,
                includedLogs: true,
                tablesIncluded: [],
            }));

        logger.info('[Dropbox] Found backups', { count: backups.length });
        return backups;
    } catch (error) {
        logger.error('[Dropbox] Failed to list backups:', error);
        throw error;
    }
}

/**
 * Load backup from Dropbox
 */
export async function loadBackup(
    path: string,
    accessToken: string
): Promise<{ data: string; metadata: BackupMetadata }> {
    try {
        logger.info('[Dropbox] Downloading backup', { path });

        const response = await fetch(DROPBOX_DOWNLOAD_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({ path }),
            },
        });

        if (!response.ok) {
            throw new Error('Failed to download backup');
        }

        const data = await response.text();

        // Parse metadata from data
        const parsed = JSON.parse(data);
        const metadata: BackupMetadata = parsed.metadata || {
            id: path,
            timestamp: new Date(),
            size: data.length,
            encrypted: false,
            provider: 'dropbox',
            databaseVersion: 0,
            includedLogs: true,
            tablesIncluded: Object.keys(parsed),
        };

        logger.info('[Dropbox] Backup downloaded successfully');
        return { data, metadata };
    } catch (error) {
        logger.error('[Dropbox] Failed to load backup:', error);
        throw error;
    }
}
