import {useEffect, useState} from 'react';
import {formatCurrency, formatDate, logger} from '@/utils';
import {useLiveQuery} from 'dexie-react-hooks';
import type {CategoryRule, Pattern, Transaction} from '@/types';
import {db} from '@/services/db.ts';
import {calculatePatternWeight, extractPatternSuggestions} from '@/utils/patternExtractor.ts';
import {detectPatternConflicts, matchesPattern, recategorizeAll} from '@/services/categorizer.ts';
import {mergePatterns} from '@/utils/patternMerger.ts';
import {useToast} from "@/hooks/use-toast";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button.tsx";
import {Label} from '@/components/ui/label';

interface TransactionEditorProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: (transactionId: string, categoryName: string, ignored?: boolean) => Promise<void>;
}

/**
 * Modal editor for changing transaction category
 * Shows current category and confidence, allows selecting new category
 */
function TransactionEditor({transaction, onClose, onSave}: Readonly<TransactionEditorProps>) {
  const [selectedCategory, setSelectedCategory] = useState(transaction.category || '');
  const [isIgnored, setIsIgnored] = useState(transaction.ignored || false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');

  // Pattern management state
  const [addPatternEnabled, setAddPatternEnabled] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<'payee' | 'description'>>(new Set(['payee'] as ('payee' | 'description')[]));
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [customPattern, setCustomPattern] = useState('');
  const [patternWeight, setPatternWeight] = useState(5);
  const [conflictWarning, setConflictWarning] = useState<string[]>([]);
  const [affectedCount, setAffectedCount] = useState<number | null>(null);

  // Fetch all category rules from database
  const categoryRules = useLiveQuery(
    () => db.categoryRules.orderBy('name').toArray(),
    []
  );

  const { toast } = useToast();

  // Update selected category and ignored state when transaction changes
  useEffect(() => {
    setSelectedCategory(transaction.category || '');
    setIsIgnored(transaction.ignored || false);
  }, [transaction.category, transaction.ignored]);

  // Generate pattern suggestions from transaction
  const payeeSuggestions = extractPatternSuggestions(transaction.payee);
  const descriptionSuggestions = extractPatternSuggestions(transaction.description);

  // Update pattern weight when selected patterns change
  useEffect(() => {
    if (selectedPatterns.length > 0) {
      // Use the first selected pattern to calculate weight
      const weight = calculatePatternWeight(selectedPatterns[0]);
      setPatternWeight(weight);
    }
  }, [selectedPatterns]);

  // Check for conflicts and count affected transactions when patterns change
  useEffect(() => {
    const checkConflictsAndCount = async () => {
      if (!addPatternEnabled || selectedPatterns.length === 0 || !selectedCategory) {
        setConflictWarning([]);
        setAffectedCount(null);
        return;
      }

      // Create test patterns to check conflicts
      const testPatterns: Pattern[] = [];
      Array.from(selectedFields).forEach(field => {
        selectedPatterns.forEach(pattern => {
          testPatterns.push({
            field,
            matchType: 'wordlist',
            words: [{ text: pattern, negated: false }],
            caseSensitive: false,
            weight: patternWeight,
          });
        });
      });

      // Check conflicts for each pattern
      const allConflicts = new Set<string>();
      for (const pattern of testPatterns) {
        const conflicts = await detectPatternConflicts(pattern, selectedCategory, transaction);
        conflicts.forEach(c => allConflicts.add(c));
      }
      setConflictWarning(Array.from(allConflicts));

      // Count affected transactions
      const allTransactions = await db.transactions.toArray();
      const affected = allTransactions.filter(t => {
        if (t.manuallyEdited) return false;
        // Check if transaction would match any of the new patterns
        return testPatterns.some(pattern => matchesPattern(t, pattern));
      });
      setAffectedCount(affected.length);
    };

    checkConflictsAndCount();
  }, [addPatternEnabled, selectedPatterns, selectedFields, patternWeight, selectedCategory, transaction]);

  const handleToggleField = (field: 'payee' | 'description') => {
    const newFields = new Set(selectedFields);
    if (newFields.has(field)) {
      if (newFields.size > 1) { // Keep at least one field selected
        newFields.delete(field);
      }
    } else {
      newFields.add(field);
    }
    setSelectedFields(newFields);
  };

  const handleAddSuggestion = (pattern: string) => {
    if (!selectedPatterns.includes(pattern)) {
      setSelectedPatterns([...selectedPatterns, pattern]);
    }
  };

  const handleRemovePattern = (pattern: string) => {
    setSelectedPatterns(selectedPatterns.filter(p => p !== pattern));
  };

  const handleAddCustomPattern = () => {
    const trimmed = customPattern.trim();
    if (trimmed && !selectedPatterns.includes(trimmed)) {
      setSelectedPatterns([...selectedPatterns, trimmed]);
      setCustomPattern('');
    }
  };

  const handleSave = async () => {
    if (selectedCategory === transaction.category && !addPatternEnabled && isIgnored === transaction.ignored) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      if (addPatternEnabled && selectedPatterns.length > 0 && selectedCategory) {
        // Add patterns to the category rule
        const categoryRule = await db.categoryRules
          .filter(rule => rule.name === selectedCategory)
          .first();

        if (!categoryRule) {
          throw new Error('Category rule not found');
        }

        // Create new patterns
        const newPatterns: Pattern[] = [];
        Array.from(selectedFields).forEach(field => {
          selectedPatterns.forEach(pattern => {
            newPatterns.push({
              field,
              matchType: 'wordlist',
              words: [{ text: pattern, negated: false }],
              caseSensitive: false,
              weight: patternWeight,
            });
          });
        });

        // Update the category rule with new patterns (merge intelligently)
        await db.categoryRules.update(categoryRule.id, {
          patterns: mergePatterns(categoryRule.patterns, newPatterns),
          updatedAt: new Date(),
        });

        // Update THIS transaction with manuallyEdited = FALSE (since we're using patterns)
        await db.transactions.update(transaction.id, {
          category: selectedCategory,
          manuallyEdited: false,
          ignored: isIgnored,
        });

        // Recategorize all transactions that aren't manually edited
        await recategorizeAll();
      } else {
        // Original behavior: manual edit without patterns
        await onSave(transaction.id, selectedCategory, isIgnored);
      }

      onClose();
    } catch (error) {
      logger.error('Failed to save category:', error);
      toast({ title: "Error", description: "Failed to save category. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast({ title: "Error", description: "Please enter a category name", variant: "destructive" });
      return;
    }

    // Check if category already exists
    const existing = categoryRules?.find(r => r.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      toast({ title: "Error", description: "A category with this name already exists", variant: "destructive" });
      return;
    }

    try {
      // Create the new category rule with default settings
      const newRule: CategoryRule = {
        id: crypto.randomUUID(),
        name: trimmedName,
        patterns: [],
        patternLogic: 'OR',
        priority: 1,
        type: newCategoryType,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.categoryRules.add(newRule);

      // Select the newly created category
      setSelectedCategory(trimmedName);
      setIsCreatingNew(false);
      setNewCategoryName('');

      // Show success message
      toast({ title: "Success", description: `Category "${trimmedName}" created successfully! You can add patterns to it later in the Categories tab.` });
    } catch (error) {
      logger.error('Failed to create category:', error);
      toast({ title: "Error", description: "Failed to create category. Please try again.", variant: "destructive" });
    }
  };



  const isIncome = transaction.type === 'credit';

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction Category</DialogTitle>
        </DialogHeader>

        {/* Transaction Details */}
        <div className="py-4 bg-gray-50 border-b border-gray-200 -mx-6 px-6 mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Date:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatDate(new Date(transaction.date))}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Amount:</span>
              <span
                className={`ml-2 font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'
                  }`}
              >
                {isIncome ? '+' : '-'}
                {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Payee:</span>
              <span className="ml-2 font-medium text-gray-900">
                {transaction.payee}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Description:</span>
              <span className="ml-2 text-gray-700">
                {transaction.description}
              </span>
            </div>
          </div>

          {/* Current category info */}
          {transaction.category && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">Current category:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {transaction.category}
                </span>
                {transaction.categoryConfidence !== undefined &&
                  !transaction.manuallyEdited && (
                    <span className="text-xs text-gray-600">
                      (Confidence: {transaction.categoryConfidence}%)
                    </span>
                  )}
                {transaction.manuallyEdited && (
                  <span className="text-xs text-purple-600">
                    (Manually edited)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Category Selector */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-2">
            <Label
              htmlFor="category-select"
              className="block text-sm font-medium text-gray-700"
            >
              Select Category
            </Label>
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
            <>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSaving}
              >
                <option value="">Uncategorized</option>
                {categoryRules?.map((rule) => (
                  <option key={rule.id} value={rule.name}>
                    {rule.name} ({rule.type})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Changes will mark the transaction as manually edited
              </p>
            </>
          ) : (
            <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div>
                <Label
                  htmlFor="new-category-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Category Name
                </Label>
                <input
                  id="new-category-name"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Entertainment"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </Label>
                <div className="flex gap-3">
                  <Label className="flex items-center">
                    <input
                      type="radio"
                      value="expense"
                      checked={newCategoryType === 'expense'}
                      onChange={(e) => setNewCategoryType(e.target.value as 'expense')}
                      className="mr-2"
                    />
                    <span className="text-sm">Expense</span>
                  </Label>
                  <Label className="flex items-center">
                    <input
                      type="radio"
                      value="income"
                      checked={newCategoryType === 'income'}
                      onChange={(e) => setNewCategoryType(e.target.value as 'income')}
                      className="mr-2"
                    />
                    <span className="text-sm">Income</span>
                  </Label>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Category
              </button>
              <p className="text-xs text-gray-500">
                Note: You can add patterns to match transactions later in the Categories tab.
              </p>
            </div>
          )}
        </div>

        {/* Ignore Transaction */}
        <div className="py-4 border-t border-gray-200">
          <Label className="flex items-center gap-2">
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
          </Label>
          <p className="mt-1 ml-6 text-xs text-gray-500">
            When checked, this transaction will be excluded from all percentage and summary calculations
          </p>
        </div>

        {/* Pattern Configuration */}
        {!isCreatingNew && selectedCategory && (
          <div className="py-4 border-t border-gray-200">
            <Label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={addPatternEnabled}
                onChange={(e) => setAddPatternEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSaving}
              />
              <span className="text-sm font-medium text-gray-900">
                Add pattern to auto-categorize similar transactions
              </span>
            </Label>

            {addPatternEnabled && (
              <div className="ml-6 space-y-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                {/* Field Selection */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Match against fields:
                  </Label>
                  <div className="flex gap-4">
                    <Label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFields.has('payee')}
                        onChange={() => handleToggleField('payee')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm">Payee</span>
                    </Label>
                    <Label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFields.has('description')}
                        onChange={() => handleToggleField('description')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm">Description</span>
                    </Label>
                  </div>
                </div>

                {/* Suggested Patterns from Payee */}
                {selectedFields.has('payee') && payeeSuggestions.length > 0 && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Suggested patterns from Payee:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {payeeSuggestions.map((suggestion, idx) => (
                        <button
                          key={`payee-${idx}`}
                          type="button"
                          onClick={() => handleAddSuggestion(suggestion)}
                          disabled={selectedPatterns.includes(suggestion)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          "{suggestion}" <span className="ml-1 text-blue-600">+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Patterns from Description */}
                {selectedFields.has('description') && descriptionSuggestions.length > 0 && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Suggested patterns from Description:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {descriptionSuggestions.map((suggestion, idx) => (
                        <button
                          key={`desc-${idx}`}
                          type="button"
                          onClick={() => handleAddSuggestion(suggestion)}
                          disabled={selectedPatterns.includes(suggestion)}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          "{suggestion}" <span className="ml-1 text-blue-600">+ Add</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Pattern Input */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Or enter custom pattern:
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCustomPattern()}
                      placeholder="e.g., Restaurant name"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPattern}
                      disabled={!customPattern.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Selected Patterns */}
                {selectedPatterns.length > 0 && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected patterns:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatterns.map((pattern, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                        >
                          "{pattern}"
                          <button
                            type="button"
                            onClick={() => handleRemovePattern(pattern)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weight Slider */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Pattern weight: {patternWeight}
                    <span className="ml-1 text-xs text-gray-500">
                      (higher = more specific)
                    </span>
                  </Label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={patternWeight}
                    onChange={(e) => setPatternWeight(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 (less specific)</span>
                    <span>10 (very specific)</span>
                  </div>
                </div>

                {/* Conflict Warning */}
                {conflictWarning.length > 0 && (
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
                {affectedCount !== null && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      📊 Preview: <strong>~{affectedCount} transaction{affectedCount !== 1 ? 's' : ''}</strong> will be affected by this pattern
                    </p>
                  </div>
                )}

                {/* Helper Text */}
                <p className="text-xs text-gray-500">
                  Patterns will be saved to the category rule and automatically applied to all matching transactions.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (selectedCategory === transaction.category && !(addPatternEnabled && selectedPatterns.length > 0) && isIgnored === (transaction.ignored || false))}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TransactionEditor;
