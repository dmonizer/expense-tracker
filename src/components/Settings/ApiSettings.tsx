import { useState, useEffect } from 'react';
import { logger } from '../../utils';
import { db } from '../../services/db';
import type { PriceApiProvider, PriceApiProviderType } from '../../types';
import { refreshAllPrices } from '../../services/priceFetcher';
import { Label } from '@/components/ui/label';
import type {UserSettings} from "@/types/userSettingsTypes.ts";

const PROVIDER_INFO: Record<PriceApiProviderType, { name: string; url: string; limits: string }> = {
  twelvedata: {
    name: 'Twelve Data',
    url: 'https://twelvedata.com/pricing',
    limits: '800 requests/day (free)',
  },
  alphavantage: {
    name: 'Alpha Vantage',
    url: 'https://www.alphavantage.co/support/#api-key',
    limits: '25 requests/day (free)',
  },
  yahoo: {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com',
    limits: 'Unlimited (free)',
  },
};

function ApiSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [providers, setProviders] = useState<PriceApiProvider[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);

  // Add provider form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState<{
    type: PriceApiProviderType;
    apiKey: string;
  }>({
    type: 'twelvedata',
    apiKey: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      let userSettings = await db.settings.get('default');

      if (!userSettings) {
        // Create default settings
        userSettings = {
          id: 'default',
          defaultCurrency: 'EUR',
          dateFormat: 'yyyy-MM-dd',
          theme: 'light',
          priceApiProviders: [],
          priceApiAutoRefresh: false,
          priceApiRefreshInterval: 60,
        };
        await db.settings.add(userSettings);
      }

      setSettings(userSettings);
      setProviders(userSettings.priceApiProviders || []);
      setAutoRefresh(userSettings.priceApiAutoRefresh || false);
      setRefreshInterval(userSettings.priceApiRefreshInterval || 60);
    } catch (error) {
      logger.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = () => {
    // Yahoo Finance doesn't require an API key
    if (newProvider.type !== 'yahoo' && !newProvider.apiKey.trim()) {
      setMessage({ type: 'error', text: 'API key is required for this provider' });
      return;
    }

    // Check if provider already exists
    if (providers.some(p => p.type === newProvider.type)) {
      setMessage({ type: 'error', text: `${PROVIDER_INFO[newProvider.type].name} is already configured` });
      return;
    }

    const provider: PriceApiProvider = {
      type: newProvider.type,
      apiKey: newProvider.apiKey.trim(),
      enabled: true,
      priority: providers.length + 1, // Add at end
    };

    setProviders([...providers, provider]);
    setNewProvider({ type: 'twelvedata', apiKey: '' });
    setShowAddForm(false);
    setMessage({ type: 'success', text: 'Provider added. Remember to save settings!' });
  };

  const handleRemoveProvider = (type: PriceApiProviderType) => {
    const updatedProviders = providers.filter(p => p.type !== type);
    // Recalculate priorities
    updatedProviders.forEach((p, index) => {
      p.priority = index + 1;
    });
    setProviders(updatedProviders);
  };

  const handleToggleProvider = (type: PriceApiProviderType) => {
    setProviders(providers.map(p =>
      p.type === type ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const handleMovePriority = (type: PriceApiProviderType, direction: 'up' | 'down') => {
    const index = providers.findIndex(p => p.type === type);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= providers.length) return;

    const updated = [...providers];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Recalculate priorities
    updated.forEach((p, i) => {
      p.priority = i + 1;
    });

    setProviders(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      await db.settings.update('default', {
        priceApiProviders: providers,
        priceApiAutoRefresh: autoRefresh,
        priceApiRefreshInterval: refreshInterval,
      });

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await loadSettings();
    } catch (error) {
      logger.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshPrices = async () => {
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      setMessage({ type: 'error', text: 'Please configure at least one API provider first' });
      return;
    }

    try {
      setRefreshing(true);
      setMessage(null);

      const results = await refreshAllPrices();

      setMessage({
        type: 'success',
        text: `Updated ${results.success} of ${results.total} holdings. ${results.failed > 0 ? `${results.failed} failed.` : ''}`,
      });
    } catch (error) {
      logger.error('Failed to refresh prices:', error);
      setMessage({ type: 'error', text: 'Failed to refresh prices' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading settings...</div>
      </div>
    );
  }

  const lastRefresh = settings?.priceApiLastRefresh
    ? new Date(settings.priceApiLastRefresh).toLocaleString()
    : 'Never';

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Settings</h2>
        <p className="text-gray-600">Configure multiple APIs for automatic price updates with fallback</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* API Providers List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Price API Providers</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              {showAddForm ? 'Cancel' : '➕ Add Provider'}
            </button>
          </div>

          {/* Add Provider Form */}
          {showAddForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Provider</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block text-sm text-gray-600 mb-1">Provider</Label>
                  <select
                    value={newProvider.type}
                    onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value as PriceApiProviderType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="twelvedata">Twelve Data</option>
                    <option value="alphavantage">Alpha Vantage</option>
                    <option value="yahoo">Yahoo Finance (Free, no key required)</option>
                  </select>
                </div>
                <div>
                  <Label className="block text-sm text-gray-600 mb-1">
                    API Key {newProvider.type === 'yahoo' && <span className="text-gray-400">(Not required)</span>}
                  </Label>
                  <input
                    type="password"
                    value={newProvider.apiKey}
                    onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    placeholder={newProvider.type === 'yahoo' ? 'Not required for Yahoo Finance' : 'Enter API key'}
                    disabled={newProvider.type === 'yahoo'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                    <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-800">
                            <strong>Warning:</strong> Due to local nature of the app, all external URLs are proxied through a third-party service (corsproxy.io) - make sure to only use free tier API keys.
                        </p>
                    </div>

                </div>
              </div>
              <button
                onClick={handleAddProvider}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                Add Provider
              </button>
            </div>
          )}

          {/* Providers List */}
          {providers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No API providers configured</p>
              <p className="text-sm">Add a provider to start fetching prices automatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider, index) => (
                <div
                  key={provider.type}
                  className={`p-4 rounded-lg border-2 ${
                    provider.enabled
                      ? 'bg-white border-blue-200'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Priority Badge */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">Priority</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMovePriority(provider.type, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <span className="text-lg font-bold text-blue-600 min-w-[24px] text-center">
                            {provider.priority}
                          </span>
                          <button
                            onClick={() => handleMovePriority(provider.type, 'down')}
                            disabled={index === providers.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* Provider Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">
                            {PROVIDER_INFO[provider.type].name}
                          </h4>
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                            {PROVIDER_INFO[provider.type].limits}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          API Key: {provider.apiKey.substring(0, 8)}...{provider.apiKey.substring(provider.apiKey.length - 4)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Enable/Disable Toggle */}
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={provider.enabled}
                            onChange={() => handleToggleProvider(provider.type)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {provider.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </Label>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveProvider(provider.type)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                          title="Remove provider"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>💡 How it works:</strong> When fetching prices, the system tries providers in priority order (1 = highest).
              If a provider succeeds for a symbol, it's remembered and used first for future updates of that symbol.
            </p>
          </div>
        </div>

        {/* Auto Refresh Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Automatic Refresh</h3>

          <div className="space-y-4">
            <div>
              <Label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable Automatic Price Refresh
                </span>
              </Label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Automatically update prices in the background
              </p>
            </div>

            {autoRefresh && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Interval (minutes)
                </Label>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How often to fetch new prices (15-1440 minutes)
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <strong>Last refresh:</strong> {lastRefresh}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>

          <button
            onClick={handleRefreshPrices}
            disabled={refreshing || providers.filter(p => p.enabled).length === 0}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            {refreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Refreshing...
              </>
            ) : (
              '🔄 Refresh Prices Now'
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">About Price APIs</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  <strong>Multiple Providers:</strong> Configure multiple APIs as fallback - if one fails, the next is tried
                </li>
                <li>
                  <strong>Smart Caching:</strong> Once a provider succeeds for a symbol, it's used first next time
                </li>
                <li>
                  <strong>Priority Order:</strong> Lower priority number = tried first (1 is highest)
                </li>
                <li>
                  <strong>Yahoo Finance:</strong> Uses a CORS proxy to access data (no API key needed, works for international stocks)
                </li>
                <li>
                  <strong>Rate Limits:</strong> Price updates have 1 second delay between requests to respect API limits
                </li>
              </ul>
              <p className="mt-3">
                Get free API keys:
                {' '}<a href={PROVIDER_INFO.twelvedata.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Twelve Data</a>
                {' • '}<a href={PROVIDER_INFO.alphavantage.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Alpha Vantage</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiSettings;
