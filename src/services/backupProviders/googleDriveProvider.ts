// Google Drive Backup Provider
// Handles OAuth authentication and file operations with Google Drive API

import {logger} from '@/utils';
import type {BackupMetadata, CloudProviderConfig} from '@/types/backupTypes.ts';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT_URI = window.location.origin;

/**
 * Authenticate with Google Drive using OAuth 2.0
 */
export async function authenticate(config: CloudProviderConfig): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            if (!config.clientId) {
                reject(new Error('Google Drive Client ID not configured'));
                return;
            }

            logger.info('[GoogleDrive] Starting OAuth authentication');

            // Generate state for CSRF protection
            const state = Math.random().toString(36).substring(7);

            // Build OAuth URL
            const params = new URLSearchParams({
                client_id: config.clientId,
                redirect_uri: REDIRECT_URI,
                response_type: 'token',
                scope: SCOPES,
                state: state,
            });

            const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

            // Open popup for OAuth
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                authUrl,
                'Google Drive Authentication',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                reject(new Error('Failed to open authentication popup. Please allow popups for this site.'));
                return;
            }

            // Listen for OAuth callback
            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'google-oauth-callback') {
                    window.removeEventListener('message', handleMessage);

                    if (event.data.error) {
                        logger.error('[GoogleDrive] OAuth error:', event.data.error);
                        reject(new Error(event.data.error));
                    } else if (event.data.accessToken) {
                        logger.info('[GoogleDrive] OAuth authentication successful');
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
            logger.error('[GoogleDrive] Authentication failed:', error);
            reject(error);
        }
    });
}

/**
 * Save backup to Google Drive
 */
export async function saveBackup(
    data: string,
    metadata: BackupMetadata,
    accessToken: string
): Promise<void> {
    try {
        logger.info('[GoogleDrive] Uploading backup', { id: metadata.id });

        // Create file metadata
        const fileMetadata = {
            name: `expense-tracker-backup-${metadata.timestamp.toISOString().split('T')[0]}.json`,
            mimeType: 'application/json',
        };

        // Create multipart request body
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(fileMetadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            data +
            closeDelimiter;

        // Upload file
        const response = await fetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
        }

        const result = await response.json();
        logger.info('[GoogleDrive] Backup uploaded successfully', { fileId: result.id });
    } catch (error) {
        logger.error('[GoogleDrive] Failed to save backup:', error);
        throw new Error('Failed to save to Google Drive: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * List available backups from Google Drive
 */
export async function listBackups(accessToken: string): Promise<BackupMetadata[]> {
    try {
        logger.info('[GoogleDrive] Listing backups');

        const params = new URLSearchParams({
            q: "name contains 'expense-tracker-backup' and mimeType='application/json'",
            fields: 'files(id, name, size, createdTime)',
            orderBy: 'createdTime desc',
        });

        const response = await fetch(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to list backups');
        }

        const result = await response.json();
        const backups: BackupMetadata[] = result.files.map((file: any) => ({
            id: file.id,
            timestamp: new Date(file.createdTime),
            size: parseInt(file.size),
            encrypted: file.name.includes('encrypted'),
            provider: 'googledrive' as const,
            databaseVersion: 0,
            includedLogs: true,
            tablesIncluded: [],
        }));

        logger.info('[GoogleDrive] Found backups', { count: backups.length });
        return backups;
    } catch (error) {
        logger.error('[GoogleDrive] Failed to list backups:', error);
        throw error;
    }
}

/**
 * Load backup from Google Drive
 */
export async function loadBackup(
    fileId: string,
    accessToken: string
): Promise<{ data: string; metadata: BackupMetadata }> {
    try {
        logger.info('[GoogleDrive] Downloading backup', { fileId });

        const response = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to download backup');
        }

        const data = await response.text();

        // Parse metadata from data
        const parsed = JSON.parse(data);
        const metadata: BackupMetadata = parsed.metadata || {
            id: fileId,
            timestamp: new Date(),
            size: data.length,
            encrypted: false,
            provider: 'googledrive',
            databaseVersion: 0,
            includedLogs: true,
            tablesIncluded: Object.keys(parsed),
        };

        logger.info('[GoogleDrive] Backup downloaded successfully');
        return { data, metadata };
    } catch (error) {
        logger.error('[GoogleDrive] Failed to load backup:', error);
        throw error;
    }
}
