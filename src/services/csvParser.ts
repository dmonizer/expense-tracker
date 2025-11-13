import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'date-fns';
import { db } from './db';
import type { Transaction, SwedBankCSVRow, ImportRecord } from '../types';

/**
 * Result of CSV parsing operation
 */
export interface ParseResult {
  transactions: Transaction[];
  errors: string[];
  totalRows: number;
}

/**
 * Result of duplicate checking operation
 */
export interface DuplicateCheckResult {
  newTransactions: Transaction[];
  duplicateTransactions: Transaction[];
}

/**
 * Result of import operation
 */
export interface ImportResult {
  success: boolean;
  newCount: number;
  duplicateCount: number;
  importRecordId: string;
}

/**
 * Parses a Swedbank Estonia CSV bank statement file
 * 
 * Handles:
 * - Semicolon delimiter
 * - Estonian number format (comma as decimal: "1,23" → 1.23)
 * - Date format: DD.MM.YYYY
 * - Filtering special row types (10, 82, 86)
 * - Whitespace trimming
 * - Empty row skipping
 * 
 * @param file - The CSV file to parse
 * @returns Promise resolving to ParseResult with transactions, errors, and row count
 */
export async function parseSwedBankCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const transactions: Transaction[] = [];
    let totalRows = 0;

    Papa.parse<SwedBankCSVRow>(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        totalRows = results.data.length;

        results.data.forEach((row, index) => {
          try {
            // Skip special row types (balance/summary rows)
            const rowType = row['Reatüüp'];
            if (rowType === '10' || rowType === '82' || rowType === '86') {
              return;
            }

            // Skip rows with empty required fields
            if (!row['Kuupäev'] || !row['Summa'] || !row['Arhiveerimistunnus']) {
              return;
            }

            // Parse date from DD.MM.YYYY format
            const dateStr = row['Kuupäev'];
            let transactionDate: Date;
            try {
              transactionDate = parse(dateStr, 'dd.MM.yyyy', new Date());
              if (isNaN(transactionDate.getTime())) {
                throw new Error('Invalid date');
              }
            } catch {
              errors.push(`Row ${index + 1}: Invalid date format "${dateStr}"`);
              return;
            }

            // Parse amount - convert Estonian format (comma as decimal) to number
            const amountStr = row['Summa'];
            const amount = parseEstonianNumber(amountStr);
            if (isNaN(amount)) {
              errors.push(`Row ${index + 1}: Invalid amount "${amountStr}"`);
              return;
            }

            // Determine transaction type (debit or credit)
            const debitCredit = row['Deebet/Kreedit'];
            const type = debitCredit === 'D' ? 'debit' : 'credit';

            // Create transaction object
            const transaction: Transaction = {
              id: uuidv4(),
              accountNumber: row['Kliendi konto'],
              date: transactionDate,
              payee: row['Saaja/Maksja'],
              description: row['Selgitus'],
              amount: amount,
              currency: row['Valuuta'],
              type: type,
              category: undefined,
              categoryConfidence: undefined,
              manuallyEdited: false,
              transactionType: row['Tehingu tüüp'],
              archiveId: row['Arhiveerimistunnus'],
              imported: new Date(),
            };

            transactions.push(transaction);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Row ${index + 1}: ${errorMessage}`);
          }
        });

        resolve({
          transactions,
          errors,
          totalRows,
        });
      },
      error: (error) => {
        resolve({
          transactions: [],
          errors: [`CSV parsing error: ${error.message}`],
          totalRows: 0,
        });
      },
    });
  });
}

/**
 * Converts Estonian number format to JavaScript number
 * 
 * Examples:
 * - "1,23" → 1.23
 * - "1234,56" → 1234.56
 * - "1 234,56" → 1234.56
 * 
 * @param value - The number string in Estonian format
 * @returns The parsed number
 */
function parseEstonianNumber(value: string): number {
  // Remove spaces (thousands separator in some formats)
  const cleaned = value.replace(/\s/g, '');
  
  // Replace comma with dot for decimal separator
  const normalized = cleaned.replace(',', '.');
  
  return parseFloat(normalized);
}

/**
 * Checks for duplicate transactions in the database
 * 
 * Primary method: Compare archiveId
 * Fallback method: Compare date + amount + payee
 * 
 * @param transactions - Array of transactions to check
 * @returns Promise resolving to arrays of new and duplicate transactions
 */
export async function detectDuplicates(
  transactions: Transaction[]
): Promise<DuplicateCheckResult> {
  const newTransactions: Transaction[] = [];
  const duplicateTransactions: Transaction[] = [];

  // Get all archive IDs from transactions to check
  const archiveIds = transactions
    .map((t) => t.archiveId)
    .filter((id) => id && id.length > 0);

  // Query database for existing transactions with these archive IDs
  const existingByArchiveId = await db.transactions
    .where('archiveId')
    .anyOf(archiveIds)
    .toArray();

  // Create a set of existing archive IDs for quick lookup
  const existingArchiveIds = new Set(
    existingByArchiveId.map((t) => t.archiveId)
  );

  // For fallback duplicate detection, get all transactions
  // within the date range of the input transactions
  const dates = transactions.map((t) => t.date);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const existingInDateRange = await db.transactions
    .where('date')
    .between(minDate, maxDate, true, true)
    .toArray();

  // Create a map for fallback duplicate detection
  // Key: date_amount_payee
  const existingByComposite = new Map<string, Transaction>();
  existingInDateRange.forEach((t) => {
    const key = createCompositeKey(t);
    existingByComposite.set(key, t);
  });

  // Check each transaction for duplicates
  transactions.forEach((transaction) => {
    let isDuplicate = false;

    // Primary check: archiveId
    if (transaction.archiveId && existingArchiveIds.has(transaction.archiveId)) {
      isDuplicate = true;
    }

    // Fallback check: date + amount + payee
    if (!isDuplicate) {
      const compositeKey = createCompositeKey(transaction);
      if (existingByComposite.has(compositeKey)) {
        isDuplicate = true;
      }
    }

    if (isDuplicate) {
      duplicateTransactions.push(transaction);
    } else {
      newTransactions.push(transaction);
    }
  });

  return {
    newTransactions,
    duplicateTransactions,
  };
}

/**
 * Creates a composite key for duplicate detection
 * Format: "YYYY-MM-DD_amount_payee"
 * 
 * @param transaction - The transaction to create a key for
 * @returns The composite key string
 */
function createCompositeKey(transaction: Transaction): string {
  const dateStr = transaction.date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amount = transaction.amount.toFixed(2);
  const payee = transaction.payee.toLowerCase().trim();
  return `${dateStr}_${amount}_${payee}`;
}

/**
 * Imports new transactions into the database
 * 
 * - Performs batch insert using bulkAdd for performance
 * - Creates an import history record
 * - Returns import statistics
 * 
 * @param transactions - Array of new transactions to import
 * @param fileName - Name of the imported file
 * @param totalCount - Total number of transactions in the file
 * @param duplicateCount - Number of duplicate transactions skipped
 * @returns Promise resolving to import result with statistics
 */
export async function importTransactions(
  transactions: Transaction[],
  fileName: string,
  totalCount: number,
  duplicateCount: number
): Promise<ImportResult> {
  try {
    // Create import record
    const importRecord: ImportRecord = {
      id: uuidv4(),
      fileName: fileName,
      importDate: new Date(),
      transactionCount: totalCount,
      newCount: transactions.length,
      duplicateCount: duplicateCount,
    };

    // Perform batch operations in a transaction for consistency
    await db.transaction('rw', db.transactions, db.importHistory, async () => {
      // Bulk insert transactions
      if (transactions.length > 0) {
        await db.transactions.bulkAdd(transactions);
      }

      // Add import history record
      await db.importHistory.add(importRecord);
    });

    return {
      success: true,
      newCount: transactions.length,
      duplicateCount: duplicateCount,
      importRecordId: importRecord.id,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      newCount: 0,
      duplicateCount: 0,
      importRecordId: '',
    };
  }
}
