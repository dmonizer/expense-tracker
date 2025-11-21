import {useEffect, useState} from 'react';
import type {Pattern, Transaction} from '@/types';
import {isValidPattern} from '@/utils';
import {extractPatternSuggestions} from '@/utils/patternExtractor.ts';
import {detectPatternConflicts, matchesPattern} from '@/services/categorizer.ts';
import {db} from '@/services/db.ts';
import FieldSelectorGrid from './FieldSelectorGrid';
import WordListEditor from './WordListEditor';
import RegexEditor from './RegexEditor';
import {Label} from '@/components/ui/label';

interface PatternEditorV2Props {
  pattern: Pattern;
  onChange: (pattern: Pattern) => void;
  onRemove: () => void;
  onSave?: () => void;
  transactionContext?: Transaction;
  categoryName?: string;
  showSuggestions?: boolean;
  showConflicts?: boolean;
  showPreview?: boolean;
}

function PatternEditorV2({
  pattern,
  onChange,
  onRemove,
  onSave,
  transactionContext,
  categoryName,
  showSuggestions = false,
  showConflicts = false,
  showPreview = false,
}: PatternEditorV2Props) {
  const [conflictWarning, setConflictWarning] = useState<string[]>([]);
  const [affectedCount, setAffectedCount] = useState<number | null>(null);

  // Support legacy format
  const fields = pattern.fields || (pattern.field ? [pattern.field] : ['payee']);

  // Generate suggestions from transaction context
  const suggestions: Record<string, string[]> = {};
  if (transactionContext && showSuggestions) {
    suggestions.payee = extractPatternSuggestions(transactionContext.payee);
    suggestions.description = extractPatternSuggestions(transactionContext.description);
    suggestions.accountNumber = [transactionContext.accountNumber];
    suggestions.transactionType = [transactionContext.transactionType];
    suggestions.currency = [transactionContext.currency];
    if (transactionContext.archiveId) {
      suggestions.archiveId = [transactionContext.archiveId];
    }
  }

  // Check for conflicts and count affected transactions
  useEffect(() => {
    const checkConflictsAndCount = async () => {
      if (!showConflicts && !showPreview) {
        setConflictWarning([]);
        setAffectedCount(null);
        return;
      }

      if (!isValidPattern(pattern) || !categoryName) {
        setConflictWarning([]);
        setAffectedCount(null);
        return;
      }

      // Check conflicts
      if (showConflicts && transactionContext) {
        const conflicts = await detectPatternConflicts(pattern, categoryName, transactionContext);
        setConflictWarning(conflicts);
      }

      // Count affected transactions
      if (showPreview) {
        const allTransactions = await db.transactions.toArray();
        const affected = allTransactions.filter(t => {
          if (t.manuallyEdited) return false;
          return matchesPattern(t, pattern);
        });
        setAffectedCount(affected.length);
      }
    };

    checkConflictsAndCount();
  }, [pattern, categoryName, transactionContext, showConflicts, showPreview]);

  const handleFieldsChange = (newFields: string[]) => {
    onChange({
      ...pattern,
      fields: newFields,
      field: undefined, // Clear legacy field
    });
  };

  const handleMatchTypeChange = (matchType: 'wordlist' | 'regex') => {
    if (matchType === 'wordlist') {
      onChange({
        ...pattern,
        matchType: 'wordlist',
        words: [],
        caseSensitive: false,
        regex: undefined,
        regexFlags: undefined,
      });
    } else {
      onChange({
        ...pattern,
        matchType: 'regex',
        regex: '',
        regexFlags: '',
        words: undefined,
        caseSensitive: undefined,
      });
    }
  };

  const handleWeightChange = (weight: number) => {
    onChange({
      ...pattern,
      weight: Math.max(1, weight),
    });
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (pattern.matchType === 'wordlist') {
      const words = pattern.words || [];
      if (!words.some(w => w.text === suggestion)) {
        onChange({
          ...pattern,
          words: [...words, { text: suggestion, negated: false }],
        });
      }
    }
  };

  const isValid = isValidPattern(pattern);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="space-y-4">
        {/* Field Selector */}
        <FieldSelectorGrid
          selectedFields={fields}
          onChange={handleFieldsChange}
        />

        {/* Match Type Toggle */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">Match Type</Label>
          <div className="flex gap-2">
            <button
              onClick={() => handleMatchTypeChange('wordlist')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${pattern.matchType === 'wordlist'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              Word List
            </button>
            <button
              onClick={() => handleMatchTypeChange('regex')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${pattern.matchType === 'regex'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              Regex
            </button>
          </div>
        </div>

        {/* Suggestions (if enabled and available) */}
        {showSuggestions && transactionContext && pattern.matchType === 'wordlist' && (
          <div className="space-y-3">
            {fields.map(field => {
              const fieldSuggestions = suggestions[field] || [];
              if (fieldSuggestions.length === 0) return null;

              return (
                <div key={field}>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Suggested from {field}:
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {fieldSuggestions.map((suggestion, idx) => {
                      const alreadyAdded = pattern.words?.some(w => w.text === suggestion);
                      return (
                        <button
                          key={`${field}-${idx}`}
                          type="button"
                          onClick={() => handleAddSuggestion(suggestion)}
                          disabled={alreadyAdded}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          "{suggestion}" {!alreadyAdded && <span className="ml-1 text-blue-600">+ Add</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pattern Editor (Wordlist or Regex) */}
        <div>
          {pattern.matchType === 'wordlist' ? (
            <WordListEditor pattern={pattern} onChange={onChange} />
          ) : (
            <RegexEditor pattern={pattern} onChange={onChange} />
          )}
        </div>

        {/* Amount Condition */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="amount-condition-enabled"
              checked={!!pattern.amountCondition}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange({
                    ...pattern,
                    amountCondition: {
                      operator: 'lte',
                      value: 0,
                    },
                  });
                } else {
                  const { amountCondition, ...rest } = pattern;
                  onChange(rest as Pattern);
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="amount-condition-enabled" className="text-sm font-medium text-gray-700 cursor-pointer">
              Add amount condition
            </Label>
          </div>

          {pattern.amountCondition && (
            <div className="flex gap-2 items-center pl-6">
              <Label className="text-sm text-gray-700">Amount</Label>
              <select
                value={pattern.amountCondition.operator}
                onChange={(e) => {
                  onChange({
                    ...pattern,
                    amountCondition: {
                      ...pattern.amountCondition!,
                      operator: e.target.value as 'lt' | 'lte' | 'eq' | 'gte' | 'gt',
                    },
                  });
                }}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="lt">&lt; (less than)</option>
                <option value="lte">≤ (less than or equal)</option>
                <option value="eq">= (equal to)</option>
                <option value="gte">≥ (greater than or equal)</option>
                <option value="gt">&gt; (greater than)</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pattern.amountCondition.value}
                onChange={(e) => {
                  onChange({
                    ...pattern,
                    amountCondition: {
                      ...pattern.amountCondition!,
                      value: parseFloat(e.target.value) || 0,
                    },
                  });
                }}
                className="w-32 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          )}
        </div>

        {/* Weight Slider */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">
            Weight: {pattern.weight}
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Higher = more important)
            </span>
          </Label>
          <input
            type="range"
            min="1"
            max="10"
            value={pattern.weight}
            onChange={e => handleWeightChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 (less specific)</span>
            <span>10 (very specific)</span>
          </div>
        </div>

        {/* Conflict Warning */}
        {showConflicts && conflictWarning.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm font-medium text-yellow-800 mb-1">
              ⚠️ Pattern conflict detected
            </p>
            <p className="text-xs text-yellow-700">
              These patterns may also match existing rules:{' '}
              <strong>{conflictWarning.join(', ')}</strong>
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              The category with the highest score will be selected for each transaction.
            </p>
          </div>
        )}

        {/* Affected Transactions Preview */}
        {showPreview && affectedCount !== null && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              📊 Preview: <strong>~{affectedCount} transaction{affectedCount !== 1 ? 's' : ''}</strong> will be affected by this pattern
            </p>
          </div>
        )}

        {/* Validation Feedback */}
        {!isValid && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm text-yellow-800">
              This pattern is incomplete or invalid. Please fix before saving.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={onRemove}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
          >
            Remove Pattern
          </button>
          {onSave && (
            <button
              onClick={onSave}
              disabled={!isValid}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save Pattern
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatternEditorV2;
