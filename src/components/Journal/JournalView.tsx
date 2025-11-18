import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useMemo } from 'react';
import { db } from '../../services/db';
// No need to import JournalEntry - we fetch it from DB directly
import { formatCurrency } from '../../utils';

interface JournalFilters {
  startDate: string;
  endDate: string;
  accountId: string;
  status: 'all' | 'pending' | 'cleared' | 'reconciled';
  searchQuery: string;
}

function JournalView() {
  const [filters, setFilters] = useState<JournalFilters>({
    startDate: '',
    endDate: '',
    accountId: 'all',
    status: 'all',
    searchQuery: '',
  });
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Fetch journal entries with live updates
  const allEntries = useLiveQuery(() => 
    db.journalEntries.orderBy('date').reverse().toArray(),
    []
  );
  
  const allAccounts = useLiveQuery(() => db.accounts.toArray(), []);
  const allSplits = useLiveQuery(() => db.splits.toArray(), []);

  // Apply filters
  const filteredEntries = useMemo(() => {
    if (!allEntries) return [];
    
    return allEntries.filter(entry => {
      // Date filter
      if (filters.startDate && new Date(entry.date) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && new Date(entry.date) > new Date(filters.endDate)) {
        return false;
      }
      
      // Status filter
      if (filters.status !== 'all' && entry.status !== filters.status) {
        return false;
      }
      
      // Account filter
      if (filters.accountId !== 'all') {
        const entrySplits = allSplits?.filter(s => s.journalEntryId === entry.id) || [];
        if (!entrySplits.some(s => s.accountId === filters.accountId)) {
          return false;
        }
      }
      
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesDescription = entry.description.toLowerCase().includes(query);
        const matchesNotes = entry.notes?.toLowerCase().includes(query);
        const entrySplits = allSplits?.filter(s => s.journalEntryId === entry.id) || [];
        const matchesAccount = entrySplits.some(split => {
          const account = allAccounts?.find(a => a.id === split.accountId);
          return account?.name.toLowerCase().includes(query);
        });
        
        if (!matchesDescription && !matchesNotes && !matchesAccount) {
          return false;
        }
      }
      
      return true;
    });
  }, [allEntries, allSplits, allAccounts, filters]);

  const toggleEntry = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getAccountName = (accountId: string) => {
    const account = allAccounts?.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const getEntrySplits = (entryId: string) => {
    return allSplits?.filter(s => s.journalEntryId === entryId) || [];
  };

  const isEntryBalanced = (entryId: string) => {
    const splits = getEntrySplits(entryId);
    const total = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(total) < 0.01; // Allow for small floating point errors
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cleared':
        return 'bg-blue-100 text-blue-800';
      case 'reconciled':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!allEntries || !allAccounts || !allSplits) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading journal entries...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Journal Entries</h1>
        <p className="text-gray-600">
          View all journal entries in double-entry format. {filteredEntries.length} of {allEntries.length} entries shown.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Description, account..."
              value={filters.searchQuery}
              onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
            <select
              value={filters.accountId}
              onChange={e => setFilters({ ...filters, accountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Accounts</option>
              {allAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value as JournalFilters['status'] })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Journal Entries */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No journal entries found matching your filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEntries.map(entry => {
              const splits = getEntrySplits(entry.id);
              const isExpanded = expandedEntries.has(entry.id);
              const isBalanced = isEntryBalanced(entry.id);
              const totalDebits = splits.filter(s => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
              const totalCredits = splits.filter(s => s.amount < 0).reduce((sum, s) => sum + Math.abs(s.amount), 0);

              return (
                <div key={entry.id} className="hover:bg-gray-50">
                  {/* Entry Header */}
                  <div
                    className="px-4 py-3 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleEntry(entry.id)}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-xs text-gray-500 w-24">
                        {new Date(entry.date).toLocaleDateString()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{entry.description}</div>
                        {entry.notes && (
                          <div className="text-xs text-gray-500 mt-1">{entry.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!isBalanced && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            Unbalanced
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(entry.status)}`}>
                          {entry.status}
                        </span>
                        <span className="text-xs text-gray-500">{splits.length} splits</span>
                        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Entry Splits (Expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Account</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Memo</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Debit</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Credit</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-500">Reconciled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {splits.map(split => (
                            <tr key={split.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">
                                {getAccountName(split.accountId)}
                                {split.currency && (
                                  <span className="ml-2 text-gray-400">({split.currency})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{split.memo || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{split.category || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-900">
                                {split.amount > 0 ? formatCurrency(split.amount, split.currency) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-gray-900">
                                {split.amount < 0 ? formatCurrency(Math.abs(split.amount), split.currency) : '—'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {split.reconciled ? (
                                  <span className="text-green-600">✓</span>
                                ) : (
                                  <span className="text-gray-300">○</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Totals Row */}
                          <tr className="bg-gray-50 font-medium">
                            <td colSpan={3} className="px-3 py-2 text-right text-gray-700">
                              Total:
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">
                              {formatCurrency(totalDebits, splits[0]?.currency || 'EUR')}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">
                              {formatCurrency(totalCredits, splits[0]?.currency || 'EUR')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isBalanced ? (
                                <span className="text-green-600 font-bold">✓</span>
                              ) : (
                                <span className="text-red-600 font-bold">✗</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 mb-1">Total Entries</div>
          <div className="text-2xl font-bold text-gray-900">{filteredEntries.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 mb-1">Balanced</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredEntries.filter(e => isEntryBalanced(e.id)).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 mb-1">Unbalanced</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredEntries.filter(e => !isEntryBalanced(e.id)).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 mb-1">Reconciled</div>
          <div className="text-2xl font-bold text-blue-600">
            {filteredEntries.filter(e => e.status === 'reconciled').length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JournalView;
