/**
 * Application-wide constants
 */

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
} as const;

// Categorization
export const CATEGORIZATION = {
  MAX_REASONABLE_SCORE: 100,
  MIN_CONFIDENCE_THRESHOLD: 50,
} as const;

// Special IDs
export const UNCATEGORIZED_GROUP_ID = 'uncategorized';
