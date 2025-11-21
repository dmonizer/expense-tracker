import type {Pattern} from '@/types';
import {Button} from '@/components/ui/button.tsx';

interface PatternCardProps {
  pattern: Pattern;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}

function PatternCard({pattern, index, isExpanded, onToggleExpand, onDelete}: Readonly<PatternCardProps>) {
  // Support both new and legacy pattern format
  const fields = pattern.fields || (pattern.field ? [pattern.field] : ['payee']);

  // Generate summary text
  const fieldsSummary = fields.map(f => {
    switch (f) {
      case 'payee': return 'Payee';
      case 'description': return 'Description';
      case 'accountNumber': return 'Account';
      case 'transactionType': return 'Type';
      case 'currency': return 'Currency';
      case 'archiveId': return 'Archive ID';
      default: return f;
    }
  }).join(', ');

  const matchTypeSummary = pattern.matchType === 'wordlist' ? 'Wordlist' : 'Regex';

  let patternSummary = '';
  if (pattern.matchType === 'wordlist' && pattern.words) {
    const wordTexts = pattern.words.map(w => w.negated ? `NOT ${w.text}` : w.text);
    patternSummary = wordTexts.slice(0, 3).join(', ');
    if (wordTexts.length > 3) {
      patternSummary += ` +${wordTexts.length - 3} more`;
    }
  } else if (pattern.matchType === 'regex' && pattern.regex) {
    patternSummary = pattern.regex.length > 30
      ? `${pattern.regex.slice(0, 30)}...`
      : pattern.regex;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow">
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">
                Pattern {index + 1}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {matchTypeSummary}
              </span>
              <span className="text-xs text-gray-500">
                Weight: {pattern.weight}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">Fields:</span> {fieldsSummary}
            </div>
            {patternSummary && (
              <div className="text-xs text-gray-600 mt-1">
                <span className="font-medium">Pattern:</span> {patternSummary}
              </div>
            )}
            {pattern.amountCondition && (
              <div className="text-xs text-gray-600 mt-1">
                <span className="font-medium">Amount:</span>{' '}
                {pattern.amountCondition.operator === 'lt' && '<'}
                {pattern.amountCondition.operator === 'lte' && '≤'}
                {pattern.amountCondition.operator === 'eq' && '='}
                {pattern.amountCondition.operator === 'gte' && '≥'}
                {pattern.amountCondition.operator === 'gt' && '>'}
                {' '}{pattern.amountCondition.value}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-destructive hover:text-destructive"
            >
              ✕
            </Button>
            <span className="text-gray-400 text-sm">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatternCard;
