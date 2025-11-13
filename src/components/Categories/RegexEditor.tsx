import { useState, useEffect } from 'react';
import { isValidRegex } from '../../utils/validators';
import type { Pattern } from '../../types/index';

interface RegexEditorProps {
  pattern: Pattern;
  onChange: (pattern: Pattern) => void;
}

function RegexEditor({ pattern, onChange }: RegexEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const regex = pattern.regex || '';
  const flags = pattern.regexFlags || '';

  useEffect(() => {
    if (regex) {
      setIsValid(isValidRegex(regex));
    } else {
      setIsValid(false);
    }
  }, [regex]);

  const handleRegexChange = (value: string) => {
    onChange({
      ...pattern,
      regex: value,
    });
  };

  const handleFlagChange = (flag: string, checked: boolean) => {
    let newFlags = flags;
    if (checked) {
      // Add flag if not present
      if (!newFlags.includes(flag)) {
        newFlags += flag;
      }
    } else {
      // Remove flag
      newFlags = newFlags.replace(flag, '');
    }
    onChange({
      ...pattern,
      regexFlags: newFlags,
    });
  };

  const hasFlag = (flag: string) => flags.includes(flag);

  return (
    <div className="space-y-3">
      {/* Regex input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Regular Expression Pattern
        </label>
        <input
          type="text"
          value={regex}
          onChange={e => handleRegexChange(e.target.value)}
          placeholder="e.g., \d{3,5}|STORE.*\\d+"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm font-mono ${
            regex && !isValid
              ? 'border-red-300 focus:ring-red-500 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
      </div>

      {/* Validation feedback */}
      {regex && (
        <div className="flex items-center gap-2">
          {isValid ? (
            <>
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-green-700">Valid regex pattern</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-red-700">Invalid regex pattern</span>
            </>
          )}
        </div>
      )}

      {/* Flags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Flags</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFlag('i')}
              onChange={e => handleFlagChange('i', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm">
              <span className="font-mono font-medium">i</span>
              <span className="text-gray-600 ml-1">(case-insensitive)</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFlag('g')}
              onChange={e => handleFlagChange('g', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm">
              <span className="font-mono font-medium">g</span>
              <span className="text-gray-600 ml-1">(global)</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFlag('m')}
              onChange={e => handleFlagChange('m', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm">
              <span className="font-mono font-medium">m</span>
              <span className="text-gray-600 ml-1">(multiline)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Help link */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Regex Tips</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>
                Use <code className="bg-blue-100 px-1 rounded">\d</code> for digits,{' '}
                <code className="bg-blue-100 px-1 rounded">\w</code> for word characters
              </li>
              <li>
                Use <code className="bg-blue-100 px-1 rounded">.*?</code> for non-greedy matching
              </li>
              <li>
                Test your regex at{' '}
                <a
                  href="https://regex101.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-900"
                >
                  regex101.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegexEditor;
