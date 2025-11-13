import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Transaction, TransactionFilters } from '../../types';
import { db } from '../../services/db';
import TransactionRow from './TransactionRow';
import TransactionEditor from './TransactionEditor';
import Filters from './Filters';
import { UNCATEGORIZED_GROUP_ID } from '../../types';

interface TransactionListProps {
  initialFilters?: TransactionFilters;
}

function TransactionList({ initialFilters }: TransactionListProps = { initialFilters: {} }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({
    ...initialFilters,
    transactionType: initialFilters?.transactionType || 'both',
    sortField: initialFilters?.sortField || 'date',
    sortDirection: initialFilters?.sortDirection || 'desc',
  });

  // Update filters when initialFilters changes
  useEffect(() => {
    if (initialFilters) {
      setFilters(prev => ({
        ...prev,
        ...initialFilters,
      }));
    }
  }, [initialFilters]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const ITEMS_PER_PAGE = 20;

  // Fetch all transactions reactively with useLiveQuery
  const allTransactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    []
  );

  // Fetch all category rules to map categories to groups
  const allCategoryRules = useLiveQuery(
    () => db.categoryRules.toArray(),
    []
  );

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    const filtered = allTransactions.filter((transaction) => {
      // Date range filter
      if (filters.dateFrom) {
        const txDate = new Date(transaction.date);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (txDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const txDate = new Date(transaction.date);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (txDate > toDate) return false;
      }

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        const txCategory = transaction.category || 'Uncategorized';
        if (!filters.categories.includes(txCategory)) return false;
      }

      // Group filter
      if (filters.groups && filters.groups.length > 0 && allCategoryRules) {
        // Check if UNCATEGORIZED_GROUP_ID is selected
        if (filters.groups.includes(UNCATEGORIZED_GROUP_ID)) {
          // If transaction has no category or is 'Uncategorized', it matches
          const isUncategorized = !transaction.category || transaction.category === 'Uncategorized';
          if (isUncategorized) {
            // This transaction matches the uncategorized group filter
          } else {
            // Check if transaction's category is in one of the other selected groups
            const txCategoryRule = allCategoryRules.find(rule => rule.name === transaction.category);
            const txGroupId = txCategoryRule?.groupId;
            
            // If no other groups selected besides uncategorized, filter out this transaction
            const otherGroups = filters.groups.filter(g => g !== UNCATEGORIZED_GROUP_ID);
            if (otherGroups.length === 0 || !txGroupId || !otherGroups.includes(txGroupId)) {
              return false;
            }
          }
        } else {
          // Normal group filtering (no UNCATEGORIZED_GROUP_ID)
          if (!transaction.category || transaction.category === 'Uncategorized') {
            return false; // Uncategorized transactions don't match any normal group
          }
          
          const txCategoryRule = allCategoryRules.find(rule => rule.name === transaction.category);
          const txGroupId = txCategoryRule?.groupId;
          
          if (!txGroupId || !filters.groups.includes(txGroupId)) {
            return false;
          }
        }
      }

      // Amount range filter
      const absAmount = Math.abs(transaction.amount);
      if (filters.minAmount !== undefined && absAmount < filters.minAmount) {
        return false;
      }
      if (filters.maxAmount !== undefined && absAmount > filters.maxAmount) {
        return false;
      }

      // Transaction type filter
      if (filters.transactionType && filters.transactionType !== 'both') {
        const txType = transaction.type === 'credit' ? 'income' : 'expense';
        if (txType !== filters.transactionType) return false;
      }

      // Search query filter (payee or description)
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const payeeMatch = transaction.payee.toLowerCase().includes(query);
        const descMatch = transaction.description.toLowerCase().includes(query);
        if (!payeeMatch && !descMatch) return false;
      }

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const sortField = filters.sortField || 'date';
      const sortDirection = filters.sortDirection || 'desc';
      
      let compareValue = 0;
      
      switch (sortField) {
        case 'date':
          compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'payee':
          compareValue = a.payee.localeCompare(b.payee);
          break;
        case 'amount':
          compareValue = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'category':
          compareValue = (a.category || 'Uncategorized').localeCompare(b.category || 'Uncategorized');
          break;
        case 'description':
          compareValue = a.description.localeCompare(b.description);
          break;
      }
      
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [allTransactions, filters, allCategoryRules]);

  // Paginate filtered transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage]);

  // Calculate pagination info
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const startItem = filteredTransactions.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle category save
  const handleSaveCategory = async (transactionId: string, categoryName: string, ignored?: boolean) => {
    await db.transactions.update(transactionId, {
      category: categoryName || undefined,
      manuallyEdited: true,
      ignored: ignored || false,
    });
  };;

  const handleSort = (field: 'date' | 'payee' | 'amount' | 'category' | 'description') => {
    setFilters(prev => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Loading state
  if (allTransactions === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!allTransactions || allTransactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">No transactions</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by importing a CSV file with your bank transactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <Filters filters={filters} onFiltersChange={setFilters} />

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-600">Showing </span>
            <span className="font-semibold text-gray-900">
              {startItem}-{endItem}
            </span>
            <span className="text-gray-600"> of </span>
            <span className="font-semibold text-gray-900">
              {filteredTransactions.length}
            </span>
            <span className="text-gray-600"> transactions</span>
            {filteredTransactions.length !== allTransactions.length && (
              <span className="text-gray-500">
                {' '}
                (filtered from {allTransactions.length})
              </span>
            )}
          </div>
          <div className="text-gray-600">
            Page {currentPage} of {totalPages || 1}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {filters.sortField === 'date' && (
                      <span className="text-blue-600">
                        {filters.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('payee')}
                >
                  <div className="flex items-center gap-1">
                    Payee
                    {filters.sortField === 'payee' && (
                      <span className="text-blue-600">
                        {filters.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1">
                    Description
                    {filters.sortField === 'description' && (
                      <span className="text-blue-600">
                        {filters.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Category
                    {filters.sortField === 'category' && (
                      <span className="text-blue-600">
                        {filters.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    {filters.sortField === 'amount' && (
                      <span className="text-blue-600">
                        {filters.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onEditCategory={setEditingTransaction}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No transactions match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mt-4">
          <div className="flex items-center justify-center gap-2">
            {/* Previous button */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {/* Page numbers */}
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page as number)}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            {/* Next button */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Transaction Editor Modal */}
      {editingTransaction && (
        <TransactionEditor
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveCategory}
        />
      )}
    </div>
  );
}

export default TransactionList;
