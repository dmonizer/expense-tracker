// Dropbox Backup Provider - Worker Compatible Version
// This version only includes upload functionality for use in Web Workers
// Authentication and listing/downloading must be done in the main thread

import {logger} from '@/utils';
import type {BackupMetadata} from '@/types/backupTypes.ts';

const DROPBOX_UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';

/**
 * Save backup to Dropbox
 * This function only uses fetch() and is safe to use in Web Workers
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
