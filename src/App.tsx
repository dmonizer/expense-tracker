import { useState, useEffect } from 'react';
import Overview from './components/Dashboard/Overview';
import CategoryManager from './components/Categories/CategoryManager';
import CategoryGroupManager from './components/Categories/CategoryGroupManager';
import FileUpload from './components/ImportWizard/FileUpload';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/UI/LoadingSpinner';
import { initializeDefaults } from './services/seedData';

type TabType = 'dashboard' | 'categories' | 'groups' | 'import';

interface Tab {
  id: TabType;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'categories', label: 'Categories', icon: '🏷️' },
  { id: 'groups', label: 'Groups', icon: '🎨' },
  { id: 'import', label: 'Import', icon: '📁' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize default groups and rules on first load
  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await initializeDefaults();
        if (!result.success) {
          console.warn('Failed to initialize defaults:', result.message);
          setInitError(result.message);
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Overview />;
      case 'categories':
        return <CategoryManager />;
      case 'groups':
        return <CategoryGroupManager />;
      case 'import':
        return <FileUpload />;
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
