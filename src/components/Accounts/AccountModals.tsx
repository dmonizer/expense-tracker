import { useState } from 'react';
import type { Account } from '../../types';
import { type AccountType } from '../../utils/accountTypeHelpers';
import { getDisplayBalance } from '../../services/journalEntryManager';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RenameAccountModalProps extends BaseModalProps {
  account: Account;
  onSave: (accountId: string, newName: string) => Promise<void>;
}

export function RenameAccountModal({ isOpen, account, onClose, onSave }: Readonly<RenameAccountModalProps>) {
  const [name, setName] = useState(account.name);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(account.id, name.trim());
      onClose();
    } catch (error) {
      console.error('Failed to rename account:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-modal-title"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 id="rename-modal-title" className="text-lg font-semibold text-gray-900 mb-4">
          Rename Account
        </h3>
        <div className="mb-4">
          <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-2">
            Account Name
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter account name"
            autoFocus
            disabled={saving}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OpeningBalanceModalProps extends BaseModalProps {
  account: Account;
  onSave: (accountId: string, balance: number) => Promise<void>;
}

export function OpeningBalanceModal({ isOpen, account, onClose, onSave }: Readonly<OpeningBalanceModalProps>) {
  const displayBal = getDisplayBalance(account.openingBalance, account.type);
  const [balance, setBalance] = useState(displayBal.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    const parsedBalance = parseFloat(balance);
    if (Number.isNaN(parsedBalance)) {
      setError('Please enter a valid number');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Convert display balance back to accounting balance
      const accountingBalance = getDisplayBalance(parsedBalance, account.type);
      await onSave(account.id, accountingBalance);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balance-modal-title"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 id="balance-modal-title" className="text-lg font-semibold text-gray-900 mb-4">
          Set Opening Balance
        </h3>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>{account.name}</strong> ({account.type})
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {account.type === 'asset'
              ? 'Enter the amount you have in this account as a positive number. Example: 5000 for €5,000 in the bank.'
              : 'Enter the amount you owe as a positive number. Example: 1000 for €1,000 of debt. (Net worth will subtract this automatically)'}
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="opening-balance" className="block text-sm font-medium text-gray-700 mb-2">
            Opening Balance ({account.currency})
          </label>
          <input
            id="opening-balance"
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => {
              setBalance(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            autoFocus
            disabled={saving}
          />
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateAccountModalProps extends BaseModalProps {
  onCreate: (account: {
    name: string;
    type: AccountType;
    subtype: string;
    currency: string;
    institution: string;
    accountNumber: string;
    openingBalance: string;
  }) => Promise<void>;
}

export function CreateAccountModal({ isOpen, onClose, onCreate }: Readonly<CreateAccountModalProps>) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'asset' as AccountType,
    subtype: '',
    currency: 'EUR',
    institution: '',
    accountNumber: '',
    openingBalance: '0',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('Account name is required');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await onCreate(formData);
      // Reset form
      setFormData({
        name: '',
        type: 'asset',
        subtype: '',
        currency: 'EUR',
        institution: '',
        accountNumber: '',
        openingBalance: '0',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
    >
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h3 id="create-modal-title" className="text-lg font-semibold text-gray-900 mb-4">
          Create New Account
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Account Name */}
          <div>
            <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-2">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              id="create-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., Swedbank Stocks, ING Savings, Nordea Checking"
              autoFocus
              disabled={creating}
            />
          </div>

          {/* Account Type */}
          <div>
            <label htmlFor="create-type" className="block text-sm font-medium text-gray-700 mb-2">
              Account Type <span className="text-red-500">*</span>
            </label>
            <select
              id="create-type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType, subtype: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={creating}
            >
              <option value="asset">Asset (Bank account, Cash, Investments)</option>
              <option value="liability">Liability (Credit card, Loan)</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {/* Subtype */}
          {(formData.type === 'asset' || formData.type === 'liability') && (
            <div>
              <label htmlFor="create-subtype" className="block text-sm font-medium text-gray-700 mb-2">
                Subtype
              </label>
              <select
                id="create-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={creating}
              >
                <option value="">Select subtype</option>
                {formData.type === 'asset' && (
                  <>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment (Stocks, Funds, Crypto)</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </>
                )}
                {formData.type === 'liability' && (
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
            <label htmlFor="create-currency" className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              id="create-currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={creating}
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
            <label htmlFor="create-institution" className="block text-sm font-medium text-gray-700 mb-2">
              Institution / Provider
            </label>
            <input
              id="create-institution"
              type="text"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., Swedbank, ING, Nordnet"
              disabled={creating}
            />
          </div>

          {/* Account Number */}
          <div>
            <label htmlFor="create-account-number" className="block text-sm font-medium text-gray-700 mb-2">
              Account Number
            </label>
            <input
              id="create-account-number"
              type="text"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., SE123456789"
              disabled={creating}
            />
          </div>

          {/* Opening Balance */}
          {(formData.type === 'asset' || formData.type === 'liability') && (
            <div>
              <label htmlFor="create-opening-balance" className="block text-sm font-medium text-gray-700 mb-2">
                Opening Balance
              </label>
              <input
                id="create-opening-balance"
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                disabled={creating}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.type === 'asset'
                  ? 'Enter as positive (e.g., 5000 for €5,000 in the account)'
                  : 'Enter debt as positive (e.g., 1000 for €1,000 owed)'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!formData.name.trim() || creating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
