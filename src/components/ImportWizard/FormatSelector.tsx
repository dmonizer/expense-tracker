import { useState, useEffect } from 'react';
import { logger } from '../../utils';
import type { ImportFormatDefinition } from '../../types';
import { getAllFormats } from '../../services/formatManager';
import { detectFormat } from '../../services/formatDetector';
import FormatWizardMain from './FormatWizard/FormatWizardMain';
import { Label } from '@/components/ui/label';

interface FormatSelectorProps {
  file: File;
  onFormatSelected: (format: ImportFormatDefinition) => void;
  onCancel: () => void;
}

export default function FormatSelector({ 
  file, 
  onFormatSelected, 
  onCancel 
}: Readonly<FormatSelectorProps>) {
  const [detectedFormat, setDetectedFormat] = useState<ImportFormatDefinition | null>(null);
  const [allFormats, setAllFormats] = useState<ImportFormatDefinition[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    initializeFormats();
  }, []);

  const initializeFormats = async () => {
    setIsDetecting(true);
    
    try {
      // Load all formats
      const formats = await getAllFormats();
      setAllFormats(formats);

      // Attempt auto-detection
      const detected = await detectFormat(file);
      setDetectedFormat(detected);
      
      if (detected) {
        setSelectedFormatId(detected.id);
      } else if (formats.length > 0) {
        // Select first format as fallback
        setSelectedFormatId(formats[0].id);
      }
    } catch (error) {
      logger.error('Format initialization error:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleUseFormat = () => {
    const format = allFormats.find(f => f.id === selectedFormatId);
    if (format) {
      onFormatSelected(format);
    }
  };

  const handleCreateNew = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = (format: ImportFormatDefinition) => {
    setShowWizard(false);
    onFormatSelected(format);
  };

  if (showWizard) {
    return (
      <FormatWizardMain
        file={file}
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Select Import Format
      </h2>

      <div className="space-y-4">
        {/* File Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            File: <span className="font-medium text-gray-900">{file.name}</span>
          </p>
          <p className="text-sm text-gray-600">
            Size: <span className="font-medium text-gray-900">
              {(file.size / 1024).toFixed(2)} KB
            </span>
          </p>
        </div>

        {/* Detection Status */}
        {isDetecting && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Detecting format...</p>
          </div>
        )}

        {/* Detected Format */}
        {!isDetecting && detectedFormat && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg 
                  className="h-5 w-5 text-green-500" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Format Detected
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  We detected this file matches the <strong>{detectedFormat.name}</strong> format.
                </p>
                {detectedFormat.description && (
                  <p className="mt-1 text-xs text-green-600 italic">
                    {detectedFormat.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Detection */}
        {!isDetecting && !detectedFormat && allFormats.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              No matching format detected. Please select a format manually or create a new one.
            </p>
          </div>
        )}

        {/* Format Selection */}
        {!isDetecting && allFormats.length > 0 && (
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Choose Import Format
            </Label>
            <select
              value={selectedFormatId}
              onChange={(e) => setSelectedFormatId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allFormats.map(format => (
                <option key={format.id} value={format.id}>
                  {format.name}
                  {format.isBuiltIn && ' (Built-in)'}
                  {format.isDefault && ' (Default)'}
                </option>
              ))}
            </select>
            
            {/* Selected Format Details */}
            {selectedFormatId && (
              <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                {(() => {
                  const format = allFormats.find(f => f.id === selectedFormatId);
                  if (!format) return null;
                  
                  return (
                    <>
                      {format.description && (
                        <p className="text-gray-700 mb-2">{format.description}</p>
                      )}
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Type:</span> {format.fileType.toUpperCase()}
                        </div>
                        {format.csvSettings && (
                          <div>
                            <span className="font-medium">Delimiter:</span>{' '}
                            {format.csvSettings.delimiter === ';' ? 'Semicolon' :
                             format.csvSettings.delimiter === ',' ? 'Comma' :
                             format.csvSettings.delimiter === '\t' ? 'Tab' : 'Other'}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Fields:</span>{' '}
                          {format.fieldMappings.filter(m => m.targetField !== 'ignore').length} mapped
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* No Formats Available */}
        {!isDetecting && allFormats.length === 0 && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 text-center">
            <p className="text-gray-700 mb-2">No import formats configured yet</p>
            <p className="text-sm text-gray-600">
              Create your first format using the wizard below
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
            >
              Create New Format
            </button>

            {allFormats.length > 0 && (
              <button
                onClick={handleUseFormat}
                disabled={!selectedFormatId}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Use This Format
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
