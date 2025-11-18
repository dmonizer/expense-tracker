import { useState, useEffect } from 'react';
import { logger } from '../../utils';
import { db } from '../../services/db';
import type { Account, Holding } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';

interface HoldingsManagerProps {
  account: Account;
  onClose: () => void;
}

function HoldingsManager({ account, onClose }: HoldingsManagerProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [form, setForm] = useState({
    symbol: '',
    name: '',
    type: 'stock' as Holding['type'],
    quantity: '',
    purchasePrice: '',
    notes: '',
  });

  useEffect(() => {
    loadHoldings();
  }, [account.id]);

  const loadHoldings = async () => {
    try {
      setLoading(true);
      const accountHoldings = await db.holdings
        .where('accountId')
        .equals(account.id)
        .toArray();
      setHoldings(accountHoldings);
    } catch (error) {
      logger.error('Failed to load holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.symbol.trim() || !form.quantity) return;

    try {
      const { v4: uuidv4 } = await import('uuid');
      const quantity = Number.parseFloat(form.quantity);
      const purchasePrice = Number.parseFloat(form.purchasePrice) || 0;

      if (editing) {
        await db.holdings.update(editing.id, {
          symbol: form.symbol.trim().toUpperCase(),
          name: form.name.trim() || undefined,
          type: form.type,
          quantity,
          purchasePrice,
          purchaseCurrency: account.currency,
          notes: form.notes.trim() || undefined,
          updatedAt: new Date(),
        });
      } else {
        const holding: Holding = {
          id: uuidv4(),
          accountId: account.id,
          symbol: form.symbol.trim().toUpperCase(),
          name: form.name.trim() || undefined,
          type: form.type,
          quantity,
          purchasePrice,
          purchaseCurrency: account.currency,
          notes: form.notes.trim() || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.holdings.add(holding);
      }

      setEditing(null);
      setForm({ symbol: '', name: '', type: 'stock', quantity: '', purchasePrice: '', notes: '' });
      await loadHoldings();
    } catch (error) {
      logger.error('Failed to save holding:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this holding?')) return;
    try {
      await db.holdings.delete(id);
      await loadHoldings();
    } catch (error) {
      logger.error('Failed to delete holding:', error);
    }
  };

  const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * (h.currentPrice || h.purchasePrice)), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.purchasePrice), 0);
  const gainLoss = totalValue - totalCost;
  const gainLossPercent = totalCost > 0 ? ((gainLoss / totalCost) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{account.name} - Holdings</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your stocks, funds, and other investments</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">Total Value</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(totalValue, account.currency)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-700 mb-1">Total Cost</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(totalCost, account.currency)}</div>
          </div>
          <div className={`rounded-lg p-4 ${gainLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-sm mb-1 ${gainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>Gain/Loss</div>
            <div className={`text-xl font-bold ${gainLoss >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {formatCurrency(gainLoss, account.currency)} ({gainLossPercent.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">{editing ? 'Edit' : 'Add'} Holding</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Symbol (e.g., SWED-A, AAPL)"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Holding['type'] })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="stock">Stock</option>
              <option value="fund">Fund</option>
              <option value="etf">ETF</option>
              <option value="bond">Bond</option>
              <option value="crypto">Crypto</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              step="0.001"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="number"
              step="0.01"
              placeholder={`Purchase Price (${account.currency})`}
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="text"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={!form.symbol.trim() || !form.quantity}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {editing ? 'Update' : 'Add'} Holding
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ symbol: '', name: '', type: 'stock', quantity: '', purchasePrice: '', notes: '' });
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Holdings List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : holdings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-600">No holdings yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your first investment above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holdings.map((holding) => {
              const value = holding.quantity * (holding.currentPrice || holding.purchasePrice);
              const cost = holding.quantity * holding.purchasePrice;
              const gain = value - cost;
              const gainPercent = cost > 0 ? ((gain / cost) * 100) : 0;

              return (
                <div key={holding.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">{holding.symbol}</span>
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">{holding.type}</span>
                        {holding.priceApiProvider && (
                          <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800" title="Price fetched from this provider">
                            📡 {holding.priceApiProvider}
                          </span>
                        )}
                        {holding.name && <span className="text-sm text-gray-600">{holding.name}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Quantity:</span>{' '}
                          <span className="font-medium">{holding.quantity}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Cost:</span>{' '}
                          <span className="font-medium">{formatCurrency(holding.purchasePrice, holding.purchaseCurrency)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Cost:</span>{' '}
                          <span className="font-medium">{formatCurrency(cost, holding.purchaseCurrency)}</span>
                        </div>
                      </div>
                      {holding.notes && (
                        <div className="text-xs text-gray-500 mt-2">{holding.notes}</div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(value, holding.purchaseCurrency)}</div>
                      <div className={`text-sm font-medium ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain, holding.purchaseCurrency)} ({gainPercent.toFixed(2)}%)
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditing(holding);
                            setForm({
                              symbol: holding.symbol,
                              name: holding.name || '',
                              type: holding.type,
                              quantity: holding.quantity.toString(),
                              purchasePrice: holding.purchasePrice.toString(),
                              notes: holding.notes || '',
                            });
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(holding.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>💡 API Integration:</strong> To automatically fetch current prices, you can integrate with financial APIs like:
            Alpha Vantage, Yahoo Finance API, or Twelve Data. Add your API key in settings to enable real-time price updates.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HoldingsManager;
