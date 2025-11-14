import { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { formatCurrency } from '../../utils';
import CategoryPieChart from './Charts/CategoryPieChart';
import MonthlyBarChart from './Charts/MonthlyBarChart';
import BalanceLine from './Charts/BalanceLine';
import TransactionList from '../Transactions/TransactionList';
import { FilterProvider, useFilters } from '../../contexts/FilterContext';

function OverviewContent() {
  // Fetch all transactions using Dexie live query
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray(), []);
  const transactions = useMemo(() => transactionsRaw || [], [transactionsRaw]);

  // Get filters from context
  const {
    dateRangePreset,
    customDateFrom,
    customDateTo,
    setDateRangePreset,
    setCustomDateRange,
    drillDownToCategory,
    clearCategoryFilter,
    getTransactionFilters,
    selectedCategory,
  } = useFilters();

  const filters = getTransactionFilters();

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);

  // Summary stats
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netBalance, setNetBalance] = useState(0);

  // Calculate summary stats
  useEffect(() => {
    if (!transactions || !transactions.length) {
      setTotalIncome(0);
      setTotalExpenses(0);
      setNetBalance(0);
      return;
    }

    // Apply filters to transactions
    let filteredTransactions = [...transactions];
    
    // Always exclude ignored transactions from calculations
    filteredTransactions = filteredTransactions.filter(t => !t.ignored);
    
    if (filters.dateFrom) {
      filteredTransactions = filteredTransactions.filter(t => t.date >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      filteredTransactions = filteredTransactions.filter(t => t.date <= filters.dateTo!);
    }

    // Calculate totals
    let income = 0;
    let expenses = 0;

    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'credit') {
        income += transaction.amount;
      } else {
        expenses += Math.abs(transaction.amount);
      }
    });

    setTotalIncome(income);
    setTotalExpenses(expenses);
    setNetBalance(income - expenses);
  }, [transactions, filters]);

  // Determine primary currency (most common in filtered transactions)
  const primaryCurrency = transactions.length > 0 ? transactions[0].currency : 'EUR';

  // Handler for chart click - filters transactions by category
  const handleCategoryClick = (categoryName: string | null) => {
    if (categoryName) {
      drillDownToCategory(categoryName);
    } else {
      clearCategoryFilter();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        
        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDateRangePreset('thisMonth')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              dateRangePreset === 'thisMonth'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRangePreset('last3Months')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              dateRangePreset === 'last3Months'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 3 Months
          </button>
          <button
            onClick={() => setDateRangePreset('year')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              dateRangePreset === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Year
          </button>
          <button
            onClick={() => setDateRangePreset('custom')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              dateRangePreset === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {dateRangePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <label htmlFor="dateFrom" className="text-sm font-medium text-gray-700">
              From:
            </label>
            <input
              type="date"
              id="dateFrom"
              value={customDateFrom}
              onChange={(e) => setCustomDateRange(e.target.value, customDateTo)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dateTo" className="text-sm font-medium text-gray-700">
              To:
            </label>
            <input
              type="date"
              id="dateTo"
              value={customDateTo}
              onChange={(e) => setCustomDateRange(customDateFrom, e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Income Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalIncome, primaryCurrency)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalExpenses, primaryCurrency)}
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Net Balance Card */}
        <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
          netBalance >= 0 ? 'border-blue-500' : 'border-orange-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Balance</p>
              <p className={`text-2xl font-bold mt-1 ${
                netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'
              }`}>
                {formatCurrency(netBalance, primaryCurrency)}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              netBalance >= 0 ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              <svg
                className={`h-6 w-6 ${
                  netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Expense Breakdown by Category
            </h2>
            {selectedCategory && (
              <button
                onClick={() => handleCategoryClick(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Filter
              </button>
            )}
          </div>
          <div className="h-80">
            <CategoryPieChart
              transactions={transactions}
              filters={filters}
            />
          </div>
          {selectedCategory && (
            <p className="mt-2 text-sm text-gray-600">
              Filtered by: <span className="font-medium">{selectedCategory}</span>
            </p>
          )}
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Spending Trends
          </h2>
          <div className="h-80">
            <MonthlyBarChart
              transactions={transactions}
              filters={filters}
            />
          </div>
        </div>

        {/* Balance Line Chart - Full Width */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Balance Over Time
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-500 hover:text-gray-700"
            >
                <svg
                    className={`w-5 h-5 transform transition-transform ${
                        isExpanded ? 'rotate-180' : ''
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
          </h2>
            {isExpanded && (
                <div className="h-80">
            <BalanceLine transactions={transactions} filters={filters} />
          </div>
                )}
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Transactions
              {selectedCategory && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  (Filtered by: {selectedCategory})
                </span>
              )}
            </h2>
          </div>
          <TransactionList initialFilters={filters} />
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Transactions Yet
          </h3>
          <p className="text-gray-500 mb-6">
            Import your first CSV file to see spending insights and visualizations.
          </p>
          <button
            onClick={() => {
              // Navigate to import page - this would need router integration
              console.log('Navigate to import page');
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import Transactions
          </button>
        </div>
      )}
    </div>
  );
}

function Overview() {
  return (
    <FilterProvider>
      <OverviewContent />
    </FilterProvider>
  );
}

export default Overview;
