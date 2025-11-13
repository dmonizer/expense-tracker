import { useState } from 'react';
import type { Pattern } from '../../types/index';

interface WordListEditorProps {
  pattern: Pattern;
  onChange: (pattern: Pattern) => void;
}

function WordListEditor({ pattern, onChange }: WordListEditorProps) {
  const [newWord, setNewWord] = useState('');
  const [isNegated, setIsNegated] = useState(false);
  const words = pattern.words || [];
  const caseSensitive = pattern.caseSensitive || false;

  const handleAddWord = () => {
    const trimmedWord = newWord.trim();
    if (trimmedWord && !words.some(w => w.text === trimmedWord)) {
      onChange({
        ...pattern,
        words: [...words, { text: trimmedWord, negated: isNegated }],
      });
      setNewWord('');
      // Reset to AND after adding
      setIsNegated(false);
    }
  };

  const handleRemoveWord = (wordToRemove: string) => {
    onChange({
      ...pattern,
      words: words.filter(word => word.text !== wordToRemove),
    });
  };

  const handleToggleNegation = (wordText: string) => {
    onChange({
      ...pattern,
      words: words.map(word =>
        word.text === wordText ? { ...word, negated: !word.negated } : word
      ),
    });
  };

  const handleCaseSensitiveChange = (checked: boolean) => {
    onChange({
      ...pattern,
      caseSensitive: checked,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddWord();
    }
  };

  return (
    <div className="space-y-3">
      {/* Add word input with AND/NOT toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsNegated(!isNegated)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            isNegated
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
          title={isNegated ? 'Click to change to AND' : 'Click to change to NOT'}
        >
          {isNegated ? 'NOT' : 'AND'}
        </button>
        <input
          type="text"
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter a word or phrase..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          onClick={handleAddWord}
          disabled={!newWord.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          Add
        </button>
      </div>

      {/* Case sensitive checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={e => handleCaseSensitiveChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Case sensitive</span>
      </label>

      {/* Word list */}
      {words.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
          No words added yet. Add at least one word to match.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase">
            Words ({words.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {words.map(word => (
              <div
                key={word.text}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  word.negated
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                <button
                  onClick={() => handleToggleNegation(word.text)}
                  className={`font-semibold hover:opacity-70 transition-opacity ${
                    word.negated ? 'text-red-700' : 'text-green-700'
                  }`}
                  title={word.negated ? 'Click to change to AND' : 'Click to change to NOT'}
                >
                  {word.negated ? 'NOT' : 'AND'}
                </button>
                <span>{word.text}</span>
                <button
                  onClick={() => handleRemoveWord(word.text)}
                  className={`hover:opacity-70 rounded-full p-0.5 transition-opacity ${
                    word.negated ? 'hover:bg-red-200' : 'hover:bg-green-200'
                  }`}
                  title="Remove word"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WordListEditor;
