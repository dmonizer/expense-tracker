/**
 * Account Type Utilities
 * Helper functions for account type display, styling, and ordering
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export const ACCOUNT_TYPE_ORDER: Record<AccountType, number> = {
  asset: 1,
  liability: 2,
  equity: 3,
  income: 4,
  expense: 5,
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  asset: '🏦',
  liability: '💳',
  equity: '⚖️',
  income: '💰',
  expense: '💸',
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-800',
  liability: 'bg-red-100 text-red-800',
  equity: 'bg-purple-100 text-purple-800',
  income: 'bg-green-100 text-green-800',
  expense: 'bg-orange-100 text-orange-800',
};

/**
 * Get the icon for an account type
 */
export function getAccountTypeIcon(type: AccountType): string {
  return ACCOUNT_TYPE_ICONS[type];
}

/**
 * Get the human-readable label for an account type
 */
export function getAccountTypeLabel(type: AccountType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Get the badge color classes for an account type
 */
export function getAccountTypeBadgeColor(type: AccountType): string {
  return ACCOUNT_TYPE_COLORS[type];
}

/**
 * Get the sort order for an account type
 */
export function getAccountTypeOrder(type: AccountType): number {
  return ACCOUNT_TYPE_ORDER[type];
}

/**
 * Sort accounts by type and name
 */
export function sortAccountsByTypeAndName<T extends { type: AccountType; name: string }>(
  accounts: T[]
): T[] {
  return [...accounts].sort((a, b) => {
    const typeOrderDiff = getAccountTypeOrder(a.type) - getAccountTypeOrder(b.type);
    if (typeOrderDiff !== 0) {
      return typeOrderDiff;
    }
    return a.name.localeCompare(b.name);
  });
}
