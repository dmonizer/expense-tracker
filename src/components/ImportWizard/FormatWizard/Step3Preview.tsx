import { useState, useEffect } from 'react';
import { format as formatDate } from 'date-fns';
import type { 
  Transaction, 
  FieldMapping, 
  CSVSettings,
  ImportFormatDefinition 
} from '../../../types';
import type { WizardState } from './FormatWizardMain';
import { parseWithCustomFormat } from '../../../services/csvParser';
import type { ParseError } from '../../../services/csvParser';

interface Step3Props {
  file: File;
  csvSettings: CSVSettings;
  fieldMappings: FieldMapping[];
  onComplete: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export default function Step3Preview({ 
  file, 
  csvSettings, 
  fieldMappings, 
  onComplete, 
  onBack 
}: Readonly<Step3Props>) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState<ParseError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    parsePreview();
  }, []);

  const parsePreview = async () => {
    setIsLoading(true);
    setErrors([]);

    try {
      // Create temporary format definition for parsing
      const tempFormat: ImportFormatDefinition = {
        id: 'temp',
        name: 'Preview',
        fileType: 'csv',
        csvSettings,
        fieldMappings,
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await parseWithCustomFormat(file, tempFormat);
      
      setTransactions(result.transactions.slice(0, 50)); // Show first 50
      setErrors(result.errors);
      setErrorDetails(result.errorDetails || []);
    } catch (error) {
      console.error('Preview parse error:', error);
      setErrors([`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    onComplete({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Step 3: Preview Parsed Transactions
        </h3>
        <p className="text-sm text-gray-600">
          Review the parsed transactions to ensure everything looks correct.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">
            {transactions.length}
          </div>
          <div className="text-sm text-green-600">
            Transactions Parsed
          </div>
        </div>
        
        <div className={`${errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
          <div className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-700' : 'text-gray-700'}`}>
            {errors.length}
          </div>
          <div className={`text-sm ${errors.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            Parse Errors
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">
            {transactions.length > 0 
              ? transactions.reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : 0), 0).toFixed(2)
              : '0.00'}
          </div>
          <div className="text-sm text-blue-600">
            Total Debits
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-yellow-800">
              {errors.length} row(s) could not be parsed
            </h4>
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="text-xs text-yellow-700 underline hover:text-yellow-900"
            >
              {showErrors ? 'Hide' : 'Show'} Errors
            </button>
          </div>
          
          {showErrors && (
            <div className="mt-2 max-h-96 overflow-y-auto">
              {errorDetails.length > 0 ? (
                <div className="space-y-3">
                  {errorDetails.map((errorDetail, idx) => (
                    <div key={idx} className="bg-white border border-yellow-200 rounded p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800">
                          Row {errorDetail.rowNumber}
                        </span>
                        <span className="text-xs text-yellow-800 font-medium">
                          {errorDetail.message}
                        </span>
                      </div>
                      
                      {errorDetail.rawData && (
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Raw CSV Data:</div>
                          <div className="text-xs font-mono text-gray-600 space-y-0.5">
                            {Object.entries(errorDetail.rawData).map(([key, value]) => (
                              <div key={key} className="flex">
                                <span className="text-gray-500 min-w-[120px]">{key}:</span>
                                <span className="text-gray-800 break-all">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="text-xs text-yellow-700 space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx} className="font-mono">{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Parsing transactions...</p>
        </div>
      )}

      {/* Preview Table */}
      {!isLoading && transactions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Transaction Preview (first 50 rows)
          </h4>
          
          <div className="border rounded-lg overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Payee
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Currency
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(transaction.date, 'dd.MM.yyyy')}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate">
                      {transaction.payee}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-md truncate">
                      {transaction.description}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium whitespace-nowrap">
                      <span className={transaction.type === 'debit' ? 'text-red-600' : 'text-green-600'}>
                        {transaction.type === 'debit' ? '-' : '+'}
                        {transaction.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      <span className={`px-2 py-1 text-xs rounded ${
                        transaction.type === 'debit' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {transaction.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data */}
      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No transactions could be parsed</p>
          <p className="text-sm mt-2">Please go back and check your field mappings</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back: Adjust Mappings
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={parsePreview}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 disabled:opacity-50"
          >
            Re-parse
          </button>
          
          <button
            onClick={handleNext}
            disabled={isLoading || transactions.length === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Next: Save Format
          </button>
        </div>
      </div>
    </div>
  );
}
