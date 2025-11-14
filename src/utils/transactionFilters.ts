import type { Transaction, CategoryRule, TransactionFilters } from '../types';
import { UNCATEGORIZED_GROUP_ID } from '../constants';

/**
 * Checks if a transaction matches the group filter.
 * Handles the special case of UNCATEGORIZED_GROUP_ID.
 *
 * @param transaction - Transaction to check
 * @param selectedGroups - Array of selected group IDs
 * @param categoryRules - All category rules for group lookup
 * @returns true if transaction matches the group filter
 */
export function matchesGroupFilter(
  transaction: Transaction,
  selectedGroups: string[],
  categoryRules: CategoryRule[]
): boolean {
  const txCategory = transaction.category;
  const isUncategorized = !txCategory || txCategory === 'Uncategorized';

  // Check if UNCATEGORIZED_GROUP_ID is selected
  if (selectedGroups.includes(UNCATEGORIZED_GROUP_ID)) {
    // If transaction is uncategorized, it matches
    if (isUncategorized) {
      return true;
    }

    // Check if transaction's category is in one of the other selected groups
    const txCategoryRule = categoryRules.find(rule => rule.name === txCategory);
    const txGroupId = txCategoryRule?.groupId;

    // If no other groups selected besides uncategorized, filter out this transaction
    const otherGroups = selectedGroups.filter(g => g !== UNCATEGORIZED_GROUP_ID);
    if (otherGroups.length === 0) {
      return false;
    }

    // Transaction must be in one of the other selected groups
    return txGroupId ? otherGroups.includes(txGroupId) : false;
  } else {
    // Normal group filtering (no UNCATEGORIZED_GROUP_ID)
    if (isUncategorized) {
      return false; // Uncategorized transactions don't match any normal group
    }

    const txCategoryRule = categoryRules.find(rule => rule.name === txCategory);
    const txGroupId = txCategoryRule?.groupId;

    return txGroupId ? selectedGroups.includes(txGroupId) : false;
  }
}

/**
 * Checks if a transaction matches the date range filter.
 * Normalizes dates to ensure proper comparison.
 *
 * @param transaction - Transaction to check
 * @param dateFrom - Start date (inclusive)
 * @param dateTo - End date (inclusive)
 * @returns true if transaction is within the date range
 */
export function matchesDateRange(
  transaction: Transaction,
  dateFrom?: Date,
  dateTo?: Date
): boolean {
  if (dateFrom) {
    const txDate = new Date(transaction.date);
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    if (txDate < fromDate) return false;
  }

  if (dateTo) {
    const txDate = new Date(transaction.date);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    if (txDate > toDate) return false;
  }

  return true;
}

/**
 * Checks if a transaction matches the category filter.
 *
 * @param transaction - Transaction to check
 * @param categories - Array of category names to match
 * @returns true if transaction matches one of the categories
 */
export function matchesCategoryFilter(
  transaction: Transaction,
  categories?: string[]
): boolean {
  if (!categories || categories.length === 0) {
    return true;
  }

  const txCategory = transaction.category || 'Uncategorized';
  return categories.includes(txCategory);
}

/**
 * Checks if a transaction matches the amount range filter.
 *
 * @param transaction - Transaction to check
 * @param minAmount - Minimum amount (inclusive, absolute value)
 * @param maxAmount - Maximum amount (inclusive, absolute value)
 * @returns true if transaction amount is within range
 */
export function matchesAmountRange(
  transaction: Transaction,
  minAmount?: number,
  maxAmount?: number
): boolean {
  const absAmount = Math.abs(transaction.amount);

  if (minAmount !== undefined && absAmount < minAmount) {
    return false;
  }

  return !(maxAmount !== undefined && absAmount > maxAmount);


}

/**
 * Checks if a transaction matches the transaction type filter.
 *
 * @param transaction - Transaction to check
 * @param transactionType - Type to filter by: 'income', 'expense', or 'both'
 * @returns true if transaction matches the type
 */
export function matchesTransactionType(
  transaction: Transaction,
  transactionType?: 'income' | 'expense' | 'both'
): boolean {
  if (!transactionType || transactionType === 'both') {
    return true;
  }

  const txType = transaction.type === 'credit' ? 'income' : 'expense';
  return txType === transactionType;
}

/**
 * Checks if a transaction matches the search query.
 * Searches in both payee and description fields (case-insensitive).
 *
 * @param transaction - Transaction to check
 * @param searchQuery - Search text
 * @returns true if transaction matches the search
 */
