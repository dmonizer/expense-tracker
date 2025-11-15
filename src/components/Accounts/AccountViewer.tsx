import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import type { Account, CategoryRule } from '../../types';
import LoadingSpinner from '../UI/LoadingSpinner';
import { cleanupDuplicateAccounts, rebuildAccountingFromTransactions } from '../../services/databaseCleanup';
import { calculateAccountBalance, getDisplayBalance } from '../../services/journalEntryManager';
import { formatCurrency } from '../../utils/currencyUtils';
import AccountDetailView from './AccountDetailView';
import HoldingsManager from './HoldingsManager';

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

interface AccountWithDetails extends Account {
  linkedCategoryRule?: CategoryRule;
  splitCount?: number;
  currentBalance?: number;
  balanceCurrency?: string;
}

function AccountViewer() {
  const [accounts, setAccounts] = useState<AccountWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AccountType | 'all'>('all');
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [rebuildRunning, setRebuildRunning] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState<Account | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [managingHoldingsAccount, setManagingHoldingsAccount] = useState<Account | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: AccountType;
    subtype: string;
    currency: string;
    institution: string;
    accountNumber: string;
    openingBalance: string;
  }>({
    name: '',
    type: 'asset',
    subtype: '',
    currency: 'EUR',
    institution: '',
    accountNumber: '',
    openingBalance: '0',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCleanup = async () => {
    if (!confirm('This will remove duplicate accounts and update all references. Continue?')) {
      return;
    }

    try {
      setCleanupRunning(true);
      setCleanupResult(null);

      const result = await cleanupDuplicateAccounts();
      
      setCleanupResult(
        `Cleanup complete! Removed ${result.duplicatesRemoved} duplicates. ` +
        `Kept ${result.uniqueAccountsKept} unique accounts.`
      );

      // Reload accounts
      await loadAccounts();
    } catch (err) {
      console.error('Cleanup failed:', err);
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleRebuild = async () => {
    if (!confirm(
      'This will rebuild all accounts and journal entries from your transactions. ' +
      'Your transactions and categories will be preserved. ' +
      'This will fix categorization issues. Continue?'
    )) {
      return;
    }

    try {
      setRebuildRunning(true);
      setRebuildResult(null);

      const result = await rebuildAccountingFromTransactions();
      
      setRebuildResult(
        `Rebuild complete! Processed ${result.transactionsProcessed} transactions, ` +
        `created ${result.accountsCreated} accounts, and ${result.journalEntriesCreated} journal entries.`
      );

      // Reload accounts
      await loadAccounts();
    } catch (err) {
      console.error('Rebuild failed:', err);
      setError(err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      setRebuildRunning(false);
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setEditName(account.name);
  };

  const handleSaveAccountName = async () => {
    if (!editingAccount || !editName.trim()) {
      return;
    }

    try {
      const { updateAccountName } = await import('../../services/accountManager');
      await updateAccountName(editingAccount.id, editName.trim());
      setEditingAccount(null);
      setEditName('');
      await loadAccounts();
    } catch (err) {
      console.error('Failed to update account:', err);
      setError(err instanceof Error ? err.message : 'Failed to update account');
    }
  };

  const handleEditOpeningBalance = (account: Account) => {
    setEditingOpeningBalance(account);
    // Display balance for income/liability is flipped, so we need to flip it back for editing
    const displayBal = getDisplayBalance(account.openingBalance, account.type);
    setOpeningBalance(displayBal.toString());
  };

  const handleSaveOpeningBalance = async () => {
    if (!editingOpeningBalance) {
      return;
    }

    const balance = parseFloat(openingBalance);
    if (isNaN(balance)) {
      setError('Please enter a valid number');
      return;
    }

    try {
      const { updateAccountOpeningBalance } = await import('../../services/accountManager');
      // Convert display balance back to accounting balance for storage
      const accountingBalance = getDisplayBalance(balance, editingOpeningBalance.type);
      await updateAccountOpeningBalance(editingOpeningBalance.id, accountingBalance);
      setEditingOpeningBalance(null);
      setOpeningBalance('');
      await loadAccounts();
    } catch (err) {
      console.error('Failed to update opening balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to update opening balance');
    }
  };

  const handleViewTransactions = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) {
      setError('Account name is required');
      return;
    }

    try {
      const { v4: uuidv4 } = await import('uuid');
      const balance = parseFloat(newAccount.openingBalance) || 0;
      // Convert display balance to accounting balance if needed
      const accountingBalance = getDisplayBalance(balance, newAccount.type);

      const account: Account = {
        id: uuidv4(),
        name: newAccount.name.trim(),
        type: newAccount.type,
        subtype: (newAccount.subtype || undefined) as Account['subtype'],
        currency: newAccount.currency,
        institution: newAccount.institution || undefined,
        accountNumber: newAccount.accountNumber || undefined,
        supportedCurrencies: [newAccount.currency],
        isActive: true,
        openingBalance: accountingBalance,
        openingBalanceDate: new Date(),
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.accounts.add(account);

      // Reset form
      setIsCreatingAccount(false);
      setNewAccount({
        name: '',
        type: 'asset',
        subtype: '',
        currency: 'EUR',
        institution: '',
        accountNumber: '',
        openingBalance: '0',
      });

      await loadAccounts();
    } catch (err) {
      console.error('Failed to create account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all accounts
      const allAccounts = await db.accounts.toArray();

      // Get category rules for linking
      const categoryRules = await db.categoryRules.toArray();
      const categoryRuleMap = new Map(categoryRules.map(r => [r.id, r]));

      // Get split counts and balances for each account
      const accountsWithDetails: AccountWithDetails[] = await Promise.all(
        allAccounts.map(async (account) => {
          const splitCount = await db.splits
            .where('accountId')
            .equals(account.id)
            .count();

          // Calculate current balance
          let currentBalance = account.openingBalance;
          let balanceCurrency = account.currency;

          try {
            const balanceResult = await calculateAccountBalance(account.id, new Date());
            // Use display balance (flips sign for income/liability accounts)
            currentBalance = getDisplayBalance(balanceResult.balance, account.type);
            balanceCurrency = balanceResult.currency;
          } catch (error) {
            console.error(`Failed to calculate balance for ${account.name}:`, error);
          }

          return {
            ...account,
            linkedCategoryRule: account.categoryRuleId 
              ? categoryRuleMap.get(account.categoryRuleId)
              : undefined,
            splitCount,
            currentBalance,
            balanceCurrency,
          };
        })
      );

      // Sort by type, then by name
      accountsWithDetails.sort((a, b) => {
        const typeOrder: Record<AccountType, number> = {
          asset: 1,
          liability: 2,
          equity: 3,
          income: 4,
          expense: 5,
        };
        
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        
        return a.name.localeCompare(b.name);
      });

      setAccounts(accountsWithDetails);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeIcon = (type: AccountType): string => {
    switch (type) {
      case 'asset':
        return '🏦';
      case 'liability':
        return '💳';
      case 'equity':
        return '⚖️';
      case 'income':
        return '💰';
      case 'expense':
        return '💸';
    }
  };

  const getAccountTypeLabel = (type: AccountType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getAccountTypeBadgeColor = (type: AccountType): string => {
    switch (type) {
      case 'asset':
        return 'bg-blue-100 text-blue-800';
      case 'liability':
        return 'bg-red-100 text-red-800';
      case 'equity':
        return 'bg-purple-100 text-purple-800';
      case 'income':
        return 'bg-green-100 text-green-800';
      case 'expense':
        return 'bg-orange-100 text-orange-800';
    }
  };

  const filteredAccounts = selectedType === 'all'
    ? accounts
    : accounts.filter(a => a.type === selectedType);

  const accountsByType = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<AccountType, AccountWithDetails[]>);

  const accountTypeStats = Object.entries(accountsByType).map(([type, accs]) => ({
    type: type as AccountType,
    count: accs.length,
    totalSplits: accs.reduce((sum, a) => sum + (a.splitCount || 0), 0),
  }));

  if (loading) {
    return <LoadingSpinner text="Loading accounts..." />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-900 font-semibold">Error</h3>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Account Overview
            </h2>
            <p className="text-gray-600">
              Double-entry accounting system - All accounts and their details
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsCreatingAccount(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              ➕ Create Account
            </button>

            <button
              onClick={handleRebuild}
              disabled={rebuildRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {rebuildRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Rebuilding...
                </>
              ) : (
                <>
                  🔄 Rebuild from Transactions
                </>
              )}
            </button>

            <button
              onClick={handleCleanup}
              disabled={cleanupRunning}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {cleanupRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Cleaning...
                </>
              ) : (
                <>
                  🧹 Remove Duplicates
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Result messages */}
        {cleanupResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div>
                <h3 className="font-semibold text-green-900">Cleanup Successful</h3>
                <p className="text-sm text-green-800 mt-1">{cleanupResult}</p>
              </div>
            </div>
          </div>
        )}
        
        {rebuildResult && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div>
                <h3 className="font-semibold text-blue-900">Rebuild Successful</h3>
                <p className="text-sm text-blue-800 mt-1">{rebuildResult}</p>
                <p className="text-sm text-blue-700 mt-2">
                  All accounts and journal entries have been recreated from your transactions. 
                  Categories should now be properly linked.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {accountTypeStats.map(({ type, count, totalSplits }) => (
          <div
            key={type}
            className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedType === type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => setSelectedType(selectedType === type ? 'all' : type)}
          >
            <div className="text-2xl mb-1">{getAccountTypeIcon(type)}</div>
            <div className="text-sm font-semibold text-gray-900">
              {getAccountTypeLabel(type)}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {totalSplits} transaction{totalSplits !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <button
          onClick={() => setSelectedType('all')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            selectedType === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({accounts.length})
        </button>
        {(['asset', 'expense', 'income', 'liability', 'equity'] as AccountType[]).map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {getAccountTypeLabel(type)} ({accountsByType[type]?.length || 0})
          </button>
        ))}
      </div>

      {/* Accounts List */}
      <div className="space-y-3">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-600">No accounts found</p>
            <p className="text-sm text-gray-500 mt-1">
              Import transactions to create accounts automatically
            </p>
          </div>
        ) : selectedAccountId ? (
          // Show account detail view (we'll create this component next)
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <button
              onClick={() => setSelectedAccountId(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              ← Back to all accounts
            </button>
            <AccountDetailView accountId={selectedAccountId} />
          </div>
        ) : (
          filteredAccounts.map(account => (
            <div
              key={account.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                {/* Left side - Account info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getAccountTypeIcon(account.type)}</span>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {account.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getAccountTypeBadgeColor(
                        account.type
                      )}`}
                    >
                      {getAccountTypeLabel(account.type)}
                    </span>
                    {account.isSystem && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        System
                      </span>
                    )}
                  </div>

                  {account.description && (
                    <p className="text-sm text-gray-600 mb-2">{account.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Currency */}
                    <div>
                      <span className="text-gray-500">Currency:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {account.currency}
                      </span>
                      {account.supportedCurrencies.length > 1 && (
                        <span className="text-gray-500 ml-1">
                          (+{account.supportedCurrencies.length - 1} more)
                        </span>
                      )}
                    </div>

                    {/* Transaction count */}
                    <div>
                      <span className="text-gray-500">Transactions:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {account.splitCount || 0}
                      </span>
                    </div>

                    {/* Account number (for bank accounts) */}
                    {account.accountNumber && (
                      <div>
                        <span className="text-gray-500">Account #:</span>{' '}
                        <span className="font-medium text-gray-900 font-mono text-xs">
                          {account.accountNumber}
                        </span>
                      </div>
                    )}

                    {/* Institution (for bank accounts) */}
                    {account.institution && (
                      <div>
                        <span className="text-gray-500">Institution:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {account.institution}
                        </span>
                      </div>
                    )}

                    {/* Subtype */}
                    {account.subtype && (
                      <div>
                        <span className="text-gray-500">Subtype:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {account.subtype}
                        </span>
                      </div>
                    )}

                    {/* Linked category */}
                    {account.linkedCategoryRule && (
                      <div>
                        <span className="text-gray-500">Linked to category:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {account.linkedCategoryRule.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      Created: {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                    {!account.isActive && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side - Current balance */}
                <div className="text-right ml-4">
                  <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                  <div className={`text-xl font-bold ${
                    account.currentBalance !== undefined
                      ? account.currentBalance >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                      : 'text-gray-900'
                  }`}>
                    {account.currentBalance !== undefined
                      ? formatCurrency(account.currentBalance, account.balanceCurrency || account.currency)
                      : formatCurrency(account.openingBalance, account.currency)}
                  </div>
                  {account.openingBalance !== 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Opening: {formatCurrency(getDisplayBalance(account.openingBalance, account.type), account.currency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2 flex-wrap">
                <button
                  onClick={() => handleViewTransactions(account.id)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  📊 View Transactions
                </button>
                <button
                  onClick={() => handleEditAccount(account)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  ✏️ Rename
                </button>
                {(account.type === 'asset' || account.type === 'liability') && (
                  <button
                    onClick={() => handleEditOpeningBalance(account)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
                  >
                    💰 Set Opening Balance
                  </button>
                )}
                {account.subtype === 'investment' && (
                  <button
                    onClick={() => setManagingHoldingsAccount(account)}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1"
                  >
                    📊 Manage Holdings
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rename Dialog Modal */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rename Account
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter account name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAccountName();
                  } else if (e.key === 'Escape') {
                    setEditingAccount(null);
                    setEditName('');
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setEditName('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccountName}
                disabled={!editName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Dialog Modal */}
      {editingOpeningBalance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Set Opening Balance
            </h3>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>{editingOpeningBalance.name}</strong> ({editingOpeningBalance.type})
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {editingOpeningBalance.type === 'asset'
                  ? 'Enter the amount you have in this account as a positive number. Example: 5000 for €5,000 in the bank.'
                  : 'Enter the amount you owe as a positive number. Example: 1000 for €1,000 of debt. (Net worth will subtract this automatically)'}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Balance ({editingOpeningBalance.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveOpeningBalance();
                  } else if (e.key === 'Escape') {
                    setEditingOpeningBalance(null);
                    setOpeningBalance('');
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditingOpeningBalance(null);
                  setOpeningBalance('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOpeningBalance}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Dialog Modal */}
      {isCreatingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Account
            </h3>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Swedbank Stocks, ING Savings, Nordea Checking"
                  autoFocus
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType, subtype: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="asset">Asset (Bank account, Cash, Investments)</option>
                  <option value="liability">Liability (Credit card, Loan)</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              {/* Subtype */}
              {(newAccount.type === 'asset' || newAccount.type === 'liability') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtype
                  </label>
                  <select
                    value={newAccount.subtype}
                    onChange={(e) => setNewAccount({ ...newAccount, subtype: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select subtype</option>
                    {newAccount.type === 'asset' && (
                      <>
                        <option value="checking">Checking</option>
                        <option value="savings">Savings</option>
                        <option value="investment">Investment (Stocks, Funds, Crypto)</option>
                        <option value="cash">Cash</option>
                        <option value="other">Other</option>
                      </>
                    )}
                    {newAccount.type === 'liability' && (
                      <>
                        <option value="credit_card">Credit Card</option>
                        <option value="loan">Loan</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={newAccount.currency}
                  onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="SEK">SEK - Swedish Krona</option>
                  <option value="NOK">NOK - Norwegian Krone</option>
                  <option value="DKK">DKK - Danish Krone</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                </select>
              </div>

              {/* Institution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution / Provider
                </label>
                <input
                  type="text"
                  value={newAccount.institution}
                  onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Swedbank, ING, Nordnet"
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={newAccount.accountNumber}
                  onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., SE123456789"
                />
              </div>

              {/* Opening Balance */}
              {(newAccount.type === 'asset' || newAccount.type === 'liability') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccount.openingBalance}
                    onChange={(e) => setNewAccount({ ...newAccount, openingBalance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {newAccount.type === 'asset'
                      ? 'Enter as positive (e.g., 5000 for €5,000 in the account)'
                      : 'Enter debt as positive (e.g., 1000 for €1,000 owed)'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setIsCreatingAccount(false);
                  setNewAccount({
                    name: '',
                    type: 'asset',
                    subtype: '',
                    currency: 'EUR',
                    institution: '',
                    accountNumber: '',
                    openingBalance: '0',
                  });
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={!newAccount.name.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holdings Manager */}
      {managingHoldingsAccount && (
        <HoldingsManager
          account={managingHoldingsAccount}
          onClose={() => setManagingHoldingsAccount(null)}
        />
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              About Double-Entry Accounting
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              Your expense tracker now uses proper double-entry bookkeeping behind the scenes:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                <strong>Asset accounts</strong> represent your bank accounts and cash
              </li>
              <li>
                <strong>Expense accounts</strong> are auto-created from your categories
              </li>
              <li>
                <strong>Income accounts</strong> track money coming in
              </li>
              <li>
                <strong>System accounts</strong> are used for opening balances and uncategorized
                transactions
              </li>
              <li>
                Every transaction creates balanced journal entries with debits and credits
              </li>
            </ul>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Note:</strong> All your existing categories continue to work as before.
              They're now linked to expense/income accounts automatically!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountViewer;
