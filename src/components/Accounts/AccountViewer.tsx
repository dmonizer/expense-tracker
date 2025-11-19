import { useState, useCallback } from 'react';
import { logger } from '../../utils';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../services/db';
import type { Account } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import { cleanupDuplicateAccounts, rebuildAccountingFromTransactions } from '../../services/databaseCleanup';
import { getDisplayBalance } from '../../services/journalEntryManager';
import { updateAccount, updateAccountOpeningBalance } from '../../services/accountManager';
import { formatCurrency } from '../../utils/currencyUtils';
import {
  getAccountTypeIcon,
  getAccountTypeLabel,
  getAccountTypeBadgeColor,
  type AccountType
} from '../../utils/accountTypeHelpers';
import type { AccountSubtype } from '../../types';
import { useAccounts, useAccountFiltering, type AccountWithDetails } from '../../hooks/useAccounts';
import { EditAccountModal, OpeningBalanceModal, CreateAccountModal } from './AccountModals';
import AccountDetailView from './AccountDetailView';
import HoldingsManager from './HoldingsManager';
import { useConfirm } from "@/components/ui/confirm-provider";
import { useToast } from "@/hooks/use-toast";

function AccountViewer() {
  // Custom hooks
  const { accounts, loading, error: loadError, reload } = useAccounts();
  const {
    selectedType,
    setSelectedType,
    filteredAccounts,
    accountsByType,
    accountTypeStats
  } = useAccountFiltering(accounts);

  const { confirm } = useConfirm();
  const { toast } = useToast();

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [rebuildRunning, setRebuildRunning] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [managingHoldingsAccount, setManagingHoldingsAccount] = useState<Account | null>(null);

  // Modal state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingBalanceAccount, setEditingBalanceAccount] = useState<Account | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Combine errors
  const displayError = loadError || error;

  /**
   * Handle cleanup of duplicate accounts
   */
  const handleCleanup = useCallback(async () => {
    if (await confirm({
      title: 'Cleanup Duplicates',
      description: 'This will remove duplicate accounts and update all references. Continue?',
      confirmText: 'Cleanup'
    })) {
      try {
        setCleanupRunning(true);
        setError(null);

        const result = await cleanupDuplicateAccounts();

        toast({
          title: "Cleanup Complete",
          description: `Removed ${result.duplicatesRemoved} duplicates. Kept ${result.uniqueAccountsKept} unique accounts.`
        });

        await reload();
      } catch (err) {
        logger.error('Cleanup failed:', err);
        toast({ title: "Error", description: err instanceof Error ? err.message : 'Cleanup failed', variant: "destructive" });
      } finally {
        setCleanupRunning(false);
      }
    }
  }, [reload, confirm, toast]);

  /**
   * Handle rebuild of accounting system from transactions
   */
  const handleRebuild = useCallback(async () => {
    if (await confirm({
      title: 'Rebuild Accounting',
      description: 'This will rebuild all accounts and journal entries from your transactions. Your transactions and categories will be preserved. This will fix categorization issues. Continue?',
      confirmText: 'Rebuild'
    })) {
      try {
        setRebuildRunning(true);
        setError(null);

        const result = await rebuildAccountingFromTransactions();

        toast({
          title: "Rebuild Complete",
          description: `Processed ${result.transactionsProcessed} transactions, created ${result.accountsCreated} accounts, and ${result.journalEntriesCreated} journal entries.`
        });

        await reload();
      } catch (err) {
        logger.error('Rebuild failed:', err);
        toast({ title: "Error", description: err instanceof Error ? err.message : 'Rebuild failed', variant: "destructive" });
      } finally {
        setRebuildRunning(false);
      }
    }
  }, [reload, confirm, toast]);

  /**
   * Handle account edit
   */
  const handleEditAccount = useCallback(async (accountId: string, updates: {
    name?: string;
    description?: string;
    color?: string;
    institution?: string;
    subtype?: AccountSubtype;
    isActive?: boolean;
    accountNumber?: string;
    supportedCurrencies?: string[];
  }) => {
    try {
      await updateAccount(accountId, updates);
      await reload();
    } catch (err) {
      logger.error('Failed to update account:', err);
      throw err;
    }
  }, [reload]);

  /**
   * Handle opening balance update
   */
  const handleUpdateOpeningBalance = useCallback(async (accountId: string, balance: number) => {
    try {
      await updateAccountOpeningBalance(accountId, balance);
      await reload();
    } catch (err) {
      logger.error('Failed to update opening balance:', err);
      throw err;
    }
  }, [reload]);

  /**
   * Handle account creation
   */
  const handleCreateAccount = useCallback(async (formData: {
    name: string;
    type: AccountType;
    subtype: string;
    currency: string;
    institution: string;
    accountNumber: string;
    openingBalance: string;
  }) => {
    const balance = parseFloat(formData.openingBalance) || 0;
    const accountingBalance = getDisplayBalance(balance, formData.type);

    const account: Account = {
      id: uuidv4(),
      name: formData.name.trim(),
      type: formData.type,
      subtype: (formData.subtype || undefined) as Account['subtype'],
      currency: formData.currency,
      institution: formData.institution || undefined,
      accountNumber: formData.accountNumber || undefined,
      supportedCurrencies: [formData.currency],
      isActive: true,
      openingBalance: accountingBalance,
      openingBalanceDate: new Date(),
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.accounts.add(account);
    await reload();
  }, [reload]);

  if (loading) {
    return <LoadingSpinner text="Loading accounts..." />;
  }

  if (displayError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-900 font-semibold">Error</h3>
          <p className="text-red-700 mt-1">{displayError}</p>
          <button
            onClick={() => {
              setError(null);
              reload();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
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
              aria-label="Create new account"
            >
              ➕ Create Account
            </button>

            <button
              onClick={handleRebuild}
              disabled={rebuildRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              aria-label="Rebuild from transactions"
            >
              {rebuildRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
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
              aria-label="Remove duplicate accounts"
            >
              {cleanupRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {accountTypeStats.map(({ type, count, totalSplits }) => (
          <button
            key={type}
            className={`p-4 rounded-lg border-2 transition-all text-left ${selectedType === type
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            onClick={() => setSelectedType(selectedType === type ? 'all' : type)}
            aria-label={`Filter by ${type} accounts`}
            aria-pressed={selectedType === type}
          >
            <div className="text-2xl mb-1">{getAccountTypeIcon(type)}</div>
            <div className="text-sm font-semibold text-gray-900">
              {getAccountTypeLabel(type)}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {totalSplits} transaction{totalSplits === 1 ? '' : 's'}
            </div>
          </button>
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-4" role="toolbar" aria-label="Account filters">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <button
          onClick={() => setSelectedType('all')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${selectedType === 'all'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          aria-pressed={selectedType === 'all'}
        >
          All ({accounts.length})
        </button>
        {(['asset', 'expense', 'income', 'liability', 'equity'] as AccountType[]).map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${selectedType === type
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            aria-pressed={selectedType === type}
          >
            {getAccountTypeLabel(type)} ({accountsByType[type]?.length || 0})
          </button>
        ))}
      </div>

      {/* Accounts List */}
      <div className="space-y-3">
        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-600">No accounts found</p>
            <p className="text-sm text-gray-500 mt-1">
              Import transactions to create accounts automatically
            </p>
          </div>
        )}

        {selectedAccountId && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <button
              onClick={() => setSelectedAccountId(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              ← Back to all accounts
            </button>
            <AccountDetailView accountId={selectedAccountId} />
          </div>
        )}

        {!selectedAccountId &&
          filteredAccounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onViewTransactions={setSelectedAccountId}
              onEdit={setEditingAccount}
              onEditBalance={setEditingBalanceAccount}
              onManageHoldings={setManagingHoldingsAccount}
            />
          ))}
      </div>

      {/* Modals */}
      {editingAccount && (
        <EditAccountModal
          isOpen={true}
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={handleEditAccount}
        />
      )}

      {editingBalanceAccount && (
        <OpeningBalanceModal
          isOpen={true}
          account={editingBalanceAccount}
          onClose={() => setEditingBalanceAccount(null)}
          onSave={handleUpdateOpeningBalance}
        />
      )}

      {isCreatingAccount && (
        <CreateAccountModal
          isOpen={true}
          onClose={() => setIsCreatingAccount(false)}
          onCreate={handleCreateAccount}
        />
      )}

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

/**
 * Account Card Component
 * Displays individual account information
 */
interface AccountCardProps {
  account: AccountWithDetails;
  onViewTransactions: (id: string) => void;
  onEdit: (account: Account) => void;
  onEditBalance: (account: Account) => void;
  onManageHoldings: (account: Account) => void;
}

function AccountCard({
  account,
  onViewTransactions,
  onEdit,
  onEditBalance,
  onManageHoldings
}: Readonly<AccountCardProps>) {
  return (
    <article
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        {/* Left side - Account info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl" aria-hidden="true">
              {getAccountTypeIcon(account.type)}
            </span>
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

          <dl className="grid grid-cols-2 gap-4 text-sm">
            {/* Currency */}
            <div>
              <dt className="text-gray-500 inline">Currency: </dt>
              <dd className="font-medium text-gray-900 inline">
                {account.currency}
              </dd>
              {account.supportedCurrencies.length > 1 && (
                <span className="text-gray-500 ml-1">
                  (+{account.supportedCurrencies.length - 1} more)
                </span>
              )}
            </div>

            {/* Transaction count */}
            <div>
              <dt className="text-gray-500 inline">Transactions: </dt>
              <dd className="font-medium text-gray-900 inline">
                {account.splitCount || 0}
              </dd>
            </div>

            {/* Account number */}
            {account.accountNumber && (
              <div>
                <dt className="text-gray-500 inline">Account #: </dt>
                <dd className="font-medium text-gray-900 font-mono text-xs inline">
                  {account.accountNumber}
                </dd>
              </div>
            )}

            {/* Institution */}
            {account.institution && (
              <div>
                <dt className="text-gray-500 inline">Institution: </dt>
                <dd className="font-medium text-gray-900 inline">
                  {account.institution}
                </dd>
              </div>
            )}

            {/* Subtype */}
            {account.subtype && (
              <div>
                <dt className="text-gray-500 inline">Subtype: </dt>
                <dd className="font-medium text-gray-900 inline">
                  {account.subtype}
                </dd>
              </div>
            )}

            {/* Linked category */}
            {account.linkedCategoryRule && (
              <div>
                <dt className="text-gray-500 inline">Linked to category: </dt>
                <dd className="font-medium text-gray-900 inline">
                  {account.linkedCategoryRule.name}
                </dd>
              </div>
            )}
          </dl>

          {/* Status */}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <time dateTime={account.createdAt.toISOString()}>
              Created: {new Date(account.createdAt).toLocaleDateString()}
            </time>
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

          {/* Multi-currency display */}
          {account.balances && Object.keys(account.balances).length > 0 ? (
            <div className="flex flex-col items-end gap-1">
              {/* Primary currency first */}
              <div className={`text-xl font-bold ${(account.balances[account.currency] || 0) >= 0
                ? 'text-green-600'
                : 'text-red-600'
                }`}>
                {formatCurrency(account.balances[account.currency] || 0, account.currency)}
              </div>

              {/* Other currencies */}
              {Object.entries(account.balances)
                .filter(([currency]) => currency !== account.currency)
                .map(([currency, amount]) => (
                  <div key={currency} className={`text-sm font-medium ${amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {formatCurrency(amount, currency)}
                  </div>
                ))
              }
            </div>
          ) : (
            /* Fallback for backward compatibility */
            <div className={`text-xl font-bold ${account.currentBalance === undefined
              ? 'text-gray-900'
              : account.currentBalance >= 0
                ? 'text-green-600'
                : 'text-red-600'
              }`}>
              {account.currentBalance === undefined
                ? formatCurrency(account.openingBalance, account.currency)
                : formatCurrency(account.currentBalance, account.balanceCurrency || account.currency)}
            </div>
          )}

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
          onClick={() => onViewTransactions(account.id)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          📊 View Transactions
        </button>
        <button
          onClick={() => onEdit(account)}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
        >
          ✏️ Edit
        </button>
        {(account.type === 'asset' || account.type === 'liability') && (
          <button
            onClick={() => onEditBalance(account)}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            💰 Set Opening Balance
          </button>
        )}
        {account.subtype === 'investment' && (
          <button
            onClick={() => onManageHoldings(account)}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1"
          >
            📊 Manage Holdings
          </button>
        )}
      </div>
    </article>
  );
}

export default AccountViewer;
