import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { recategorizeAll } from '../../services/categorizer';
import type { CategoryRule, CategoryGroup } from '../../types';
import { getCategoryColor } from '../../utils/colorUtils';
import RuleEditor from './RuleEditor';

type SortField = 'name' | 'type' | 'priority' | 'patternCount';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'income' | 'expense';

function CategoryManager() {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterGroupId, setFilterGroupId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRecategorizing, setIsRecategorizing] = useState(false);

  // Fetch all rules and groups with live updates
  const allRules = useLiveQuery(() => db.categoryRules.toArray(), []);
  const allGroups = useLiveQuery(() => db.categoryGroups.orderBy('sortOrder').toArray(), []);

  // Apply filters and sorting
  const filteredRules = allRules
    ? allRules
        .filter(rule => {
          // Filter by type
          if (filterType !== 'all' && rule.type !== filterType) {
            return false;
          }
          // Filter by group
          if (filterGroupId !== 'all') {
            if (filterGroupId === 'none' && rule.groupId) {
              return false;
            }
            if (filterGroupId !== 'none' && rule.groupId !== filterGroupId) {
              return false;
            }
          }
          // Filter by search query
          if (searchQuery && !rule.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          let comparison = 0;
          switch (sortField) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'type':
              comparison = a.type.localeCompare(b.type);
              break;
            case 'priority':
              comparison = a.priority - b.priority;
              break;
            case 'patternCount':
              comparison = a.patterns.length - b.patterns.length;
              break;
          }
          return sortDirection === 'asc' ? comparison : -comparison;
        })
    : [];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (rule: CategoryRule) => {
    if (window.confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
      try {
        await db.categoryRules.delete(rule.id);

        // Ask if user wants to re-categorize after deletion
        if (window.confirm('Rule deleted. Re-categorize all transactions with updated rules?')) {
          setIsRecategorizing(true);
          try {
            const count = await recategorizeAll();
            alert(`Successfully re-categorized ${count} transactions.`);
          } catch (error) {
            console.error('Error re-categorizing:', error);
            alert('Failed to re-categorize transactions. Please try again.');
          } finally {
            setIsRecategorizing(false);
          }
        }
      } catch (error) {
        console.error('Error deleting rule:', error);
        alert('Failed to delete rule. Please try again.');
      }
    }
  };

  const handleDuplicate = async (rule: CategoryRule) => {
    const newRule: CategoryRule = {
      ...rule,
      id: crypto.randomUUID(),
      name: `${rule.name} (Copy)`,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await db.categoryRules.add(newRule);
      setEditingRule(newRule);
    } catch (error) {
      console.error('Error duplicating rule:', error);
      alert('Failed to duplicate rule. Please try again.');
    }
  };

  const handleRecategorizeAll = async () => {
    if (window.confirm('This will re-categorize all transactions that have not been manually edited. Continue?')) {
      setIsRecategorizing(true);
      try {
        const count = await recategorizeAll();
        alert(`Successfully re-categorized ${count} transactions.`);
      } catch (error) {
        console.error('Error re-categorizing:', error);
        alert('Failed to re-categorize transactions. Please try again.');
      } finally {
        setIsRecategorizing(false);
      }
    }
  };

  const handleSaveRule = async (rule: CategoryRule) => {
    try {
      if (isCreating) {
        await db.categoryRules.add(rule);
      } else {
        await db.categoryRules.update(rule.id, rule);
      }
      setEditingRule(null);
      setIsCreating(false);

      // Ask if user wants to re-categorize after saving
      if (window.confirm('Rule saved. Re-categorize all transactions with updated rules?')) {
        setIsRecategorizing(true);
        try {
          const count = await recategorizeAll();
          alert(`Successfully re-categorized ${count} transactions.`);
        } catch (error) {
          console.error('Error re-categorizing:', error);
          alert('Failed to re-categorize transactions. Please try again.');
        } finally {
          setIsRecategorizing(false);
        }
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Failed to save rule. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsCreating(false);
  };

  const handleExportRules = async () => {
    try {
      const rules = await db.categoryRules.toArray();
      const dataStr = JSON.stringify(rules, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `category-rules-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting rules:', error);
      alert('Failed to export rules. Please try again.');
    }
  };

  const handleImportRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedRules = JSON.parse(text) as CategoryRule[];

        // Validate the imported data
        if (!Array.isArray(importedRules)) {
          throw new Error('Invalid file format: expected an array of rules');
        }

        // Ask user how to handle import
        const mode = window.confirm(
          `Import ${importedRules.length} rules. Click OK to ADD to existing rules, or Cancel to REPLACE all rules.`
        ) ? 'add' : 'replace';

        if (mode === 'replace') {
          // Delete all existing rules
          await db.categoryRules.clear();
        }

        // Import rules with new IDs and timestamps
        const rulesToAdd = importedRules.map(rule => ({
          ...rule,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDefault: false, // Mark imported rules as non-default
        }));

        await db.categoryRules.bulkAdd(rulesToAdd);

        alert(`Successfully imported ${rulesToAdd.length} rules.`);

        // Ask if user wants to re-categorize
        if (window.confirm('Re-categorize all transactions with the new rules?')) {
          handleRecategorizeAll();
        }
      } catch (error) {
        console.error('Error importing rules:', error);
        alert(`Failed to import rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    input.click();
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!allRules) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading rules...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Category Rules</h1>
        <p className="text-gray-600">
          Manage rules for automatic transaction categorization. {allRules.length} rule{allRules.length !== 1 ? 's' : ''} total.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter by type */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'expense'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'income'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Income
          </button>
        </div>

        {/* Filter by group */}
        <div className="min-w-48">
          <select
            value={filterGroupId}
            onChange={e => setFilterGroupId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Groups</option>
            <option value="none">No Group</option>
            {allGroups?.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingRule({
                id: crypto.randomUUID(),
                name: '',
                patterns: [],
                patternLogic: 'OR',
                priority: 1,
                type: 'expense',
                isDefault: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            + Add New Rule
          </button>
          <button
            onClick={handleRecategorizeAll}
            disabled={isRecategorizing}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isRecategorizing ? 'Processing...' : 'Re-categorize All'}
          </button>
          <button
            onClick={handleExportRules}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
          >
            📥 Export Rules
          </button>
          <button
            onClick={handleImportRules}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
          >
            📤 Import Rules
          </button>
        </div>
      </div>

      {/* Rules table */}
      {filteredRules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery || filterType !== 'all' ? (
            <>No rules match your filters.</>
          ) : (
            <>No category rules yet. Create one to get started!</>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Name {getSortIcon('name')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('type')}
                >
                  Type {getSortIcon('type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priority')}
                >
                  Priority {getSortIcon('priority')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('patternCount')}
                >
                  Patterns {getSortIcon('patternCount')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{rule.name}</span>
                      {rule.isDefault && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Default
                        </span>
                      )}
                      {rule.patternLogic === 'AND' && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          AND
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        rule.type === 'income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {rule.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {rule.groupId && allGroups ? (
                      (() => {
                        const group = allGroups.find(g => g.id === rule.groupId);
                        if (group) {
                          const color = getCategoryColor(group.baseColor, rule.colorVariant || 0);
                          return (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: color }}
                                title={`${group.name} (Variant ${rule.colorVariant || 0})`}
                              />
                              <span className="text-sm text-gray-700">{group.name}</span>
                            </div>
                          );
                        }
                        return <span className="text-xs text-gray-400">Unknown</span>;
                      })()
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{rule.priority}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {rule.patterns.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(rule)}
                      className="text-green-600 hover:text-green-900 mr-3"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rule Editor Modal */}
      {editingRule && (
        <RuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

export default CategoryManager;
