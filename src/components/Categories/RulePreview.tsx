import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { matchesPattern } from '../../services/categorizer';
import type { CategoryRule, Transaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface RulePreviewProps {
  rule: CategoryRule;
}

function RulePreview({ rule }: RulePreviewProps) {
  // Fetch recent transactions (last 100)
  const recentTransactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(100).toArray(),
    []
  );

  // Calculate matches
  const matches = useMemo(() => {
    if (!recentTransactions || rule.patterns.length === 0) {
      return [];
    }

    const matchedTransactions: Array<{
      transaction: Transaction;
      matchedPatterns: number[];
    }> = [];

    const patternLogic = rule.patternLogic || 'OR';

    for (const transaction of recentTransactions) {
      const matchedPatterns: number[] = [];

      rule.patterns.forEach((pattern, index) => {
        if (matchesPattern(transaction, pattern)) {
          matchedPatterns.push(index);
        }
      });

      // Apply AND/OR logic
      const isMatch = patternLogic === 'AND'
        ? matchedPatterns.length === rule.patterns.length // AND: all patterns must match
        : matchedPatterns.length > 0; // OR: at least one pattern must match

      if (isMatch) {
        matchedTransactions.push({
          transaction,
          matchedPatterns,
        });
      }
    }

    return matchedTransactions;
  }, [recentTransactions, rule.patterns, rule.patternLogic]);

  const matchCount = matches.length;
  const displayMatches = matches.slice(0, 10);

  if (!recentTransactions) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">Loading preview...</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-1">
          Pattern Logic: {rule.patternLogic === 'AND' ? (
            <span className="text-purple-600">ALL patterns must match (AND)</span>
          ) : (
            <span className="text-blue-600">ANY pattern can match (OR)</span>
          )}
        </h4>
        <p className="text-xs text-gray-600">
          {rule.patternLogic === 'AND' 
            ? 'Transactions will only match if ALL patterns in this rule match.'
            : 'Transactions will match if ANY pattern in this rule matches.'}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Live Preview</h4>
        <div className="text-sm text-gray-600">
          {matchCount} match{matchCount !== 1 ? 'es' : ''} found
          {recentTransactions.length > 0 && ` (of ${recentTransactions.length} recent transactions)`}
        </div>
      </div>

      {matchCount === 0 ? (
        <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <svg
            className="w-12 h-12 mx-auto mb-2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="font-medium mb-1">No matches found</p>
          <p className="text-sm">
            Try adjusting your patterns or add more specific matching rules.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayMatches.map(({ transaction, matchedPatterns }) => (
            <div
              key={transaction.id}
              className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {transaction.payee}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {transaction.description}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatDate(transaction.date)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <div className="flex flex-wrap gap-1">
                      {matchedPatterns.map(patternIndex => (
                        <span
                          key={patternIndex}
                          className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded"
                          title={`Matched by pattern ${patternIndex + 1}`}
                        >
                          Pattern {patternIndex + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={`font-semibold ${
                      transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'credit' ? '+' : '-'}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {matchCount > 10 && (
            <div className="p-2 text-center text-sm text-gray-500 bg-gray-50 rounded">
              Showing first 10 of {matchCount} matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RulePreview;
