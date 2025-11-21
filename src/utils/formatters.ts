import {format as dateFnsFormat} from 'date-fns';

/**
 * Formats a number as currency with proper locale formatting
 * @param amount - The numeric amount to format
 * @param currency - The currency code (e.g., 'EUR', 'USD')
 * @returns Formatted currency string (e.g., "€12.34")
 * @example
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 * formatCurrency(-50.5, 'USD') // "-$50.50"
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for invalid currency codes
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Formats a Date object using date-fns format function
 * @param date - The date to format
 * @param formatStr - Optional format string (default: "dd.MM.yyyy")
 * @returns Formatted date string
 * @example
 * formatDate(new Date('2024-03-15')) // "15.03.2024"
 * formatDate(new Date('2024-03-15'), 'yyyy-MM-dd') // "2024-03-15"
 */
export function formatDate(date: Date, formatStr: string = 'dd.MM.yyyy'): string {
  try {
    return dateFnsFormat(date, formatStr);
  } catch {
    // Fallback for invalid dates
    return date.toLocaleDateString('et-EE');
  }
}

/**
 * Formats a number with locale-specific formatting
 * @param value - The numeric value to format
 * @param decimals - Optional number of decimal places (default: 2)
 * @returns Formatted number string
 * @example
 * formatNumber(1234.5678) // "1,234.57"
 * formatNumber(1234.5678, 0) // "1,235"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  try {
    return new Intl.NumberFormat('et-EE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Fallback
    return value.toFixed(decimals);
  }
}
