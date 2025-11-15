import { useState } from 'react';
import ApiSettings from './ApiSettings';
import ExchangeRateApiSettings from './ExchangeRateApiSettings';
import FormatManager from './FormatManager/FormatManager';

type SettingsTab = 'prices' | 'rates' | 'formats';

function AllApiSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('prices');

  return (
    <div className="h-full flex flex-col">
      {/* Sub-navigation tabs */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 pt-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('prices')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'prices'
                ? 'bg-white text-blue-600 border-t-2 border-l border-r border-blue-500'
                : 'bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
          >
            📈 Price APIs
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'rates'
                ? 'bg-white text-blue-600 border-t-2 border-l border-r border-blue-500'
                : 'bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
          >
            💱 Exchange Rate APIs
          </button>
          <button
            onClick={() => setActiveTab('formats')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'formats'
                ? 'bg-white text-blue-600 border-t-2 border-l border-r border-blue-500'
                : 'bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Import Formats
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'prices' && <ApiSettings />}
        {activeTab === 'rates' && <ExchangeRateApiSettings />}
        {activeTab === 'formats' && <FormatManager />}
      </div>
    </div>
  );
}

export default AllApiSettings;
