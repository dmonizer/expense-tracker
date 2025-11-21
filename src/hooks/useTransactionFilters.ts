import {useMemo} from 'react';
import type {CategoryRule, Transaction, TransactionFilters} from '@/types';
import {filterAndSortTransactions} from '../utils/transactionFilters';

export interface UseTransactionFiltersResult {
  filteredTransactions: Transaction[];
  totalCount: number;
  filteredCount: number;
}

/**
 * Custom hook for filtering and sorting transactions
 *
 * @param transactions - All transactions to filter
 * @param filters - Filter criteria
 * @param categoryRules - Category rules for group filtering
 * @returns Filtered transactions and counts
 */
export function useTransactionFilters(
  transactions: Transaction[] | undefined,
  filters: TransactionFilters,
  categoryRules?: CategoryRule[]
): UseTransactionFiltersResult {
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return filterAndSortTransactions(transactions, filters, categoryRules);
  }, [transactions, filters, categoryRules]);

  const totalCount = transactions?.length || 0;
  const filteredCount = filteredTransactions.length;

  return {
    filteredTransactions,
    totalCount,
    filteredCount
  };
}
