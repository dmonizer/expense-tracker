import type { Transaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface TransactionRowProps {
  transaction: Transaction;
  onEditCategory: (transaction: Transaction) => void;
}

/**
 * Displays a single transaction row with formatted data
 * Shows date, payee, description, category, and amount
 * Color codes income (green) vs expense (red)
 */
function TransactionRow({ transaction, onEditCategory }: TransactionRowProps) {
  const isIncome = transaction.type === 'credit';
  const hasCategory = transaction.category && transaction.category !== 'Uncategorized';

  return (
    <tr
      className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onEditCategory(transaction)}
    >
      {/* Date */}
      <td className="px-4 py-3 text-sm text-gray-700">
        {formatDate(new Date(transaction.date))}
      </td>

      {/* Payee */}
      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
        {transaction.payee}
      </td>

      {/* Description */}
      <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
        {transaction.description}
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              hasCategory
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {transaction.category || 'Uncategorized'}
          </span>
          
          {/* Confidence indicator for auto-categorized transactions */}
          {transaction.categoryConfidence !== undefined && 
           !transaction.manuallyEdited && (
            <span
              className={`text-xs ${
                transaction.categoryConfidence >= 80
                  ? 'text-green-600'
                  : transaction.categoryConfidence >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
              title={`Confidence: ${transaction.categoryConfidence}%`}
            >
              {transaction.categoryConfidence}%
            </span>
          )}

          {/* Manual edit indicator */}
          {transaction.manuallyEdited && (
            <span
              className="text-xs text-purple-600"
              title="Manually edited"
            >
              ✓
            </span>
          )}
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-sm font-semibold text-right">
        <span
          className={isIncome ? 'text-green-600' : 'text-red-600'}
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
        </span>
      </td>
    </tr>
  );
}

export default TransactionRow;