export function matchesSearchQuery(
  transaction: Transaction,
  searchQuery?: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) {
    return true;
  }

  const query = searchQuery.toLowerCase();
  const payeeMatch = transaction.payee.toLowerCase().includes(query);
  const descMatch = transaction.description.toLowerCase().includes(query);

  return payeeMatch || descMatch;
}

/**
 * Checks if a transaction matches the currency filter.
 *
 * @param transaction - Transaction to check
 * @param currencies - Array of currency codes to match
 * @returns true if transaction matches one of the currencies
 */
export function matchesCurrencyFilter(
  transaction: Transaction,
  currencies?: string[]
): boolean {
  if (!currencies || currencies.length === 0) {
    return true;
  }

  return currencies.includes(transaction.currency);
}

/**
 * Applies all filters to a transaction.
 * Central filtering function that uses all individual filter functions.
 *
 * @param transaction - Transaction to check
 * @param filters - Filter criteria to apply
 * @param categoryRules - All category rules (needed for group filtering)
 * @returns true if transaction passes all filters
 */
export function applyAllFilters(
  transaction: Transaction,
  filters: TransactionFilters,
  categoryRules?: CategoryRule[]
): boolean {
  // Exclude ignored transactions
  if (transaction.ignored) {
    return false;
  }

  // Date range filter
  if (!matchesDateRange(transaction, filters.dateFrom, filters.dateTo)) {
    return false;
  }

  // Category filter
  if (!matchesCategoryFilter(transaction, filters.categories)) {
    return false;
  }

  // Group filter
  if (filters.groups && filters.groups.length > 0 && categoryRules) {
    if (!matchesGroupFilter(transaction, filters.groups, categoryRules)) {
      return false;
    }
  }

  // Amount range filter
  if (!matchesAmountRange(transaction, filters.minAmount, filters.maxAmount)) {
    return false;
  }

  // Transaction type filter
  if (!matchesTransactionType(transaction, filters.transactionType)) {
    return false;
  }

  // Currency filter
  if (!matchesCurrencyFilter(transaction, filters.currencies)) {
    return false;
  }

  // Search query filter
  if (!matchesSearchQuery(transaction, filters.searchQuery)) {
    return false;
  }

  return true;
}

/**
 * Filters an array of transactions based on the provided filters.
 *
 * @param transactions - Array of transactions to filter
 * @param filters - Filter criteria to apply
 * @param categoryRules - All category rules (needed for group filtering)
 * @returns Filtered array of transactions
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  categoryRules?: CategoryRule[]
): Transaction[] {
  return transactions.filter(transaction =>
    applyAllFilters(transaction, filters, categoryRules)
  );
}

/**
 * Sorts transactions based on the provided sort field and direction.
 *
 * @param transactions - Array of transactions to sort
 * @param sortField - Field to sort by
 * @param sortDirection - Sort direction ('asc' or 'desc')
 * @returns Sorted array of transactions
 */
export function sortTransactions(
  transactions: Transaction[],
  sortField: 'date' | 'amount' | 'payee' | 'category' | 'description' = 'date',
  sortDirection: 'asc' | 'desc' = 'desc'
): Transaction[] {
  return [...transactions].sort((a, b) => {
    let compareValue = 0;

    switch (sortField) {
      case 'date':
        compareValue = a.date.getTime() - b.date.getTime();
        break;
      case 'amount':
        compareValue = Math.abs(a.amount) - Math.abs(b.amount);
        break;
      case 'payee':
        compareValue = a.payee.localeCompare(b.payee);
        break;
      case 'category':
        compareValue = (a.category || '').localeCompare(b.category || '');
        break;
      case 'description':
        compareValue = a.description.localeCompare(b.description);
        break;
    }

    return sortDirection === 'asc' ? compareValue : -compareValue;
  });
}

/**
 * Filters and sorts transactions in one operation.
 *
 * @param transactions - Array of transactions to filter and sort
 * @param filters - Filter criteria to apply
 * @param categoryRules - All category rules (needed for group filtering)
 * @returns Filtered and sorted array of transactions
 */
export function filterAndSortTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  categoryRules?: CategoryRule[]
): Transaction[] {
  const filtered = filterTransactions(transactions, filters, categoryRules);
  return sortTransactions(
    filtered,
    filters.sortField,
    filters.sortDirection
  );
}
