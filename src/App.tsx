import { useState } from 'react';
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
import LoadingSpinner from './components/ui/LoadingSpinner';
import { db } from './services/db';
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { useAppInitialization } from './hooks/useAppInitialization';
import { usePriceRefreshScheduler } from './hooks/usePriceRefreshScheduler';
import { useExchangeRateScheduler } from './hooks/useExchangeRateScheduler';
import { useBackupScheduler } from './hooks/useBackupScheduler';

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

  // Watch settings for changes (live query)
  const settings = useLiveQuery(() => db.settings.get('default'));

  // Initialize application (defaults, formats, migrations)
  const { isInitialized, error: initError } = useAppInitialization();

  // Set up automatic schedulers
  usePriceRefreshScheduler(settings, isInitialized);
  useExchangeRateScheduler(settings, isInitialized);
  useBackupScheduler(settings, isInitialized);

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


    <ConfirmProvider>
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
            <div className="flex space-x-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-3 border-b-2 rounded-none font-medium text-sm
                    transition-colors duration-200
                    ${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }
                  `}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </Button>
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
        <Toaster />
      </div>
    </ConfirmProvider>
  );
}


export default App
