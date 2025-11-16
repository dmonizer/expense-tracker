/**
 * Error handling utilities for consistent error management across the application
 */

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
  timestamp: Date;
}

/**
 * Converts various error types to a standardized AppError format
 */
export function normalizeError(error: unknown): AppError {
  const timestamp = new Date();

  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      details: error.stack,
      timestamp
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      timestamp
    };
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: String(error.message),
      code: 'code' in error ? String(error.code) : undefined,
      details: error,
      timestamp
    };
  }

  return {
    message: 'An unknown error occurred',
    details: error,
    timestamp
  };
}

/**
 * Logs an error to the console with additional context
 */
export function logError(error: unknown, context?: string): void {
  const normalizedError = normalizeError(error);

  console.error(
    `[${normalizedError.timestamp.toISOString()}]${context ? ` ${context}:` : ''}`,
    normalizedError.message,
    normalizedError.details
  );
}

/**
 * Gets a user-friendly error message from an error object
 */
export function getUserMessage(error: unknown): string {
  const normalized = normalizeError(error);

  // Map specific error codes to user-friendly messages
  if (normalized.code === 'ConstraintError') {
    return 'This item already exists in the database.';
  }

  if (normalized.code === 'QuotaExceededError') {
    return 'Storage quota exceeded. Please free up some space.';
  }

  if (normalized.code === 'NetworkError') {
    return 'Network error. Please check your connection.';
  }

  // Return the error message, but sanitize it for user display
  return normalized.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverityType = typeof ErrorSeverity[keyof typeof ErrorSeverity];

/**
 * Determines the severity of an error
 */
export function getErrorSeverity(error: unknown): ErrorSeverityType {
  const normalized = normalizeError(error);

  if (normalized.code === 'ConstraintError') {
    return ErrorSeverity.WARNING;
  }

  if (normalized.code === 'QuotaExceededError') {
    return ErrorSeverity.CRITICAL;
  }

  return ErrorSeverity.ERROR;
}

/**
 * Handles an error by logging it and optionally showing a user message
 *
 * @param error - The error to handle
 * @param context - Optional context description
 * @param options - Handler options
 * @returns The user-friendly error message
 */
export function handleError(
  error: unknown,
  context?: string,
  options?: {
    showAlert?: boolean;
    rethrow?: boolean;
  }
): string {
  const { showAlert = false, rethrow = false } = options || {};

  // Log the error
  logError(error, context);

  // Get user-friendly message
  const userMessage = getUserMessage(error);

  // Optionally show alert
  if (showAlert) {
    alert(userMessage);
  }

  // Optionally rethrow
  if (rethrow) {
    throw error;
  }

  return userMessage;
}

/**
 * Wraps an async function with error handling
 *
 * @param fn - The async function to wrap
 * @param context - Optional context description
 * @param onError - Optional error callback
 * @returns Wrapped function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string,
  onError?: (error: AppError) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const normalizedError = normalizeError(error);
      logError(error, context);

      if (onError) {
        onError(normalizedError);
      } else {
        throw error;
      }
    }
  }) as T;
}
