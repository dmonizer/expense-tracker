import { useState } from 'react';
import type { AccountType } from '../../utils/accountTypeHelpers';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
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

const ACCOUNT_SUBTYPES = {
    asset: [
        { value: 'checking', label: 'Checking' },
        { value: 'savings', label: 'Savings' },
        { value: 'investment', label: 'Investment' },
        { value: 'cash', label: 'Cash' },
        { value: 'other', label: 'Other' },
    ],
    liability: [
        { value: 'credit_card', label: 'Credit Card' },
        { value: 'loan', label: 'Loan' },
        { value: 'other', label: 'Other' },
    ],
};

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

    const showSubtype = formData.type === 'asset' || formData.type === 'liability';
    const showOpeningBalance = formData.type === 'asset' || formData.type === 'liability';
    const balanceHelpText = formData.type === 'asset'
        ? 'Enter the current balance in this account (positive number)'
        : 'Enter the amount owed (positive number, will be recorded as liability)';

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
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={creating}
                        >
                            <option value="asset">Asset (Bank Account, Cash, Investments)</option>
                            <option value="liability">Liability (Credit Card, Loan)</option>
                            <option value="equity">Equity (Owner's Capital, Retained Earnings)</option>
                            <option value="income">Income (Salary, Interest, etc.)</option>
                            <option value="expense">Expense (Rent, Food, etc.)</option>
                        </select>
                    </div>

                    {showSubtype && (
                        <div className="grid gap-2">
                            <Label htmlFor="create-subtype">Account Subtype</Label>
                            <select
                                id="create-subtype"
                                value={formData.subtype}
                                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                disabled={creating}
                            >
                                <option value="">Select subtype</option>
                                {ACCOUNT_SUBTYPES[formData.type as 'asset' | 'liability']?.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
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
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                        <Label htmlFor="create-institution">Institution / Provider</Label>
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
                        <Label htmlFor="create-account-number">Account Number</Label>
                        <Input
                            id="create-account-number"
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder="IBAN or account number"
                            disabled={creating}
                        />
                    </div>

                    {showOpeningBalance && (
                        <div className="grid gap-2">
                            <Label htmlFor="create-opening-balance">Opening Balance</Label>
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
                            <p className="text-xs text-gray-500">{balanceHelpText}</p>
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
