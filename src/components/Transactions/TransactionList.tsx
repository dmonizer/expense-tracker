import {useEffect, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import type {Transaction, TransactionFilters} from '@/types';
import {db} from '@/services/db.ts';
import TransactionRow from './TransactionRow';
import UnifiedRuleEditor from '../Categories/UnifiedRuleEditor';
import Filters from './Filters';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState, {DocumentIcon} from '../ui/EmptyState';
import {useTransactionFilters} from '@/hooks/useTransactionFilters.ts';
import {usePagination} from '@/hooks/usePagination.ts';
import {PAGINATION} from '@/constants';
import {Button} from '@/components/ui/button';

interface TransactionListProps {
  initialFilters?: TransactionFilters;
}

function TransactionList({ initialFilters }: TransactionListProps = { initialFilters: {} }) {
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
        // Start with initialFilters to clear any removed filters
        ...initialFilters,
        // Preserve UI-specific state (sorting) if not explicitly set in initialFilters
        transactionType: initialFilters.transactionType ?? prev.transactionType ?? 'both',
        sortField: initialFilters.sortField ?? prev.sortField ?? 'date',
        sortDirection: initialFilters.sortDirection ?? prev.sortDirection ?? 'desc',
      }));
    }
  }, [initialFilters]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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

  // Apply filters using custom hook
  const { filteredTransactions, totalCount } = useTransactionFilters(
    allTransactions,
    filters,
    allCategoryRules
  );

  // Apply pagination using custom hook
  const {
    paginatedItems: paginatedTransactions,
    currentPage,
    totalPages,
    startItem,
    endItem,
    setPage,
    getPageNumbers
  } = usePagination(filteredTransactions, {
    itemsPerPage: PAGINATION.DEFAULT_PAGE_SIZE
  });

  const handleSort = (field: 'date' | 'payee' | 'amount' | 'category' | 'description') => {
    setFilters(prev => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    setPage(page);
    // Scroll to top of list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading state
  if (allTransactions === undefined) {
    return <LoadingSpinner size="lg" text="Loading transactions..." className="h-full" />;
  }

  // Empty state
  if (!allTransactions || allTransactions.length === 0) {
    return (
      <EmptyState
        icon={<DocumentIcon />}
        title="No transactions"
        description="Get started by importing a CSV file with your bank transactions."
      />
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
            {filteredTransactions.length !== totalCount && (
              <span className="text-gray-500">
                {' '}
                (filtered from {totalCount})
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

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
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(page as number)}
                >
                  {page}
                </Button>
              );
            })}

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Editor Modal */}
      {editingTransaction && (
        <UnifiedRuleEditor
          mode="quick"
          rule={{
            id: crypto.randomUUID(),
            name: editingTransaction.category || '',
            patterns: [],
            patternLogic: 'OR',
            priority: 1,
            type: editingTransaction.type === 'credit' ? 'income' : 'expense',
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }}
          transaction={editingTransaction}
          onSave={async () => { }} // Handled internally in quick mode
          onCancel={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}

export default TransactionList;
