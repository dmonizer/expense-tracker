import type {ImportFormatDefinition, Transaction} from '@/types';
import {format} from 'date-fns';
import {Label} from '@/components/ui/label';

interface PreviewTableProps {
  transactions: Transaction[];
  duplicateIds: Set<string>;
  availableFormats: ImportFormatDefinition[];
  selectedFormatId: string;
  loading?: boolean;
  error?: string | null;
  onFormatChange: (formatId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function PreviewTable({
  transactions,
  duplicateIds,
  availableFormats,
  selectedFormatId,
  loading,
  error,
  onFormatChange,
  onConfirm,
  onCancel
}: Readonly<PreviewTableProps>) {
  // Show first 20 transactions for preview
  const previewTransactions = transactions.slice(0, 20);

  const newCount = transactions.filter(t => !duplicateIds.has(t.id)).length;
  const duplicateCount = transactions.filter(t => duplicateIds.has(t.id)).length;

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-blue-600 font-medium">Updating preview...</p>
          </div>
        </div>
      )}

      {/* Header with Summary */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Preview Import
          </h2>

          {/* Format Selection */}
          <div className="flex items-center gap-3">
            <Label htmlFor="preview-format-select" className="text-sm font-medium text-gray-700">
              Format:
            </Label>
            <select
              id="preview-format-select"
              value={selectedFormatId}
              onChange={(e) => onFormatChange(e.target.value)}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] disabled:opacity-50"
            >
              {availableFormats.map(format => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <svg className="h-5 w-5 text-red-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Transactions</div>
            <div className="text-2xl font-bold text-blue-900">{transactions.length}</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">New Transactions</div>
            <div className="text-2xl font-bold text-green-900">{newCount}</div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <div className="text-sm text-amber-600 font-medium">Duplicates</div>
            <div className="text-2xl font-bold text-amber-900">{duplicateCount}</div>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Showing first {Math.min(20, transactions.length)} of {transactions.length} transactions
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payee
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewTransactions.map((transaction) => {
                const isDuplicate = duplicateIds.has(transaction.id);
                const rowClass = isDuplicate
                  ? 'bg-amber-50'
                  : 'hover:bg-gray-50';

                return (
                  <tr key={transaction.id} className={rowClass}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(transaction.date, 'dd.MM.yyyy')}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {transaction.payee}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'credit'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {transaction.type === 'credit' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {transaction.category ? (
                        <span className="flex items-center">
                          {transaction.category}
                          {transaction.categoryConfidence !== undefined && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({transaction.categoryConfidence}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      {isDuplicate ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Duplicate
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {transactions.length > 20 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            ... and {transactions.length - 20} more transactions
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={newCount === 0}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${newCount === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          Import {newCount} Transaction{newCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

export default PreviewTable;
