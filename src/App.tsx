import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Overview from './components/Dashboard/Overview';
import CategoryManager from './components/Categories/CategoryManager';
import CategoryGroupManager from './components/Categories/CategoryGroupManager';
import FileUpload from './components/ImportWizard/FileUpload';
import AccountViewer from './components/Accounts/AccountViewer';
import JournalView from './components/Journal/JournalView';
import ExchangeRateManager from './components/Settings/ExchangeRateManager';
import AllApiSettings from './components/Settings/AllApiSettings';
import LogViewer from './components/Logs/LogViewer';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/UI/LoadingSpinner';
import { initializeDefaults } from './services/seedData';
import { initializeBuiltInFormats } from './services/formatManager';
import { db } from './services/db';
import { refreshAllPrices } from './services/priceFetcher';
import { refreshCommonExchangeRates } from './services/exchangeRateManager';
import { migrateAllPatterns } from './utils/patternMigration';
import { logger } from './utils';

type TabType = 'dashboard' | 'categories' | 'groups' | 'accounts' | 'journal' | 'rates' | 'settings' | 'import' | 'logs';

interface Tab {
  id: TabType;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'categories', label: 'Categories', icon: '🏷️' },
  { id: 'groups', label: 'Groups', icon: '🎨' },
  { id: 'accounts', label: 'Accounts', icon: '🏦' },
  { id: 'journal', label: 'Journal', icon: '📔' },
  { id: 'rates', label: 'Exchange Rates', icon: '💱' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'import', label: 'Import', icon: '📁' },
  { id: 'logs', label: 'Logs', icon: '📋' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Watch settings for changes (live query)
  const settings = useLiveQuery(() => db.settings.get('default'));

  // Initialize default groups and rules on first load
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize default categories/groups
        const result = await initializeDefaults();
        if (!result.success) {
          logger.warn('Failed to initialize defaults:', result.message);
          setInitError(result.message);
        }

        // Initialize built-in import formats
        await initializeBuiltInFormats();

        // Run pattern migration to update legacy patterns to new multi-field format
        const migrationResult = await migrateAllPatterns();
        logger.info(`Pattern migration: ${migrationResult.migrated}/${migrationResult.total} patterns migrated`);
        if (migrationResult.errors.length > 0) {
          logger.warn('Pattern migration had errors:', migrationResult.errors);
        }
      } catch (error) {
        logger.error('Error during initialization:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  // Automatic price refresh scheduler (runs in background, reacts to settings changes)
  useEffect(() => {
    if (!isInitialized || !settings) return;

    // Check if auto-refresh is enabled and at least one provider is enabled
    const hasEnabledProviders = settings.priceApiProviders?.some(p => p.enabled) ||
      (settings.priceApiProvider && settings.priceApiProvider !== 'none' && settings.priceApiKey); // Legacy support

    if (settings.priceApiAutoRefresh && hasEnabledProviders) {
      const intervalMs = (settings.priceApiRefreshInterval || 60) * 60 * 1000;

      logger.info(`[Auto-Refresh] Setting up automatic price refresh every ${settings.priceApiRefreshInterval} minutes`);

      // Set up interval for automatic refresh
      const intervalId = setInterval(async () => {
        try {
          logger.info('[Auto-Refresh] Running automatic price refresh...');
          const results = await refreshAllPrices();
          logger.info(`[Auto-Refresh] Completed: ${results.success}/${results.total} updated, ${results.failed} failed`);
        } catch (error) {
          logger.error('[Auto-Refresh] Failed:', error);
        }
      }, intervalMs);

      // Clean up interval on unmount or when settings change
      return () => {
        logger.info('[Auto-Refresh] Cleaning up automatic price refresh interval');
        clearInterval(intervalId);
      };
    } else {
      logger.info('[Auto-Refresh] Auto-refresh is disabled or not configured');
    }
  }, [isInitialized, settings?.priceApiAutoRefresh, settings?.priceApiProviders, settings?.priceApiRefreshInterval]);

  // Automatic exchange rate refresh scheduler (runs in background, reacts to settings changes)
  useEffect(() => {
    if (!isInitialized || !settings) return;

    // Check if auto-refresh is enabled and at least one provider is enabled
    const hasEnabledProviders = settings.exchangeRateApiProviders?.some(p => p.enabled);

    if (settings.exchangeRateAutoRefresh && hasEnabledProviders) {
      const intervalMs = (settings.exchangeRateRefreshInterval || 1440) * 60 * 1000;

      logger.info(`[Auto-Refresh-Rates] Setting up automatic exchange rate refresh every ${settings.exchangeRateRefreshInterval} minutes`);

      // Set up interval for automatic refresh
      const intervalId = setInterval(async () => {
        try {
          logger.info('[Auto-Refresh-Rates] Running automatic exchange rate refresh...');
          const results = await refreshCommonExchangeRates();
          logger.info(`[Auto-Refresh-Rates] Completed: ${results.success}/${results.total} updated, ${results.failed} failed`);
        } catch (error) {
          logger.error('[Auto-Refresh-Rates] Failed:', error);
        }
      }, intervalMs);

      // Clean up interval on unmount or when settings change
      return () => {
        logger.info('[Auto-Refresh-Rates] Cleaning up automatic exchange rate refresh interval');
        clearInterval(intervalId);
      };
    } else {
      logger.info('[Auto-Refresh-Rates] Auto-refresh is disabled or not configured');
    }
  }, [isInitialized, settings?.exchangeRateAutoRefresh, settings?.exchangeRateApiProviders, settings?.exchangeRateRefreshInterval]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Overview />;
      case 'categories':
        return <CategoryManager />;
      case 'groups':
        return <CategoryGroupManager />;
      case 'accounts':
        return <AccountViewer />;
      case 'journal':
        return <JournalView />;
      case 'rates':
        return <ExchangeRateManager />;
      case 'settings':
        return <AllApiSettings />;
      case 'import':
        return <FileUpload />;
      case 'logs':
        return <LogViewer />;
      default:
        return <Overview />;
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LoadingSpinner
          size="lg"
          text="Initializing application..."
          className="h-screen"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Expense Tracker
            </h1>
            {initError && (
              <div className="text-sm text-amber-600">
                Warning: {initError}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                  transition-colors duration-200
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[600px]">
          <ErrorBoundary key={activeTab}>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500">
        <p>Personal Expense Tracker - Manage your finances with ease</p>
      </footer>
    </div>
  );
}

export default App
