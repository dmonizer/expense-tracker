import { useState, useEffect } from 'react';
import type { ExchangeRate } from '../../types';
import { 
  setExchangeRate,
  deleteExchangeRate,
} from '../../services/exchangeRateManager';
import { COMMON_CURRENCIES } from '../../utils/currencyUtils';
import LoadingSpinner from '../UI/LoadingSpinner';

function ExchangeRateManager() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  
  // Filter state
  const [selectedPair, setSelectedPair] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all rates (we'll load them all for simplicity)
      const { db } = await import('../../services/db');
      const allRates = await db.exchangeRates.toArray();
      
      // Sort by date (newest first)
      allRates.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setRates(allRates);
    } catch (err) {
      console.error('Failed to load exchange rates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exchange rates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async () => {
    if (!rate || Number.isNaN(Number.parseFloat(rate))) {
      setError('Please enter a valid rate');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await setExchangeRate(
        fromCurrency,
        toCurrency,
        Number.parseFloat(rate),
        new Date(rateDate),
        'manual'
      );

      // Reset form
      setRate('');
      setShowForm(false);

      // Reload data
      await loadData();
    } catch (err) {
      console.error('Failed to add exchange rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to add exchange rate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rateId: string) => {
    if (!confirm('Delete this exchange rate?')) {
      return;
    }

    try {
      await deleteExchangeRate(rateId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete exchange rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete exchange rate');
    }
  };

  // Group rates by currency pair
  const ratesByPair = rates.reduce((acc, rate) => {
    const key = `${rate.fromCurrency}/${rate.toCurrency}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(rate);
    return acc;
  }, {} as Record<string, ExchangeRate[]>);

  const pairs = Object.keys(ratesByPair).sort();
  
  const filteredRates = selectedPair === 'all' 
    ? rates 
    : ratesByPair[selectedPair] || [];

  if (loading) {
    return <LoadingSpinner text="Loading exchange rates..." />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Exchange Rates
            </h2>
            <p className="text-gray-600">
              Manage currency conversion rates for multi-currency support
            </p>
          </div>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showForm ? '✖ Cancel' : '➕ Add Rate'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Add rate form */}
      {showForm && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4">Add Exchange Rate</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Currency
              </label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COMMON_CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Currency
              </label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COMMON_CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rate
              </label>
              <input
                type="number"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="1.0850"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={rateDate}
                onChange={(e) => setRateDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddRate}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Rate'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter by currency pair */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <select
          value={selectedPair}
          onChange={(e) => setSelectedPair(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All pairs ({rates.length})</option>
          {pairs.map(pair => (
            <option key={pair} value={pair}>
              {pair} ({ratesByPair[pair].length})
            </option>
          ))}
        </select>
      </div>

      {/* Rates list */}
      {filteredRates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-2">💱</div>
          <p className="text-gray-600">No exchange rates found</p>
          <p className="text-sm text-gray-500 mt-1">
            Add rates to support multi-currency transactions
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRates.map(rate => (
            <div
              key={rate.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-gray-900">
                      {rate.fromCurrency} → {rate.toCurrency}
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {rate.rate.toFixed(4)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      rate.source === 'manual' 
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {rate.source}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span>Date: {new Date(rate.date).toLocaleDateString()}</span>
                    <span className="mx-2">•</span>
                    <span>Added: {new Date(rate.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Example conversion */}
                  <div className="mt-2 text-sm text-gray-500">
                    Example: 100 {rate.fromCurrency} = {(100 * rate.rate).toFixed(2)} {rate.toCurrency}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(rate.id)}
                  className="ml-4 px-3 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              About Exchange Rates
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                Exchange rates are used to convert foreign currency transactions
              </li>
              <li>
                When importing transactions, the system will automatically use the closest rate
              </li>
              <li>
                You can add historical rates for accurate conversions
              </li>
              <li>
                Inverse rates are calculated automatically (e.g., EUR→USD from USD→EUR)
              </li>
              <li>
                Default rates are approximate - update them with real values
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangeRateManager;
