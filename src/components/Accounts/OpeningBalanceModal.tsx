import * as React from 'react';
import {useState} from 'react';
import type {Account} from '@/types';
import {getDisplayBalance} from '@/services/journalEntryManager.ts';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

interface OpeningBalanceModalProps {
    isOpen: boolean;
    account: Account;
    onClose: () => void;
    onSave: (accountId: string, balance: number) => Promise<void>;
}

/**
 * Modal for setting an account's opening balance
 * Handles display balance conversion for different account types
 */
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

    const helpText = account.type === 'asset'
        ? 'Enter the amount you have in this account as a positive number. Example: 5000 for €5,000 in the bank.'
        : 'Enter the amount you owe as a positive number. Example: 1000 for €1,000 of debt. (Net worth will subtract this automatically)';

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
                    <p className="text-xs text-blue-600 mt-1">{helpText}</p>
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
