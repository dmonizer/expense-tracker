import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { TransactionFilters } from '../../types';
import { db } from '../../services/db';
import { formatDate } from '../../utils';
import { Label } from '@/components/ui/label';

interface FiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

/**
 * Filter controls for transaction list
 * Includes date range, category selection, amount range, transaction type, and search
 */
function Filters({ filters, onFiltersChange }: Readonly<FiltersProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters);

  // Fetch all categories from database
  const categoryRules = useLiveQuery(
    () => db.categoryRules.orderBy('name').toArray(),
    []
  );

  // Fetch all groups from database
  const categoryGroups = useLiveQuery(
    () => db.categoryGroups.orderBy('sortOrder').toArray(),
    []
  );

  // Update local filters when prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof TransactionFilters, value: TransactionFilters[typeof key]) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCategoryToggle = (categoryName: string) => {
    const currentCategories = localFilters.categories || [];
    const newCategories = currentCategories.includes(categoryName)
      ? currentCategories.filter((c) => c !== categoryName)
      : [...currentCategories, categoryName];

    handleFilterChange('categories', newCategories.length > 0 ? newCategories : undefined);
  };

  const handleGroupToggle = (groupId: string) => {
    const currentGroups = localFilters.groups || [];
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter((g) => g !== groupId)
      : [...currentGroups, groupId];

    handleFilterChange('groups', newGroups.length > 0 ? newGroups : undefined);
  };

  const handleClearFilters = () => {
    const emptyFilters: TransactionFilters = {
      transactionType: 'both',
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  // Count active filters
  const activeFilterCount = [
    localFilters.dateFrom,
    localFilters.dateTo,
    localFilters.categories?.length,
    localFilters.groups?.length,
    localFilters.currencies?.length,
    localFilters.minAmount !== undefined,
    localFilters.maxAmount !== undefined,
    localFilters.transactionType && localFilters.transactionType !== 'both',
    localFilters.searchQuery,
  ].filter(Boolean).length;

  // Fetch all unique currencies from transactions
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), []);
  const availableCurrencies = allTransactions
    ? Array.from(new Set(allTransactions.map(t => t.currency))).sort()
    : [];

  const handleCurrencyToggle = (currency: string) => {
    const currentCurrencies = localFilters.currencies || [];
    const newCurrencies = currentCurrencies.includes(currency)
      ? currentCurrencies.filter((c) => c !== currency)
      : [...currentCurrencies, currency];

    handleFilterChange('currencies', newCurrencies.length > 0 ? newCurrencies : undefined);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      {/* Filter Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1">
              Search (Payee/Description)
            </Label>
            <input
              type="text"
              id="search"
              value={localFilters.searchQuery || ''}
              onChange={(e) =>
                handleFilterChange('searchQuery', e.target.value || undefined)
              }
              placeholder="Search transactions..."
              className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dateFrom" className="block text-xs font-medium text-gray-700 mb-1">
                From Date
              </Label>
              <input
                type="date"
                id="dateFrom"
                value={
                  localFilters.dateFrom
                    ? formatDate(localFilters.dateFrom, 'yyyy-MM-dd')
                    : ''
                }
                onChange={(e) =>
                  handleFilterChange(
                    'dateFrom',
                    e.target.value ? new Date(e.target.value) : undefined
                  )
                }
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <Label htmlFor="dateTo" className="block text-xs font-medium text-gray-700 mb-1">
                To Date
              </Label>
              <input
                type="date"
                id="dateTo"
                value={
                  localFilters.dateTo
                    ? formatDate(localFilters.dateTo, 'yyyy-MM-dd')
                    : ''
                }
                onChange={(e) =>
                  handleFilterChange(
                    'dateTo',
                    e.target.value ? new Date(e.target.value) : undefined
                  )
                }
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="minAmount" className="block text-xs font-medium text-gray-700 mb-1">
                Min Amount
              </Label>
              <input
                type="number"
                id="minAmount"
                value={localFilters.minAmount ?? ''}
                onChange={(e) =>
                  handleFilterChange(
                    'minAmount',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="0.00"
                step="0.01"
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <Label htmlFor="maxAmount" className="block text-xs font-medium text-gray-700 mb-1">
                Max Amount
              </Label>
              <input
                type="number"
                id="maxAmount"
                value={localFilters.maxAmount ?? ''}
                onChange={(e) =>
                  handleFilterChange(
                    'maxAmount',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="9999.99"
                step="0.01"
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-2">
              Transaction Type
            </Label>
            <div className="flex gap-2">
              {(['both', 'income', 'expense'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleFilterChange('transactionType', type)}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${(localFilters.transactionType || 'both') === type
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Currencies */}
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-2">
              Currencies
            </Label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
              {availableCurrencies && availableCurrencies.length > 0 ? (
                availableCurrencies.map((currency) => {
                  const isSelected = localFilters.currencies?.includes(currency) || false;
                  return (
                    <Label
                      key={currency}
                      className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCurrencyToggle(currency)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{currency}</span>
                    </Label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  No currencies available
                </p>
              )}
            </div>
          </div>

          {/* Groups */}
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-2">
              Groups
            </Label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
              {categoryGroups && categoryGroups.length > 0 ? (
                categoryGroups.map((group) => {
                  const isSelected = localFilters.groups?.includes(group.id) || false;
                  return (
                    <Label
                      key={group.id}
                      className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleGroupToggle(group.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div
                        className="ml-2 w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: group.baseColor }}
                      />
                      <span className="ml-2 text-sm text-gray-700">{group.name}</span>
                    </Label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  No groups available
                </p>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-2">
              Categories
            </Label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
              {categoryRules && categoryRules.length > 0 ? (
                categoryRules.map((rule) => {
                  const isSelected = localFilters.categories?.includes(rule.name) || false;
                  return (
                    <Label
                      key={rule.id}
                      className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(rule.name)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{rule.name}</span>
                      <span className="ml-auto text-xs text-gray-500">
                        ({rule.type})
                      </span>
                    </Label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  No categories available
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Filters;
