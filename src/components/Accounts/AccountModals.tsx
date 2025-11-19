import { useState, useEffect } from 'react';
import type { Account, AccountSubtype } from '../../types';
import { type AccountType } from '../../utils/accountTypeHelpers';
import { getDisplayBalance } from '../../services/journalEntryManager';
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Opening Balance</DialogTitle>
          <DialogDescription>
            {account.name} ({account.type})
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-600 mt-1">
            {account.type === 'asset'
              ? 'Enter the amount you have in this account as a positive number. Example: 5000 for €5,000 in the bank.'
              : 'Enter the amount you owe as a positive number. Example: 1000 for €1,000 of debt. (Net worth will subtract this automatically)'}
          </p>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="opening-balance">
              Opening Balance ({account.currency})
            </Label>
            <Input
              id="opening-balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setError(null);
              }}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSave()}
              placeholder="0.00"
              autoFocus
              disabled={saving}
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="create-name">
              Account Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="create-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g., Main Checking Account"
              autoFocus
              disabled={creating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-type">
              Account Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="create-type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType, subtype: '' })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="grid gap-2">
              <Label htmlFor="create-subtype">
                Account Subtype
              </Label>
              <select
                id="create-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="grid gap-2">
            <Label htmlFor="create-currency">
              Currency <span className="text-red-500">*</span>
            </Label>
            <select
              id="create-currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="grid gap-2">
            <Label htmlFor="create-institution">
              Institution / Provider
            </Label>
            <Input
              id="create-institution"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g., Swedbank, ING, Nordnet"
              disabled={creating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-account-number">
              Account Number
            </Label>
            <Input
              id="create-account-number"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="IBAN or account number"
              disabled={creating}
            />
          </div>

          {(formData.type === 'asset' || formData.type === 'liability') && (
            <div className="grid gap-2">
              <Label htmlFor="create-opening-balance">
                Opening Balance
              </Label>
              <Input
                id="create-opening-balance"
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="0.00"
                disabled={creating}
              />
              <p className="text-xs text-gray-500">
                {formData.type === 'asset'
                  ? 'Enter the current balance in this account (positive number)'
                  : 'Enter the amount owed (positive number, will be recorded as liability)'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!formData.name.trim() || creating}>
            {creating ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const isSystemAccount = account.isSystem;
  const canEditStructural = !isSystemAccount;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>

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

        <div className="grid gap-4 py-4">
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

          <div className="grid gap-2">
            <Label htmlFor="edit-name">
              Account Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSave()}
              autoFocus
              disabled={saving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">
              Description
            </Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              disabled={saving}
              placeholder="Add notes or description about this account"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-color">
              Color (for UI display)
            </Label>
            <div className="flex gap-2 items-center">
              <input
                id="edit-color"
                type="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                disabled={saving}
              />
              <Input
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSave()}
                className="flex-1 font-mono"
                placeholder="#3B82F6"
                disabled={saving}
              />
            </div>
          </div>

          {canEditStructural && (
            <div className="grid gap-2">
              <Label htmlFor="edit-institution">
                Institution / Provider
              </Label>
              <Input
                id="edit-institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSave()}
                placeholder="e.g., Swedbank, ING, Nordnet"
                disabled={saving}
              />
            </div>
          )}

          {canEditStructural && (
            <div className="grid gap-2">
              <Label htmlFor="edit-account-number">
                Account Number
              </Label>
              <Input
                id="edit-account-number"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSave()}
                disabled={saving}
              />
              {accountNumberWarning && (
                <p className="text-xs text-orange-600">
                  ⚠️ Changing the account number may affect CSV import matching for this account.
                </p>
              )}
            </div>
          )}

          {/* Multi-currency support */}
          <div className="grid gap-2">
            <Label>Supported Currencies</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.supportedCurrencies.map(currency => (
                <div key={currency} className="flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
                  <span className="font-medium mr-1">{currency}</span>
                  {currency !== account.currency && (
                    <button
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          supportedCurrencies: prev.supportedCurrencies.filter(c => c !== currency)
                        }));
                      }}
                      className="text-gray-500 hover:text-red-600 ml-1 focus:outline-none"
                      aria-label={`Remove ${currency}`}
                    >
                      ×
                    </button>
                  )}
                  {currency === account.currency && (
                    <span className="text-xs text-gray-500 ml-1">(Primary)</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !formData.supportedCurrencies.includes(value)) {
                    setFormData(prev => ({
                      ...prev,
                      supportedCurrencies: [...prev.supportedCurrencies, value]
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Add currency" />
                </SelectTrigger>
                <SelectContent>
                  {['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'AUD', 'CAD', 'JPY']
                    .filter(c => !formData.supportedCurrencies.includes(c))
                    .map(currency => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">
              Transactions in these currencies will be tracked separately.
            </p>
          </div>

          {canEditStructural && (account.type === 'asset' || account.type === 'liability') && (
            <div className="grid gap-2">
              <Label htmlFor="edit-subtype">
                Account Subtype
              </Label>
              <select
                id="edit-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="edit-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={saving}
            />
            <Label htmlFor="edit-active" className="cursor-pointer font-medium">
              Account is active
            </Label>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            Inactive accounts are hidden from most views
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!formData.name.trim() || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
