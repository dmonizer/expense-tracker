import { convertCurrency } from '../services/exchangeRateManager';
import { logger } from './logger';

/**
 * Currency utility functions
 * Phase 2: Multi-currency support
 */

/**
 * Common currency symbols
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CHF: 'CHF',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  RUB: '₽',
  UAH: '₴',
  TRY: '₺',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  ZAR: 'R',
  KRW: '₩',
  SGD: 'S$',
  HKD: 'HK$',
  THB: '฿',
  IDR: 'Rp',
  MYR: 'RM',
  PHP: '₱',
  VND: '₫',
};

/**
 * Get currency symbol or code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}

/**
 * Format amount with currency
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options?: {
    showSymbol?: boolean;
    decimals?: number;
    showCode?: boolean;
  }
): string {
  const {
    showSymbol = true,
    decimals = 2,
    showCode = false,
  } = options || {};

  const formattedAmount = amount.toFixed(decimals);
  const symbol = getCurrencySymbol(currency);
  
  if (showSymbol && symbol !== currency) {
    return `${symbol}${formattedAmount}`;
  }
  
  if (showCode) {
    return `${formattedAmount} ${currency}`;
  }
  
  return `${formattedAmount} ${currency}`;
}

/**
 * Convert and format amount to base currency
 */
export async function convertAndFormat(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date,
  options?: {
    showOriginal?: boolean;
    decimals?: number;
  }
): Promise<string> {
  const { showOriginal = false, decimals = 2 } = options || {};

  if (fromCurrency === toCurrency) {
    return formatCurrency(amount, toCurrency, { decimals });
  }

  const { convertedAmount, rate } = await convertCurrency(
    amount,
    fromCurrency,
    toCurrency,
    date
  );

  if (rate === null) {
    // No conversion rate available
    return `${formatCurrency(amount, fromCurrency, { decimals })} (no rate)`;
  }

  const converted = formatCurrency(convertedAmount, toCurrency, { decimals });

  if (showOriginal) {
    const original = formatCurrency(amount, fromCurrency, { decimals });
    return `${converted} (${original})`;
  }

  return converted;
}

/**
 * Parse currency code from string (e.g., "100 EUR" -> "EUR")
 */
export function parseCurrencyCode(text: string): string | null {
  const match = text.match(/([A-Z]{3})/);
  return match ? match[1] : null;
}

/**
 * Common currencies list for dropdowns
 */
export const COMMON_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
];

/**
 * Validate currency code
 */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Get user's preferred base currency from settings
 * Defaults to EUR if not set
 */
export async function getBaseCurrency(): Promise<string> {
  try {
    const { db } = await import('../services/db');
    const settings = await db.settings.toArray();
    if (settings.length > 0 && settings[0].defaultCurrency) {
      return settings[0].defaultCurrency;
    }
  } catch (error) {
    logger.error('Failed to get base currency:', error);
  }
  return 'EUR'; // Default
}
