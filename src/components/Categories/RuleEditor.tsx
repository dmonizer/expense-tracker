import { useState, useEffect } from 'react';
import { isValidPattern } from '../../utils/validators';
import type { CategoryRule, Pattern } from '../../types/index';
import PatternEditor from './PatternEditor';
import RulePreview from './RulePreview';

interface RuleEditorProps {
  rule: CategoryRule;
  onSave: (rule: CategoryRule) => void;
  onCancel: () => void;
}

function RuleEditor({ rule: initialRule, onSave, onCancel }: RuleEditorProps) {
  const [rule, setRule] = useState<CategoryRule>(initialRule);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setRule(initialRule);
  }, [initialRule]);

  const handleNameChange = (name: string) => {
    setRule({ ...rule, name });
  };

  const handleTypeChange = (type: 'income' | 'expense') => {
    setRule({ ...rule, type });
  };

  const handlePriorityChange = (priority: number) => {
    setRule({ ...rule, priority: Math.max(1, Math.min(10, priority)) });
  };

  const handleAddPattern = () => {
    const newPattern: Pattern = {
      field: 'payee',
      matchType: 'wordlist',
      words: [],
      caseSensitive: false,
      weight: 10,
    };
    setRule({
      ...rule,
      patterns: [...rule.patterns, newPattern],
    });
  };

  const handleUpdatePattern = (index: number, pattern: Pattern) => {
    const newPatterns = [...rule.patterns];
    newPatterns[index] = pattern;
    setRule({
      ...rule,
      patterns: newPatterns,
    });
  };

  const handleRemovePattern = (index: number) => {
    setRule({
      ...rule,
      patterns: rule.patterns.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    const updatedRule: CategoryRule = {
      ...rule,
      updatedAt: new Date(),
    };
    onSave(updatedRule);
  };

  const isValid =
    rule.name.trim().length > 0 &&
    rule.patterns.length > 0 &&
    rule.patterns.every(pattern => isValidPattern(pattern));

  const canSave = isValid;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {initialRule.id && initialRule.name ? `Edit Rule: ${initialRule.name}` : 'Create New Rule'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rule.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Groceries, Fast Food, Salary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleTypeChange('expense')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      rule.type === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    onClick={() => handleTypeChange('income')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      rule.type === 'income'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Pattern Logic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pattern Matching Logic
                </label>
                <div className="flex gap-4">
                  <label className="flex items-start cursor-pointer flex-1 p-3 border-2 rounded-lg transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      name="patternLogic"
                      value="OR"
                      checked={rule.patternLogic === 'OR' || !rule.patternLogic}
                      onChange={() => setRule({ ...rule, patternLogic: 'OR' })}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">
                        OR <span className="text-sm font-normal text-gray-600">- Match ANY pattern</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Rule matches if <strong>at least one</strong> pattern matches.<br/>
                        Example: "RIMI" OR "SELVER" → matches either store
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer flex-1 p-3 border-2 rounded-lg transition-colors hover:bg-gray-50">
                    <input
                      type="radio"
                      name="patternLogic"
                      value="AND"
                      checked={rule.patternLogic === 'AND'}
                      onChange={() => setRule({ ...rule, patternLogic: 'AND' })}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">
                        AND <span className="text-sm font-normal text-gray-600">- Match ALL patterns</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Rule matches only if <strong>all</strong> patterns match.<br/>
                        Example: "RIMI" AND "amount &gt; 50" → large grocery purchases
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority: {rule.priority}
                  <span className="text-gray-500 font-normal ml-2">
                    (Higher priority wins conflicts)
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rule.priority}
                  onChange={e => handlePriorityChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      ((rule.priority - 1) / 9) * 100
                    }%, #e5e7eb ${((rule.priority - 1) / 9) * 100}%, #e5e7eb 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 (General)</span>
                  <span>5 (Normal)</span>
                  <span>10 (Very Specific)</span>
                </div>
              </div>
            </div>

            {/* Patterns Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  Patterns <span className="text-red-500">*</span>
                </h3>
                <button
                  onClick={handleAddPattern}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  + Add Pattern
                </button>
              </div>

              {rule.patterns.length === 0 ? (
                <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="font-medium mb-1">No patterns added yet</p>
                  <p className="text-sm">Add at least one pattern to match transactions.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rule.patterns.map((pattern, index) => (
                    <PatternEditor
                      key={index}
                      pattern={pattern}
                      onChange={updatedPattern => handleUpdatePattern(index, updatedPattern)}
                      onRemove={() => handleRemovePattern(index)}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Preview Section */}
            {rule.patterns.length > 0 && rule.patterns.every(p => isValidPattern(p)) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                {showPreview && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <RulePreview rule={rule} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            {!canSave && (
              <p className="text-sm text-red-600">
                Please complete all required fields with valid data.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RuleEditor;
