import { useState, useEffect } from 'react';
import type { Account, AccountSubtype } from '../../types';
import { type AccountType } from '../../utils/accountTypeHelpers';
import { getDisplayBalance } from '../../services/journalEntryManager';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
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
    if (e.key === 'Enter' && !saving) handleSave();
    if (e.key === 'Escape' && !saving) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balance-modal-title"
      onClick={handleBackdropClick}
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
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !creating) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creating) onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
      onClick={handleBackdropClick}
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

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-2">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              id="create-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Main Checking Account"
              autoFocus
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="create-type" className="block text-sm font-medium text-gray-700 mb-2">
              Account Type <span className="text-red-500">*</span>
            </label>
            <select
              id="create-type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType, subtype: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            >
              <option value="asset">Asset (Bank Account, Cash, Investments)</option>
              <option value="liability">Liability (Credit Card, Loan)</option>
              <option value="equity">Equity (Owner's Capital, Retained Earnings)</option>
              <option value="income">Income (Salary, Interest, etc.)</option>
              <option value="expense">Expense (Rent, Food, etc.)</option>
            </select>
          </div>

          {(formData.type === 'asset' || formData.type === 'liability') && (
            <div>
              <label htmlFor="create-subtype" className="block text-sm font-medium text-gray-700 mb-2">
                Account Subtype
              </label>
              <select
                id="create-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
              >
                <option value="">Select subtype</option>
                {formData.type === 'asset' && (
                  <>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
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

          <div>
            <label htmlFor="create-currency" className="block text-sm font-medium text-gray-700 mb-2">
              Currency <span className="text-red-500">*</span>
            </label>
            <select
              id="create-currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SEK">SEK (kr)</option>
              <option value="NOK">NOK (kr)</option>
              <option value="DKK">DKK (kr)</option>
            </select>
          </div>

          <div>
            <label htmlFor="create-institution" className="block text-sm font-medium text-gray-700 mb-2">
              Institution / Provider
            </label>
            <input
              id="create-institution"
              type="text"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Swedbank, ING, Nordnet"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="create-account-number" className="block text-sm font-medium text-gray-700 mb-2">
              Account Number
            </label>
            <input
              id="create-account-number"
              type="text"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="IBAN or account number"
              disabled={creating}
            />
          </div>

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
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                disabled={creating}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.type === 'asset'
                  ? 'Enter the current balance in this account (positive number)'
                  : 'Enter the amount owed (positive number, will be recorded as liability)'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

interface EditAccountModalProps extends BaseModalProps {
  account: Account;
  onSave: (accountId: string, updates: {
    name?: string;
    description?: string;
    color?: string;
    institution?: string;
    subtype?: AccountSubtype;
    isActive?: boolean;
    accountNumber?: string;
    supportedCurrencies?: string[];
  }) => Promise<void>;
}

export function EditAccountModal({ isOpen, account, onClose, onSave }: Readonly<EditAccountModalProps>) {
  const [formData, setFormData] = useState({
    name: account.name,
    description: account.description || '',
    color: account.color || '',
    institution: account.institution || '',
    subtype: account.subtype || '',
    isActive: account.isActive,
    accountNumber: account.accountNumber || '',
    supportedCurrencies: account.supportedCurrencies || [account.currency],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountNumberWarning, setAccountNumberWarning] = useState(false);

  useEffect(() => {
    if (formData.accountNumber !== account.accountNumber) {
      setAccountNumberWarning(true);
    } else {
      setAccountNumberWarning(false);
    }
  }, [formData.accountNumber, account.accountNumber]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Account name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updates: {
        name?: string;
        description?: string;
        color?: string;
        institution?: string;
        subtype?: AccountSubtype;
        isActive?: boolean;
        accountNumber?: string;
        supportedCurrencies?: string[];
      } = {};

      if (formData.name.trim() !== account.name) updates.name = formData.name.trim();
      if (formData.description.trim() !== (account.description || '')) updates.description = formData.description.trim();
      if (formData.color.trim() !== (account.color || '')) updates.color = formData.color.trim();
      if (formData.institution.trim() !== (account.institution || '')) updates.institution = formData.institution.trim();
      if (formData.subtype !== (account.subtype || '')) {
        updates.subtype = (formData.subtype || undefined) as AccountSubtype | undefined;
      }
      if (formData.isActive !== account.isActive) updates.isActive = formData.isActive;
      if (formData.accountNumber.trim() !== (account.accountNumber || '')) updates.accountNumber = formData.accountNumber.trim();
      if (JSON.stringify(formData.supportedCurrencies) !== JSON.stringify(account.supportedCurrencies)) {
        updates.supportedCurrencies = formData.supportedCurrencies;
      }

      await onSave(account.id, updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !saving) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  const isSystemAccount = account.isSystem;
  const canEditStructural = !isSystemAccount;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h3 id="edit-modal-title" className="text-lg font-semibold text-gray-900 mb-4">
          Edit Account
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {isSystemAccount && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ System Account:</strong> Only description, color, and active status can be edited for system accounts.
            </p>
          </div>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Read-only fields for context */}
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Account Information</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500">Type:</dt>
                <dd className="font-medium text-gray-900">{account.type}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Primary Currency:</dt>
                <dd className="font-medium text-gray-900">{account.currency}</dd>
              </div>
            </dl>
          </div>

          {/* Account Name */}
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={saving}
              placeholder="Add notes or description about this account"
            />
          </div>

          {/* Color */}
          <div>
            <label htmlFor="edit-color" className="block text-sm font-medium text-gray-700 mb-2">
              Color (for UI display)
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="edit-color"
                type="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                disabled={saving}
              />
              <input
                type="text"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="#3B82F6"
                disabled={saving}
              />
            </div>
          </div>

          {/* Institution (non-system only) */}
          {canEditStructural && (
            <div>
              <label htmlFor="edit-institution" className="block text-sm font-medium text-gray-700 mb-2">
                Institution / Provider
              </label>
              <input
                id="edit-institution"
                type="text"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Swedbank, ING, Nordnet"
                disabled={saving}
              />
            </div>
          )}

          {/* Account Number (non-system only) */}
          {canEditStructural && (
            <div>
              <label htmlFor="edit-account-number" className="block text-sm font-medium text-gray-700 mb-2">
                Account Number
              </label>
              <input
                id="edit-account-number"
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              {accountNumberWarning && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Changing the account number may affect CSV import matching for this account.
                </p>
              )}
            </div>
          )}

          {/* Subtype (non-system, asset/liability only) */}
          {canEditStructural && (account.type === 'asset' || account.type === 'liability') && (
            <div>
              <label htmlFor="edit-subtype" className="block text-sm font-medium text-gray-700 mb-2">
                Account Subtype
              </label>
              <select
                id="edit-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="">Select subtype</option>
                {account.type === 'asset' && (
                  <>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </>
                )}
                {account.type === 'liability' && (
                  <>
                    <option value="credit_card">Credit Card</option>
                    <option value="loan">Loan</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Active Status */}
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={saving}
              />
              <span className="text-sm font-medium text-gray-700">
                Account is active
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Inactive accounts are hidden from most views
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
