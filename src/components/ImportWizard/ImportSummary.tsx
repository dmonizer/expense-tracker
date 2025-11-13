interface ImportSummaryProps {
  success: boolean;
  newCount: number;
  duplicateCount: number;
  totalCount: number;
  errors?: string[];
  onViewTransactions: () => void;
  onImportAnother: () => void;
}

function ImportSummary({
  success,
  newCount,
  duplicateCount,
  totalCount,
  errors = [],
  onViewTransactions,
  onImportAnother,
}: ImportSummaryProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-2xl w-full">
        {success ? (
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            {/* Success Message */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Import Completed Successfully
            </h2>
            <p className="text-gray-600 mb-8">
              Your transactions have been imported and categorized.
            </p>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="text-sm text-blue-600 font-medium mb-1">
                  Total Processed
                </div>
                <div className="text-3xl font-bold text-blue-900">
                  {totalCount}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <div className="text-sm text-green-600 font-medium mb-1">
                  Imported
                </div>
                <div className="text-3xl font-bold text-green-900">
                  {newCount}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-6">
                <div className="text-sm text-amber-600 font-medium mb-1">
                  Duplicates Skipped
                </div>
                <div className="text-3xl font-bold text-amber-900">
                  {duplicateCount}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={onViewTransactions}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                View Transactions
              </button>
              <button
                onClick={onImportAnother}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {/* Error Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Import Failed
            </h2>
            <p className="text-gray-600 mb-6">
              There was a problem importing your transactions.
            </p>

            {/* Error Details */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left">
                <h3 className="text-sm font-semibold text-red-900 mb-2">
                  Errors:
                </h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-red-600 italic">
                      ... and {errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={onImportAnother}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportSummary;
