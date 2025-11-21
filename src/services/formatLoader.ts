import { db } from './db';
import type { ImportFormatDefinition } from '../types';
import { logger } from '../utils';

// Import format JSON files
import swedbankEstoniaFormat from '../formats/Swedbank_Estonia_CSV.json';
import sebEstoniaFormat from '../formats/SEB_Estonia_CSV.json';

const BUILT_IN_FORMATS = [
    { id: 'swedbank-estonia-builtin', data: swedbankEstoniaFormat},
    { id: 'seb-estonia-builtin', data: sebEstoniaFormat },
];

/**
 * Initialize built-in formats from JSON files
 */
export async function initializeBuiltInFormats(): Promise<void> {
    for (const { id, data } of BUILT_IN_FORMATS) {
        const existing = await db.importFormats.get(id);

        if (!existing) {
            const now = new Date();
            const format: ImportFormatDefinition = {
                ...data,
                id,
                createdAt: now,
                updatedAt: now,
            } as ImportFormatDefinition;

            try {
                await db.importFormats.add(format);
                logger.info(`[FormatLoader] Initialized built-in format: ${data.name}`);
            } catch (error) {
                if (error instanceof Error && error.name === 'ConstraintError') {
                    logger.info(`[FormatLoader] Format ${data.name} already exists, skipping`);
                } else {
                    throw error;
                }
            }
        } else {
            logger.info(`[FormatLoader] Format ${data.name} already exists`);
        }
    }
}

/**
 * Load user-defined formats from JSON string
 */
export async function loadFormatFromJSON(jsonString: string): Promise<string> {
    logger.debug(`Loading user format from JSON: ${jsonString.substring(0, 100)}...`);
    const data = JSON.parse(jsonString);

    // Validate required fields
    if (!data.name || !data.fileType || !data.fieldMappings) {
        throw new Error('Invalid format data: missing required fields');
    }

    // Use transaction to prevent race conditions (e.g. double invocation)
    return db.transaction('rw', db.importFormats, async () => {
        // Check if format with same name already exists
        const existing = await db.importFormats.where('name').equals(data.name).first();
        if (existing) {
            logger.info(`[FormatLoader] Format ${data.name} already exists, returning existing ID`);
            return existing.id;
        }

        const now = new Date();
        const format: ImportFormatDefinition = {
            ...data,
            id: crypto.randomUUID(),
            isBuiltIn: false,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
        } as ImportFormatDefinition;

        await db.importFormats.add(format);
        logger.info(`[FormatLoader] Loaded user format: ${data.name}`);

        return format.id;
    });
}
