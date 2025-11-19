import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils';
import { db } from '../services/db';
import type { Account, CategoryRule } from '../types';
import { calculateAccountBalance, getDisplayBalance } from '../services/journalEntryManager';
import { sortAccountsByTypeAndName, type AccountType } from '../utils/accountTypeHelpers';

export interface AccountWithDetails extends Account {
  linkedCategoryRule?: CategoryRule;
  splitCount?: number;
  currentBalance?: number;
  balanceCurrency?: string;
  balances?: Record<string, number>;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
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
          let balances: Record<string, number> = { [account.currency]: account.openingBalance };

          try {
            const balanceResult = await calculateAccountBalance(account.id, new Date());
            // Use display balance (flips sign for income/liability accounts)
            currentBalance = getDisplayBalance(balanceResult.balance, account.type);
            balanceCurrency = balanceResult.currency;

            // Process multi-currency balances
            balances = {};
            Object.entries(balanceResult.balances).forEach(([currency, amount]) => {
              balances[currency] = getDisplayBalance(amount, account.type);
            });
          } catch (error) {
            logger.error(`Failed to calculate balance for ${account.name}:`, error);
          }

          return {
            ...account,
            linkedCategoryRule: account.categoryRuleId
              ? categoryRuleMap.get(account.categoryRuleId)
              : undefined,
            splitCount,
            currentBalance,
            balanceCurrency,
            balances,
          };
        })
      );

      // Sort by type, then by name
      const sortedAccounts = sortAccountsByTypeAndName(accountsWithDetails);
      setAccounts(sortedAccounts);
    } catch (err) {
      logger.error('Failed to load accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return {
    accounts,
    loading,
    error,
    reload: loadAccounts,
  };
}

export function useAccountFiltering(accounts: AccountWithDetails[]) {
  const [selectedType, setSelectedType] = useState<AccountType | 'all'>('all');

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

  return {
    selectedType,
    setSelectedType,
    filteredAccounts,
    accountsByType,
    accountTypeStats,
  };
}
