import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../utils';
import { db } from '../../services/db';
import type { Account } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getDisplayBalance } from '../../services/journalEntryManager';
import LoadingSpinner from '../ui/LoadingSpinner';
import type {JournalEntry, Split} from "@/types/journalTypes.ts";

interface AccountDetailViewProps {
    accountId: string;
}

interface SplitWithJournalEntry extends Split {
    journalEntry: JournalEntry;
}

function AccountDetailView({ accountId }: Readonly<AccountDetailViewProps>) {
    const [account, setAccount] = useState<Account | null>(null);
    const [splits, setSplits] = useState<SplitWithJournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAccountDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Get account
            const acc = await db.accounts.get(accountId);
            if (!acc) {
                setError('Account not found');
                return;
            }
            setAccount(acc);

            // Get all splits for this account
            const accountSplits = await db.splits
                .where('accountId')
                .equals(accountId)
                .toArray();

            // Get journal entries for these splits
            const journalEntryIds = [...new Set(accountSplits.map(s => s.journalEntryId))];
            const journalEntries = await db.journalEntries
                .where('id')
                .anyOf(journalEntryIds)
                .toArray();

            const journalEntryMap = new Map(journalEntries.map(je => [je.id, je]));

            // Combine splits with journal entries
            const splitsWithJE: SplitWithJournalEntry[] = accountSplits
                .map(split => ({
                    ...split,
                    journalEntry: journalEntryMap.get(split.journalEntryId)!,
                }))
                .filter(s => s.journalEntry)
                .sort((a, b) => b.journalEntry.date.getTime() - a.journalEntry.date.getTime());

            setSplits(splitsWithJE);
        } catch (err) {
            logger.error('Failed to load account details:', err);
            setError(err instanceof Error ? err.message : 'Failed to load account details');
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        loadAccountDetails();
    }, [loadAccountDetails]);

    if (loading) {
        return <LoadingSpinner text="Loading account details..." />;
    }

    if (error || !account) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error || 'Account not found'}</p>
            </div>
        );
    }

    // Calculate running balance (accounting balance, not display balance)
    let runningBalance = account.openingBalance;
    const splitsWithBalance = splits.reverse().map(split => {
        runningBalance += split.amount;
        return { ...split, runningBalance };
    }).reverse();

    // For display purposes, flip sign for income/liability accounts
    const displayOpeningBalance = getDisplayBalance(account.openingBalance, account.type);
    const displayCurrentBalance = getDisplayBalance(runningBalance, account.type);

    function getAccountTypeIcon(account: Account): string {
        switch (account.type) {
            case 'asset':
                return '🏦';
            case 'expense':
                return '💸';
            case 'income':
                return '💰';
            case 'liability':
                return '💳';
            default:
                return '⚖️';
        }
    }

    return (
        <div>
            {/* Account header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{
                        getAccountTypeIcon(account)
                    }</span>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{account.name}</h2>
                        <p className="text-sm text-gray-600">
                            {account.type.charAt(0).toUpperCase() + account.type.slice(1)} Account
                            {account.accountNumber && ` • ${account.accountNumber}`}
                        </p>
                    </div>
                </div>

                {/* Balance summary */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-blue-700 mb-1">Opening Balance</div>
                        <div className="text-xl font-bold text-blue-900">
                            {formatCurrency(displayOpeningBalance, account.currency)}
                        </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-green-700 mb-1">Current Balance</div>
                        <div className="text-xl font-bold text-green-900">
                            {formatCurrency(displayCurrentBalance, account.currency)}
                        </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-sm text-purple-700 mb-1">Total Transactions</div>
                        <div className="text-xl font-bold text-purple-900">
                            {splits.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction list */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Transaction History
                </h3>

                {splits.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">No transactions yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {splitsWithBalance.map(split => (
                            <div
                                key={split.id}
                                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-gray-900">
                                                {new Date(split.journalEntry.date).toLocaleDateString()}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {split.journalEntry.description}
                                            </span>
                                        </div>

                                        {split.memo && split.memo !== split.journalEntry.description && (
                                            <div className="text-sm text-gray-500 mb-1">
                                                {split.memo}
                                            </div>
                                        )}

                                        {split.category && (
                                            <div className="text-xs text-gray-500">
                                                Category: {split.category}
                                            </div>
                                        )}

                                        {/* Foreign currency info */}
                                        {split.foreignAmount && split.foreignCurrency && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                Original: {formatCurrency(split.foreignAmount, split.foreignCurrency)}
                                                {split.exchangeRate && ` @ ${split.exchangeRate.toFixed(4)}`}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-right ml-4">
                                        <div className={`text-lg font-bold ${split.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {split.amount >= 0 ? '+' : ''}
                                            {formatCurrency(split.amount, split.currency)}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Balance: {formatCurrency(getDisplayBalance(split.runningBalance, account.type), account.currency)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AccountDetailView;
