import Papa from 'papaparse';
import type {ImportFormatDefinition, TransactionField} from '../types';
import {getAllFormats, getDefaultFormat} from './formatManager';
import {logger} from '../utils';

/**
 * Detection score for a format
 */
interface DetectionScore {
    format: ImportFormatDefinition;
    score: number;
    matchedCriteria: string[];
}

/**
 * Detect the best matching format for a given file
 *
 * Detection criteria (in order of importance):
 * 1. Filename pattern match (20 points)
 * 2. Header pattern match (60 points)
 * 3. Sample row pattern match (20 points)
 *
 * Threshold: 50 points required for auto-detection
 */
export async function detectFormat(file: File): Promise<ImportFormatDefinition | null> {
    const formats = await getAllFormats();

    // Filter formats with detection patterns
    const detectableFormats = formats.filter(f => f.detectionPattern);

    if (detectableFormats.length === 0) {
        // No detectable formats, return default if available
        return await getDefaultFormat() || null;
    }

    // Parse file preview to get headers
    const preview = await parseFilePreview(file);
    if (!preview) {
        return await getDefaultFormat() || null;
    }

    // Score each format
    const scores: DetectionScore[] = [];

    for (const format of detectableFormats) {
        const score = scoreFormat(file.name, preview, format);
        if (score.score > 0) {
            scores.push(score);
        }
    }

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Return best match if score is above threshold
    const DETECTION_THRESHOLD = 50;
    const bestMatch = scores[0];

    if (bestMatch && bestMatch.score >= DETECTION_THRESHOLD) {
        logger.info(`[FormatDetector] Detected format: ${bestMatch.format.name} (score: ${bestMatch.score}, criteria: ${bestMatch.matchedCriteria.join(', ')})`);
        return bestMatch.format;
    }

    // No confident match, return default
    logger.info('[FormatDetector] No confident match found, using default format');
    return await getDefaultFormat() || null;
}

/**
 * Parse file preview to extract headers and sample data
 */
async function parseFilePreview(file: File): Promise<{ headers: string[]; rows: string[][] } | null> {
    return new Promise((resolve) => {
        Papa.parse(file, {
            preview: 5, // Parse first 5 rows
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as string[][];
                if (data.length === 0) {
                    resolve(null);
                    return;
                }

                // Assume first row is headers
                resolve({
                    headers: data[0],
                    rows: data.slice(1),
                });
            },
            error: () => {
                resolve(null);
            },
        });
    });
}

/**
 * Score a format against file data
 */
function scoreFormat(
    fileName: string,
    preview: { headers: string[]; rows: string[][] },
    format: ImportFormatDefinition
): DetectionScore {
    let score = 0;
    const matchedCriteria: string[] = [];
    const pattern = format.detectionPattern;

    if (!pattern) {
        return {format, score: 0, matchedCriteria: []};
    }

    // 1. Filename pattern (20 points)
    if (pattern.fileNamePattern) {
        try {
            const regex = new RegExp(pattern.fileNamePattern, 'i');
            if (regex.test(fileName)) {
                score += 20;
                matchedCriteria.push('filename');
            }
        } catch (error) {
            logger.warn('Invalid filename pattern regex:', error);
        }
    }

    // 2. Header pattern (60 points)
    if (pattern.headerPattern && pattern.headerPattern.length > 0) {
        const headerScore = scoreHeaderMatch(preview.headers, pattern.headerPattern);
        score += headerScore;
        if (headerScore > 0) {
            matchedCriteria.push(`headers (${headerScore}/60)`);
        }
    }

    // 3. Sample row pattern (20 points) - Not implemented yet
    // Could be added later for more sophisticated detection

    return {format, score, matchedCriteria};
}

/**
 * Score header match
 *
 * Returns 0-60 points based on how many expected headers are found
 */
function scoreHeaderMatch(fileHeaders: string[], expectedHeaders: string[]): number {
    if (expectedHeaders.length === 0) {
        return 0;
    }

    // Normalize headers for comparison
    const normalizedFileHeaders = fileHeaders.map(h => h.toLowerCase().trim());
    const normalizedExpectedHeaders = expectedHeaders.map(h => h.toLowerCase().trim());

    // Count matches
    let matches = 0;
    for (const expected of normalizedExpectedHeaders) {
        if (normalizedFileHeaders.includes(expected)) {
            matches++;
        }
    }

    // Calculate percentage and convert to score (0-60)
    const percentage = matches / normalizedExpectedHeaders.length;
    return Math.round(percentage * 60);
}

/**
 * Validate if a file can be parsed with a specific format
 * Useful for testing before actual import
 */
export async function validateFormat(
    file: File,
    format: ImportFormatDefinition
): Promise<{ valid: boolean; error?: string }> {
    try {
        // Try parsing a small preview
        const preview = await parseFilePreview(file);

        if (!preview) {
            return {valid: false, error: 'Could not parse file'};
        }

        // Check if required fields can be mapped
        const requiredFields: TransactionField[] = ['date', 'amount', 'payee', 'description', 'currency', 'type'];
        const mappedFields = format.fieldMappings
            .filter(m => m.required)
            .map(m => m.targetField);

        const missingFields = requiredFields.filter(f => !mappedFields.includes(f));

        if (missingFields.length > 0) {
            return {
                valid: false,
                error: `Missing required field mappings: ${missingFields.join(', ')}`
            };
        }

        return {valid: true};
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Validation error'
        };
    }
}
