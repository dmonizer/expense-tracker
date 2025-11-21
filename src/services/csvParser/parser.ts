import Papa from 'papaparse';
import type { ImportFormatDefinition, Transaction } from '../../types';
import type { ParseResult, ParseError } from './types';
import { processRow } from './mappers';
import { parseSwedBankCSV } from './swedbank';

/**
 * Parse CSV file using custom format definition
 */
export async function parseWithCustomFormat(
    file: File,
    format: ImportFormatDefinition
): Promise<ParseResult> {
    if (format.fileType !== 'csv' || !format.csvSettings) {
        throw new Error('Only CSV format is supported');
    }

    return new Promise((resolve) => {
        const errors: string[] = [];
        const errorDetails: ParseError[] = [];
        const transactions: Transaction[] = [];
        let totalRows = 0;

        Papa.parse(file, {
            header: format.csvSettings?.hasHeader ?? true,
            delimiter: format.csvSettings?.delimiter ?? ',',
            skipEmptyLines: format.csvSettings?.skipEmptyLines ?? true,
            transformHeader: (header: string) => header.trim(),
            transform: (value: string) => value.trim(),
            complete: (results) => {
                let data = results.data;
                totalRows = data.length;

                // Skip rows if configured
                if (format.csvSettings?.skipRows && format.csvSettings.skipRows > 0) {
                    data = data.slice(format.csvSettings.skipRows);
                }

                // Process each row
                data.forEach((row, index) => {
                    try {
                        const transaction = processRow(row, format);
                        transactions.push(transaction);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        errors.push(`Row ${index + 1}: ${errorMessage}`);
                        errorDetails.push({
                            rowNumber: index + 1,
                            message: errorMessage,
                            rawData: row as string,
                        });
                    }
                });

                resolve({
                    transactions,
                    errors,
                    errorDetails,
                    totalRows,
                });
            },
            error: (error) => {
                resolve({
                    transactions: [],
                    errors: [`CSV parsing error: ${error.message}`],
                    errorDetails: [],
                    totalRows: 0,
                });
            },
        });
    });
}

// Re-export for backward compatibility
export { parseSwedBankCSV };
