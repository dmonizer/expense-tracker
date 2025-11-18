import { useState } from 'react';
import { logger } from '../../utils';
import type { Transaction, ImportFormatDefinition } from '../../types';
import { parseSwedBankCSV, parseWithCustomFormat, detectDuplicates, importTransactions } from '../../services/csvParser';
import { categorizeBatch } from '../../services/categorizer';
import { detectFormat } from '../../services/formatDetector';
import PreviewTable from './PreviewTable';
import ImportSummary from './ImportSummary';
import FormatSelector from './FormatSelector';
import { FILE_UPLOAD } from '../../constants';

function FileUpload() {
  const [step, setStep] = useState<'upload' | 'formatSelect' | 'preview' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parse result data
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [newTransactions, setNewTransactions] = useState<Transaction[]>([]);
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Import result data
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > FILE_UPLOAD.MAX_SIZE_BYTES) {
      setError(`File size must be less than ${FILE_UPLOAD.MAX_SIZE_MB}MB`);
      return;
    }

    setFile(selectedFile);
    setError(null);
    processFile(selectedFile);
  };

  const handleFormatSelected = (format: ImportFormatDefinition) => {
    if (file) {
      processFileWithFormat(file, format);
    }
  };

  const processFile = async (fileToProcess: File) => {
    setLoading(true);
    setError(null);

    try {
      // Try to auto-detect format
      const detectedFormat = await detectFormat(fileToProcess);
      
      if (detectedFormat) {
        logger.info('[FileUpload] Using detected format:', detectedFormat.name);
        await processFileWithFormat(fileToProcess, detectedFormat);
      } else {
        // No format detected, show selector
        logger.info('[FileUpload] No format detected, showing selector');
        setLoading(false);
        setStep('formatSelect');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to detect format';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const processFileWithFormat = async (fileToProcess: File, format: ImportFormatDefinition) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Parse CSV with format
      let parseResult;
      
      if (format.id === 'swedbank-estonia-builtin') {
        // Use legacy parser for Swedbank
        parseResult = await parseSwedBankCSV(fileToProcess);
      } else {
        // Use generic parser with format definition
        parseResult = await parseWithCustomFormat(fileToProcess, format);
      }

      if (parseResult.errors.length > 0) {
        setParseErrors(parseResult.errors);
      }

      if (parseResult.transactions.length === 0) {
        setError('No valid transactions found in the CSV file');
        setLoading(false);
        return;
      }

      // Step 2: Check for duplicates
      const duplicateResult = await detectDuplicates(parseResult.transactions);

      // Step 3: Auto-categorize new transactions
      const categorizedTransactions = await categorizeBatch(
        duplicateResult.newTransactions
      );

      // Build duplicate ID set for marking in preview
      const dupIds = new Set(
        duplicateResult.duplicateTransactions.map((t) => t.id)
      );

      // Combine categorized new transactions with duplicates for preview
      const allForPreview = [
        ...categorizedTransactions,
        ...duplicateResult.duplicateTransactions,
      ];

      setAllTransactions(allForPreview);
      setNewTransactions(categorizedTransactions);
      setDuplicateIds(dupIds);

      // Move to preview step
      setStep('preview');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process file';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (newTransactions.length === 0) {
      return;
    }

    setLoading(true);

    try {
      const result = await importTransactions(
        newTransactions,
        file?.name || 'unknown',
        allTransactions.length,
        duplicateIds.size
      );

      setImportSuccess(result.success);
      setImportedCount(result.newCount);
      setStep('summary');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to import transactions';
      setError(errorMessage);
      setImportSuccess(false);
      setStep('summary');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetState();
  };

  const handleImportAnother = () => {
    resetState();
  };

  const handleViewTransactions = () => {
    // This would trigger navigation to transactions tab
    // For now, we'll just reset
    globalThis.location.reload();
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setLoading(false);
    setError(null);
    setAllTransactions([]);
    setNewTransactions([]);
    setDuplicateIds(new Set());
    setParseErrors([]);
    setImportSuccess(false);
    setImportedCount(0);
  };

  // Render upload step
  if (step === 'upload') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Import Transactions
            </h2>
            <p className="text-gray-600">
              Upload your bank statement CSV file to import transactions
            </p>
          </div>

          {/* Drag and Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="space-y-4">
              {/* Upload Icon */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <div>
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                >
                  Choose a file
                </label>
                <span className="text-gray-600"> or drag and drop</span>
              </div>

              <p className="text-sm text-gray-500">
                CSV files up to 10MB
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-red-600 mt-0.5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-red-900">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading Display */}
          {loading && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">
                    Processing file...
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Parsing and checking for duplicates
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Supported Formats
            </h3>
            <p className="text-sm text-gray-600">
              This importer supports various CSV formats. The system will automatically
              detect known formats or you can create a custom format for your bank.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render format selection step
  if (step === 'formatSelect' && file) {
    return (
      <FormatSelector
        file={file}
        onFormatSelected={handleFormatSelected}
        onCancel={handleCancel}
      />
    );
  }

  // Render preview step
  if (step === 'preview') {
    return (
      <PreviewTable
        transactions={allTransactions}
        duplicateIds={duplicateIds}
        onConfirm={handleConfirmImport}
        onCancel={handleCancel}
      />
    );
  }

  // Render summary step
  return (
    <ImportSummary
      success={importSuccess}
      newCount={importedCount}
      duplicateCount={duplicateIds.size}
      totalCount={allTransactions.length}
      errors={parseErrors}
      onViewTransactions={handleViewTransactions}
      onImportAnother={handleImportAnother}
    />
  );
}

export default FileUpload;
