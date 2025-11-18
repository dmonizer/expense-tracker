import { useState, useEffect } from 'react';
import { logger } from '../../utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { calculateAccountBalance, getDisplayBalance } from '../../services/journalEntryManager';
import { formatCurrency } from '../../utils/currencyUtils';
import type { Account } from '../../types';

interface AccountBalance {
  account: Account;
  balance: number;
  currency: string;
}

function NetWorthSummary() {
  const [loading, setLoading] = useState(true);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [assetBalances, setAssetBalances] = useState<AccountBalance[]>([]);
  const [liabilityBalances, setLiabilityBalances] = useState<AccountBalance[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch all accounts with live updates
  const allAccounts = useLiveQuery(() => db.accounts.toArray(), []);

  // Calculate balances when accounts change
  useEffect(() => {
    if (!allAccounts) return;

    const calculateBalances = async () => {
      setLoading(true);
      try {
        const assets: AccountBalance[] = [];
        const liabilities: AccountBalance[] = [];
        let totalAssetAmount = 0;
        let totalLiabilityAmount = 0;

        // Determine base currency (most common or EUR as fallback)
        const baseCurrency = allAccounts.length > 0 ? allAccounts[0].currency : 'EUR';

        // Import exchange rate converter
        const { getExchangeRate } = await import('../../services/exchangeRateManager');

        // Calculate balance for each account
        for (const account of allAccounts) {
          if (!account.isActive) continue;

          try {
            const balanceResult = await calculateAccountBalance(account.id, new Date());
            // Use display balance (flips sign for income/liability)
            const displayBal = getDisplayBalance(balanceResult.balance, account.type);

            const accountBalance: AccountBalance = {
              account,
              balance: displayBal,
              currency: balanceResult.currency,
            };

            // Convert to base currency
            let balanceInBaseCurrency = displayBal;
            if (balanceResult.currency !== baseCurrency) {
              const rate = await getExchangeRate(balanceResult.currency, baseCurrency, new Date());
              if (rate !== null) {
                balanceInBaseCurrency = displayBal * rate;
              } else {
                logger.warn(`No exchange rate found for ${balanceResult.currency} to ${baseCurrency}`);
              }
            }

            if (account.type === 'asset') {
              assets.push(accountBalance);
              totalAssetAmount += balanceInBaseCurrency;
            } else if (account.type === 'liability') {
              liabilities.push(accountBalance);
              // Display balance is already positive for liabilities
              totalLiabilityAmount += Math.abs(balanceInBaseCurrency);
            }
          } catch (error) {
            logger.error(`Failed to calculate balance for ${account.name}:`, error);
          }
        }

        setAssetBalances(assets);
        setLiabilityBalances(liabilities);
        setTotalAssets(totalAssetAmount);
        setTotalLiabilities(totalLiabilityAmount);
      } catch (error) {
        logger.error('Failed to calculate net worth:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateBalances();
  }, [allAccounts]);

  const netWorth = totalAssets - totalLiabilities;
  const primaryCurrency = allAccounts && allAccounts.length > 0 ? allAccounts[0].currency : 'EUR';

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-blue-200 bg-white bg-opacity-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              💰 Net Worth Summary
              <span className="text-xs font-normal text-gray-500">(Account Balances)</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Based on double-entry accounting system
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        {/* Assets */}
        <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(totalAssets, primaryCurrency)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {assetBalances.length} account{assetBalances.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-3xl">🏦</div>
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(totalLiabilities, primaryCurrency)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {liabilityBalances.length} account{liabilityBalances.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-3xl">💳</div>
          </div>
        </div>

        {/* Net Worth */}
        <div className={`bg-white rounded-lg p-4 border-l-4 ${
          netWorth >= 0 ? 'border-blue-500' : 'border-orange-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Worth</p>
              <p className={`text-2xl font-bold mt-1 ${
                netWorth >= 0 ? 'text-blue-600' : 'text-orange-600'
              }`}>
                {formatCurrency(netWorth, primaryCurrency)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Assets - Liabilities
              </p>
            </div>
            <div className="text-3xl">
              {netWorth >= 0 ? '📈' : '📉'}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {/* Assets Breakdown */}
          {assetBalances.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Asset Accounts</h3>
              <div className="space-y-2">
                {assetBalances
                  .sort((a, b) => b.balance - a.balance)
                  .map(({ account, balance, currency }) => (
                    <div
                      key={account.id}
                      className="bg-white rounded px-3 py-2 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏦</span>
                        <span className="text-gray-900">{account.name}</span>
                        {account.subtype && (
                          <span className="text-xs text-gray-500">({account.subtype})</span>
                        )}
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(balance, currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Liabilities Breakdown */}
          {liabilityBalances.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Liability Accounts</h3>
              <div className="space-y-2">
                {liabilityBalances
                  .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                  .map(({ account, balance, currency }) => (
                    <div
                      key={account.id}
                      className="bg-white rounded px-3 py-2 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💳</span>
                        <span className="text-gray-900">{account.name}</span>
                        {account.subtype && (
                          <span className="text-xs text-gray-500">({account.subtype})</span>
                        )}
                      </div>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(Math.abs(balance), currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {assetBalances.length === 0 && liabilityBalances.length === 0 && (
            <div className="bg-white rounded px-4 py-6 text-center text-gray-500">
              <p>No asset or liability accounts found.</p>
              <p className="text-sm mt-1">Import transactions to create accounts automatically.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NetWorthSummary;
