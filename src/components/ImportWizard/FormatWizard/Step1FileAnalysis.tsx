import { useState, useEffect } from 'react';
import { logger } from '../../../utils';
import Papa from 'papaparse';
import type { CSVSettings } from '../../../types';
import type { WizardState } from './FormatWizardMain';

interface Step1Props {
  file: File;
  initialSettings: CSVSettings;
  onComplete: (data: Partial<WizardState>) => void;
  onCancel: () => void;
}

export default function Step1FileAnalysis({ 
  file, 
  initialSettings, 
  onComplete, 
  onCancel 
}: Step1Props) {
  const [csvSettings, setCSVSettings] = useState<CSVSettings>(initialSettings);
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: string[][];
  }>({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect delimiter on first load
  useEffect(() => {
    detectDelimiter();
  });

  // Re-parse when settings change
  useEffect(() => {
    parsePreview();
  },[]);

  const detectDelimiter = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 5); // Check first 5 lines
      
      // Count occurrences of common delimiters
      const delimiters = [';', ',', '\t', '|'];
      const counts = delimiters.map(delim => ({
        delimiter: delim,
        count: lines.reduce((sum, line) => sum + (line.split(delim).length - 1), 0),
      }));

      // Find delimiter with highest consistent count
      const detected = counts.reduce((max, curr) => 
        curr.count > max.count ? curr : max
      );

      if (detected.count > 0) {
        setCSVSettings(prev => ({ ...prev, delimiter: detected.delimiter }));
      }
    } catch (err) {
      logger.error('Delimiter detection error:', err);
      setError('Failed to analyze file');
    } finally {
      setIsLoading(false);
    }
  };

  const parsePreview = () => {
    setIsLoading(true);
    setError(null);

    Papa.parse(file, {
      delimiter: csvSettings.delimiter,
      skipEmptyLines: csvSettings.skipEmptyLines,
      preview: 10 + (csvSettings.skipRows || 0), // Get extra rows to account for skipped ones
      complete: (results) => {
        try {
          let data = results.data as string[][];
          
          // Skip rows if configured
          if (csvSettings.skipRows && csvSettings.skipRows > 0) {
            data = data.slice(csvSettings.skipRows);
          }

          if (csvSettings.hasHeader && data.length > 0) {
            setPreviewData({
              headers: data[0] as string[],
              rows: data.slice(1, 11), // Show first 10 data rows
            });
          } else {
            // Generate numeric headers
            const numCols = data[0]?.length || 0;
            setPreviewData({
              headers: Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`),
              rows: data.slice(0, 10),
            });
          }
          
          setIsLoading(false);
        } catch (err) {
          logger.error('Parse error:', err);
          setError('Failed to parse CSV file');
          setIsLoading(false);
        }
      },
      error: (err) => {
        logger.error('CSV parse error:', err);
        setError(`Parse error: ${err.message}`);
        setIsLoading(false);
      },
    });
  };

  const handleNext = () => {
    onComplete({
      csvSettings,
      parsedPreview: previewData,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Step 1: Configure CSV Settings
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Analyzing file: <span className="font-medium">{file.name}</span>
        </p>
      </div>

      {/* CSV Settings Form */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Delimiter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delimiter
            </label>
            <select
              value={csvSettings.delimiter}
              onChange={(e) => setCSVSettings(prev => ({ ...prev, delimiter: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value=";">Semicolon (;)</option>
              <option value=",">Comma (,)</option>
              <option value="\t">Tab</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>

          {/* Encoding */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Encoding
            </label>
            <select
              value={csvSettings.encoding}
              onChange={(e) => setCSVSettings(prev => ({ ...prev, encoding: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="utf-8">UTF-8</option>
              <option value="windows-1252">Windows-1252</option>
              <option value="iso-8859-1">ISO-8859-1</option>
            </select>
          </div>

          {/* Skip Rows */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skip Rows (from top)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={csvSettings.skipRows || 0}
              onChange={(e) => setCSVSettings(prev => ({ ...prev, skipRows: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={csvSettings.hasHeader}
              onChange={(e) => setCSVSettings(prev => ({ ...prev, hasHeader: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">First row contains headers</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={csvSettings.skipEmptyLines}
              onChange={(e) => setCSVSettings(prev => ({ ...prev, skipEmptyLines: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Skip empty lines</span>
          </label>
        </div>
      </div>

      {/* Preview */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Preview (first 10 rows)</h4>
        
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            Loading preview...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!isLoading && !error && previewData.headers.length > 0 && (
          <div className="border rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {previewData.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {rowIdx + 1}
                    </td>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap"
                      >
                        {cell || <span className="text-gray-400 italic">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        
        <button
          onClick={handleNext}
          disabled={isLoading || error !== null || previewData.headers.length === 0}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Next: Map Fields
        </button>
      </div>
    </div>
  );
}
