import {useEffect, useState} from 'react';
import {formatCurrency, formatDate, isValidPattern, logger} from '../../utils';
import {useLiveQuery} from 'dexie-react-hooks';
import type {CategoryRule, Pattern, Transaction} from '../../types';
import {db} from '../../services/db';
import {getCategoryColor} from '../../utils/colorUtils';
import {recategorizeAll} from '../../services/categorizer';
import PatternList from './PatternList';
import RulePreview from './RulePreview';
import * as React from "react";

interface UnifiedRuleEditorProps {
  mode: 'quick' | 'full';
  rule: CategoryRule;
  transaction?: Transaction;
  onSave: (rule: CategoryRule) => Promise<void>;
  onCancel: () => void;
}

function UnifiedRuleEditor({ mode, rule: initialRule, transaction, onSave, onCancel }: Readonly<UnifiedRuleEditorProps>) {
  const [rule, setRule] = useState<CategoryRule>(initialRule);
  const [expandedPatternIndex, setExpandedPatternIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(['payee']);

  // Quick mode specific state
  const [selectedCategory, setSelectedCategory] = useState(transaction?.category || '');
  const [isIgnored, setIsIgnored] = useState(transaction?.ignored || false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [newCategoryGroupId, setNewCategoryGroupId] = useState<string>('');

  const categoryGroups = useLiveQuery(() => db.categoryGroups.orderBy('sortOrder').toArray(), []);
  const allRules = useLiveQuery(() => db.categoryRules.orderBy('name').toArray(), []);

  useEffect(() => {
    setRule(initialRule);
  }, [initialRule]);

  useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category || '');
      setIsIgnored(transaction.ignored || false);
    }
  }, [transaction]);

  const handleAddPattern = () => {
    const newPatterns: Pattern[] = selectedFields.map(field => ({
      fields: [field],
      matchType: 'wordlist' as const,
      words: [],
      caseSensitive: false,
      weight: 5,
    }));

    setRule({
      ...rule,
      patterns: [...rule.patterns, ...newPatterns],
    });

    // Expand the first new pattern
    setExpandedPatternIndex(rule.patterns.length);
  };

  const handlePatternsChange = (patterns: Pattern[]) => {
    setRule({
      ...rule,
      patterns,
    });
  };

  const handleGroupChange = async (groupId: string) => {
    const categoriesInGroup = await db.categoryRules
      .filter(r => r.groupId === groupId && r.id !== rule.id)
      .toArray();

    const usedVariants = categoriesInGroup.map(r => r.colorVariant || 0);
    const nextVariant = usedVariants.length > 0 ? Math.max(...usedVariants) + 1 : 0;

    setRule({ ...rule, groupId, colorVariant: nextVariant });
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      alert('Please enter a category name');
      return;
    }

    const existing = allRules?.find(r => r.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      alert('A category with this name already exists');
      return;
    }

    try {
      // Calculate color variant for the selected group
      let colorVariant = 0;
      if (newCategoryGroupId) {
        const categoriesInGroup = await db.categoryRules
          .filter(r => r.groupId === newCategoryGroupId)
          .toArray();
        const usedVariants = categoriesInGroup.map(r => r.colorVariant || 0);
        colorVariant = usedVariants.length > 0 ? Math.max(...usedVariants) + 1 : 0;
      }

      const newRule: CategoryRule = {
        id: crypto.randomUUID(),
        name: trimmedName,
        patterns: [],
        patternLogic: 'OR',
        priority: 1,
        type: newCategoryType,
        groupId: newCategoryGroupId || undefined,
        colorVariant: newCategoryGroupId ? colorVariant : undefined,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.categoryRules.add(newRule);
      setSelectedCategory(trimmedName);
      setIsCreatingNew(false);
      setNewCategoryName('');
      setNewCategoryGroupId('');
      alert(`Category "${trimmedName}" created successfully!`);
    } catch (error) {
      logger.error('Failed to create category:', error);
      alert('Failed to create category. Please try again.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (mode === 'quick' && transaction) {
        // Quick mode: Update transaction and optionally add patterns
        if (rule.patterns.length > 0) {
          // Find or create the category rule
          const categoryRule = await db.categoryRules
            .filter(r => r.name === selectedCategory)
            .first();

          if (categoryRule) {
            // Update existing rule with new patterns
            await db.categoryRules.update(categoryRule.id, {
              patterns: [...categoryRule.patterns, ...rule.patterns],
              updatedAt: new Date(),
            });
          }

          // Update transaction (not manually edited since we're using patterns)
          await db.transactions.update(transaction.id, {
            category: selectedCategory,
            manuallyEdited: false,
            ignored: isIgnored,
          });

          // Recategorize all
          await recategorizeAll();
        } else {
          // Just update the transaction manually
          await db.transactions.update(transaction.id, {
            category: selectedCategory,
            manuallyEdited: true,
            ignored: isIgnored,
          });
        }
      } else {
        // Full mode: Save the rule
        const updatedRule: CategoryRule = {
          ...rule,
          updatedAt: new Date(),
        };
        await onSave(updatedRule);
      }

      onCancel(); // Close the editor
    } catch (error) {
      logger.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const isValid =
    rule.name.trim().length > 0 &&
    rule.patterns.length > 0 &&
    rule.patterns.every(p => isValidPattern(p));

  const canSave = mode === 'full' ? isValid : true; // Quick mode is more lenient

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'quick'
              ? 'Edit Transaction Category'
              : rule.id && rule.name
                ? `Edit Rule: ${rule.name}`
                : 'Create New Rule'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Transaction Preview (Quick Mode Only) */}
            {mode === 'quick' && transaction && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Transaction Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {formatDate(new Date(transaction.date))}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <span
                      className={`ml-2 font-semibold ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Payee:</span>
                    <span className="ml-2 font-medium text-gray-900">{transaction.payee}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Description:</span>
                    <span className="ml-2 text-gray-700">{transaction.description}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Category Selector (Quick Mode Only) */}
            {mode === 'quick' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(!isCreatingNew)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    disabled={isSaving}
                  >
                    {isCreatingNew ? 'Cancel' : '+ Create New Category'}
                  </button>
                </div>

                {!isCreatingNew ? (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSaving}
                  >
                    <option value="">Uncategorized</option>
                    {allRules?.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., Entertainment"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <div className="flex gap-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="expense"
                            checked={newCategoryType === 'expense'}
                            onChange={(e) => setNewCategoryType(e.target.value as 'expense')}
                            className="mr-2"
                          />
                          <span className="text-sm">Expense</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="income"
                            checked={newCategoryType === 'income'}
                            onChange={(e) => setNewCategoryType(e.target.value as 'income')}
                            className="mr-2"
                          />
                          <span className="text-sm">Income</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category Group (Optional)
                      </label>
                      <select
                        value={newCategoryGroupId}
                        onChange={(e) => setNewCategoryGroupId(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">None</option>
                        {categoryGroups?.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      {newCategoryGroupId && categoryGroups && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-600">Color:</span>
                          <div
                            className="w-5 h-5 rounded border border-gray-300"
                            style={{
                              backgroundColor: (() => {
                                const group = categoryGroups.find((g) => g.id === newCategoryGroupId);
                                return group ? getCategoryColor(group.baseColor, 0) : '#ccc';
                              })(),
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Category
                    </button>
                  </div>
                )}

                {/* Ignore checkbox */}
                <div className="mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isIgnored}
                      onChange={(e) => setIsIgnored(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isSaving}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Ignore this transaction in calculations
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Basic Info (Full Mode Only) */}
            {mode === 'full' && (
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
                    onChange={(e) => setRule({ ...rule, name: e.target.value })}
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
                      onClick={() => setRule({ ...rule, type: 'expense' })}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        rule.type === 'expense'
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Expense
                    </button>
                    <button
                      onClick={() => setRule({ ...rule, type: 'income' })}
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
                          Rule matches if at least one pattern matches.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start cursor-pointer flex-1 p-3 border-2 rounded-lg transition-colors hover:bg-gray-50">
                      <input
                        type="radio"
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
                          Rule matches only if all patterns match.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority: {rule.priority}
                    <span className="text-gray-500 font-normal ml-2">(Higher priority wins conflicts)</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rule.priority}
                    onChange={(e) => setRule({ ...rule, priority: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 (General)</span>
                    <span>5 (Normal)</span>
                    <span>10 (Very Specific)</span>
                  </div>
                </div>

                {/* Category Group */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Group
                    <span className="text-gray-500 font-normal ml-2">(Determines color and spending priority)</span>
                  </label>
                  <select
                    value={rule.groupId || ''}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None (Uncategorized)</option>
                    {categoryGroups?.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} - {group.description}
                      </option>
                    ))}
                  </select>
                  {rule.groupId && categoryGroups && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Color preview:</span>
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{
                          backgroundColor: (() => {
                            const group = categoryGroups.find((g) => g.id === rule.groupId);
                            return group ? getCategoryColor(group.baseColor, rule.colorVariant || 0) : '#ccc';
                          })(),
                        }}
                        title={`Variant ${rule.colorVariant || 0}`}
                      />
                      <span className="text-xs text-gray-500">Variant {rule.colorVariant || 0}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info message when uncategorized in quick mode */}
            {mode === 'quick' && !selectedCategory && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Select or create a category to add patterns that will automatically categorize similar transactions.
                </p>
              </div>
            )}

            {/* Patterns Section - Hidden in quick mode when uncategorized */}
            {(mode === 'full' || (mode === 'quick' && selectedCategory)) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Patterns {mode === 'full' && <span className="text-red-500">*</span>}
                  </h3>
                  <button
                    onClick={handleAddPattern}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    + Add Pattern
                  </button>
                </div>

                {/* Field Selection Hint */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New patterns will match against:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['payee', 'description', 'accountNumber', 'transactionType', 'currency', 'archiveId'].map(field => (
                      <label key={field} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field)}
                          onChange={() => {
                            const newFields = selectedFields.includes(field)
                              ? selectedFields.filter(f => f !== field)
                              : [...selectedFields, field];
                            if (newFields.length > 0) {
                              setSelectedFields(newFields);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm font-medium text-gray-900 capitalize">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <PatternList
                  patterns={rule.patterns}
                  onPatternsChange={handlePatternsChange}
                  expandedIndex={expandedPatternIndex}
                  onExpandedChange={setExpandedPatternIndex}
                  transactionContext={transaction}
                  categoryName={selectedCategory || rule.name}
                  showSuggestions={mode === 'quick'}
                  showConflicts={mode === 'quick'}
                  showPreview={mode === 'quick'}
                />
              </div>
            )}

            {/* Preview Section (Full Mode Only) */}
            {mode === 'full' && rule.patterns.length > 0 && rule.patterns.every(p => isValidPattern(p)) && (
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
            {!canSave && mode === 'full' && (
              <p className="text-sm text-red-600">
                Please complete all required fields with valid data.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedRuleEditor;
