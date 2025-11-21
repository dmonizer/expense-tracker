import type { Pattern, PatternWord } from '../types';

/**
 * Check if two arrays contain the same elements (order-independent)
 */
function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
}

/**
 * Check if two patterns have the same fields array
 */
export function arePatternsFieldsEqual(pattern1: Pattern, pattern2: Pattern): boolean {
    const fields1 = pattern1.fields || (pattern1.field ? [pattern1.field] : []);
    const fields2 = pattern2.fields || (pattern2.field ? [pattern2.field] : []);
    return arraysEqual(fields1, fields2);
}

/**
 * Deduplicate pattern words based on text (case-insensitive)
 */
function deduplicateWords(words: PatternWord[]): PatternWord[] {
    const seen = new Map<string, PatternWord>();
    for (const word of words) {
        const key = word.text.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, word);
        }
    }
    return Array.from(seen.values());
}

/**
 * Merge two wordlist patterns with the same fields
 */
function mergeWordlistPatterns(existing: Pattern, newPattern: Pattern): Pattern {
    const existingWords = existing.words || [];
    const newWords = newPattern.words || [];

    // Combine and deduplicate words
    const mergedWords = deduplicateWords([...existingWords, ...newWords]);

    // Use the higher weight
    const weight = Math.max(existing.weight, newPattern.weight);

    return {
        ...existing,
        words: mergedWords,
        weight,
    };
}

/**
 * Merge new patterns into existing patterns array
 * 
 * For each new pattern:
 * 1. Find existing pattern with matching fields array
 * 2. If found and both are wordlist type:
 *    - Merge words arrays (deduplicate)
 *    - Keep the higher weight
 * 3. If not found or incompatible types:
 *    - Add as new pattern
 * 
 * @param existingPatterns - Current patterns in the rule
 * @param newPatterns - New patterns to add/merge
 * @returns Merged patterns array
 */
export function mergePatterns(
    existingPatterns: Pattern[],
    newPatterns: Pattern[]
): Pattern[] {
    const result = [...existingPatterns];

    for (const newPattern of newPatterns) {
        // Find existing pattern with matching fields
        const existingIndex = result.findIndex(
            (existing) =>
                arePatternsFieldsEqual(existing, newPattern) &&
                existing.matchType === 'wordlist' &&
                newPattern.matchType === 'wordlist'
        );

        if (existingIndex !== -1) {
            // Merge with existing pattern
            result[existingIndex] = mergeWordlistPatterns(result[existingIndex], newPattern);
        } else {
            // Add as new pattern
            result.push(newPattern);
        }
    }

    return result;
}
