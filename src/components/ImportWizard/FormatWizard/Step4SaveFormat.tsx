import { useState } from 'react';
import { logger } from '../../../utils';
import type { 
  FieldMapping, 
  CSVSettings, 
  DetectionPattern,
  ImportFormatDefinition 
} from '../../../types';
import { saveFormat, updateFormat } from '../../../services/formatManager';
import { Label } from '@/components/ui/label';

interface Step4Props {
  file: File;
  csvSettings: CSVSettings;
  fieldMappings: FieldMapping[];
  detectionPattern?: DetectionPattern;
  existingFormat?: ImportFormatDefinition;
  onComplete: (format: ImportFormatDefinition) => void;
  onBack: () => void;
  onCancel: () => void;
}

export default function Step4SaveFormat({ 
  file,
  csvSettings, 
  fieldMappings,
  detectionPattern,
  existingFormat,
  onComplete, 
  onBack,
  onCancel 
}: Step4Props) {
  const [formatName, setFormatName] = useState(existingFormat?.name || '');
  const [description, setDescription] = useState(existingFormat?.description || '');
  const [enableAutoDetect, setEnableAutoDetect] = useState(!!existingFormat?.detectionPattern || false);
  const [setAsDefault, setSetAsDefault] = useState(existingFormat?.isDefault || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detection settings
  const [autoDetectSettings, setAutoDetectSettings] = useState<DetectionPattern>(
    detectionPattern || existingFormat?.detectionPattern || {
      headerPattern: csvSettings.hasHeader 
        ? fieldMappings
            .filter(m => typeof m.sourceColumn === 'string')
            .map(m => m.sourceColumn as string)
        : undefined,
      fileNamePattern: undefined,
    }
  );

  const handleSave = async () => {
    if (!formatName.trim()) {
      setError('Please enter a format name');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formatData = {
        name: formatName.trim(),
        description: description.trim() || undefined,
        fileType: 'csv' as const,
        csvSettings,
        fieldMappings,
        detectionPattern: enableAutoDetect ? autoDetectSettings : undefined,
        isBuiltIn: false,
        isDefault: setAsDefault,
      };

      if (existingFormat) {
        // Update existing format
        const updatedFormat: ImportFormatDefinition = {
          ...existingFormat,
          ...formatData,
          updatedAt: new Date(),
        };
        await updateFormat(updatedFormat);
        onComplete(updatedFormat);
      } else {
        // Create new format
        const formatId = await saveFormat(formatData);
        const newFormat: ImportFormatDefinition = {
          ...formatData,
          id: formatId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onComplete(newFormat);
      }
    } catch (err) {
      logger.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save format');
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Step 4: Save Format Definition
        </h3>
        <p className="text-sm text-gray-600">
          Give your format a name and configure auto-detection settings.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Format Name & Description */}
      <div className="space-y-4">
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            Format Name <span className="text-red-500">*</span>
          </Label>
          <input
            type="text"
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            placeholder="e.g., My Bank CSV Format"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this format or where it's used..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Auto-Detection Settings */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Auto-Detection
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              Automatically detect this format when importing files
            </p>
          </div>
          <Label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enableAutoDetect}
              onChange={(e) => setEnableAutoDetect(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </Label>
        </div>

        {enableAutoDetect && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="block text-xs font-medium text-gray-700 mb-1">
                Filename Pattern (regex)
              </Label>
              <input
                type="text"
                value={autoDetectSettings.fileNamePattern || ''}
                onChange={(e) => setAutoDetectSettings(prev => ({
                  ...prev,
                  fileNamePattern: e.target.value || undefined,
                }))}
                placeholder="e.g., .*statement.*\\.csv$"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Regex pattern to match filenames (e.g., ".*statement.*\.csv$")
              </p>
            </div>

            <div>
              <Label className="block text-xs font-medium text-gray-700 mb-1">
                Header Pattern (detected automatically)
              </Label>
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                {autoDetectSettings.headerPattern && autoDetectSettings.headerPattern.length > 0 
                  ? autoDetectSettings.headerPattern.join(', ')
                  : 'No headers detected'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The system will check if CSV headers match these column names
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Default Format */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="setDefault"
          checked={setAsDefault}
          onChange={(e) => setSetAsDefault(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <Label htmlFor="setDefault" className="text-sm text-gray-700">
          Set as default format (will be used when no format is auto-detected)
        </Label>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Format Summary</h4>
        <dl className="text-xs space-y-1">
          <div className="flex justify-between">
            <dt className="text-blue-700">File:</dt>
            <dd className="text-blue-900 font-medium">{file.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-700">Delimiter:</dt>
            <dd className="text-blue-900 font-medium">
              {csvSettings.delimiter === ';' ? 'Semicolon' :
               csvSettings.delimiter === ',' ? 'Comma' :
               csvSettings.delimiter === '\t' ? 'Tab' : 'Other'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-700">Fields Mapped:</dt>
            <dd className="text-blue-900 font-medium">
              {fieldMappings.filter(m => m.targetField !== 'ignore').length}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-700">Auto-Detection:</dt>
            <dd className="text-blue-900 font-medium">
              {enableAutoDetect ? 'Enabled' : 'Disabled'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || !formatName.trim()}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : existingFormat ? 'Update Format' : 'Save Format'}
          </button>
        </div>
      </div>
    </div>
  );
}
