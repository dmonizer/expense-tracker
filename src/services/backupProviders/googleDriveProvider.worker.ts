// Google Drive Backup Provider - Worker Compatible Version
// This version only includes upload functionality for use in Web Workers
// Authentication and listing/downloading must be done in the main thread

import {logger} from '@/utils';
import type {BackupMetadata} from '@/types/backupTypes.ts';

const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Save backup to Google Drive
 * This function only uses fetch() and is safe to use in Web Workers
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
