/**
 * Date utility functions for consistent date handling across the application.
 */

/**
 * Normalizes a date to the start of the day (00:00:00.000)
 *
 * @param date - Date to normalize
 * @returns New date set to start of day
 */
export function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Normalizes a date to the end of the day (23:59:59.999)
 *
 * @param date - Date to normalize
 * @returns New date set to end of day
 */
export function endOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

/**
 * Checks if a date is within a range (inclusive).
 *
 * @param date - Date to check
 * @param from - Start of range (inclusive)
 * @param to - End of range (inclusive)
 * @returns true if date is within range
 */
export function isDateInRange(date: Date, from?: Date, to?: Date): boolean {
  if (from && date < startOfDay(from)) {
    return false;
  }

  if (to && date > endOfDay(to)) {
    return false;
  }

  return true;
}

/**
 * Gets the start and end dates for common date ranges.
 *
 * @param range - Predefined range type
 * @returns Object with from and to dates
 */
export function getDateRangePreset(range: 'today' | 'week' | 'month' | 'year' | 'all'): {
  from?: Date;
  to?: Date;
} {
  const now = new Date();
  const today = startOfDay(now);

  switch (range) {
    case 'today':
      return { from: today, to: endOfDay(now) };

    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: weekAgo, to: endOfDay(now) };
    }

    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: monthStart, to: endOfDay(now) };
    }

    case 'year': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { from: yearStart, to: endOfDay(now) };
    }

    case 'all':
    default:
      return { from: undefined, to: undefined };
  }
}
