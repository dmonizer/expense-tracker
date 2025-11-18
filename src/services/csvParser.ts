import Papa from 'papaparse';
import {v4 as uuidv4} from 'uuid';
import {parse} from 'date-fns';
import {db} from './db';
import type {
    CategoryRule,
    FieldMapping,
    FieldTransform,
    ImportFormatDefinition,
    ImportRecord,
    SwedBankCSVRow,
    Transaction,
} from '../types';
import {createJournalEntryFromTransaction} from './journalEntryManager';
import {initializeDefaultAccounts} from './accountManager';
import {logger} from '../utils';

/**
 * Detailed error information for CSV parsing
 */
export interface ParseError {
    rowNumber: number;
    message: string;
    rawData: string; // The actual row data
}

/**
 * Result of CSV parsing operation
 */
export interface ParseResult {
    transactions: Transaction[];
    errors: string[]; // Simple error messages (for backward compatibility)
    errorDetails?: ParseError[]; // Detailed errors with row data
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
 * Apply field transformation to a value
 */
function applyTransform(value: string, transform?: FieldTransform): string | number | Date {
    if (!transform) {
        return value;
    }

    function transformDate(dateFormat?:string) {

        if (!dateFormat) {
            throw new Error('Date transform requires dateFormat');
        }
        try {
            const parsed = parse(value, dateFormat, new Date());
            if (isNaN(parsed.getTime())) {
                throw new TypeError(`Invalid date: ${value}`);
            }
            return parsed;
        } catch (error) {
            throw new Error(`Date parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    function transformNumber(transform:FieldTransform) {
        let cleaned = value;

        // Remove thousands separator if present
        if (transform.thousandsSeparator) {
            cleaned = cleaned.replaceAll(new RegExp(`\\${transform.thousandsSeparator}`, 'g'), '');
        }

        // Replace decimal separator with dot
        if (transform.decimalSeparator === ',') {
            cleaned = cleaned.replace(',', '.');
        }

        const parsed = Number.parseFloat(cleaned);
        if (Number.isNaN(parsed)) {
            throw new TypeError(`Invalid number: ${value}`);
        }
        return parsed;
    }

    function transformCreditDebit(transform:FieldTransform) {
        if (value === transform.debitValue) {
            return 'debit';
        } else if (value === transform.creditValue) {
            return 'credit';
        } else {
            throw new Error(`Unknown debit/credit value: ${value}`);
        }
    }

    function transformCustom(transform:FieldTransform) {
        // Execute custom JavaScript expression
        // Security note: This is dangerous in production, consider removing or sandboxing
        if (transform.customExpression) {
            try {
                const fn = new Function('value', `return ${transform.customExpression}`);
                return fn(value);
            } catch (error) {
                throw new Error(`Custom transform error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return value;
    }

    switch (transform.type) {
        case 'date': {
            return transformDate(transform.dateFormat);
        }

        case 'number': {
            return transformNumber(transform);
        }

        case 'debitCredit': {
            return transformCreditDebit(transform);
        }

        case 'currency': {
            return value.toUpperCase().trim();
        }

        case 'custom': {
            return transformCustom(transform);
        }

        default:
            return value;
    }
}

/**
 * Parse CSV file using custom format definition
 */
// ============================================
// Helper Functions - Field Mapping
// ============================================

/**
 * Get value from a CSV row using column identifier (name or index)
 */
function getRowValue(row: unknown, sourceColumn: string | number): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any)[sourceColumn];
}

/**
 * Apply a single field mapping from a column to a transaction
 */
function applyColumnMapping(
  transaction: Partial<Transaction>,
  row: unknown,
  mapping: FieldMapping
): void {
  if (mapping.targetField === 'ignore' || mapping.sourceColumn === undefined) {
    return;
  }

  // Get value from source column
  let value = getRowValue(row, mapping.sourceColumn);

  // Use default value if missing
  if (value === undefined || value === null || value === '') {
    if (mapping.defaultValue !== undefined) {
      value = mapping.defaultValue;
    } else if (mapping.required) {
      throw new Error(`Required field "${mapping.targetField}" is missing`);
    } else {
      return;
    }
  }

  // Apply transformation
  try {
    const transformed = applyTransform(value, mapping.transform);

    // Handle fields that can be summed (e.g., multiple fee columns)
    if (mapping.targetField === 'fee') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (transaction as any)[mapping.targetField] || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transaction as any)[mapping.targetField] = existing + (typeof transformed === 'number' ? transformed : 0);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transaction as any)[mapping.targetField] = transformed;
    }
  } catch (error) {
    throw new Error(
      `Field "${mapping.targetField}": ${error instanceof Error ? error.message : 'Transform error'}`
    );
  }
}

/**
 * Apply a static field mapping to a transaction
 */
function applyStaticMapping(
  transaction: Partial<Transaction>,
  mapping: FieldMapping
): void {
  if (mapping.targetField === 'ignore' || !mapping.staticValue) {
    return;
  }

  try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (transaction as any)[mapping.targetField] = applyTransform(mapping.staticValue, mapping.transform);
  } catch (error) {
    throw new Error(
      `Static field "${mapping.targetField}": ${error instanceof Error ? error.message : 'Transform error'}`
    );
  }
}

/**
 * Apply all field mappings to a transaction
 */
function applyFieldMappings(
  transaction: Partial<Transaction>,
  row: unknown,
  fieldMappings: FieldMapping[]
): void {
  // Separate column mappings from static mappings
  const columnMappings = fieldMappings.filter(m => !m.sourceType || m.sourceType === 'column');
  const staticMappings = fieldMappings.filter(m => m.sourceType === 'static');

  // Apply column field mappings
  columnMappings.forEach(mapping => {
    applyColumnMapping(transaction, row, mapping);
  });

  // Apply static field mappings
  staticMappings.forEach(mapping => {
    applyStaticMapping(transaction, mapping);
  });
}

// ============================================
// Helper Functions - Investment Transactions
// ============================================

/**
 * Detect if a transaction is an investment transaction
 */
function isInvestmentTransaction(transaction: Partial<Transaction>): boolean {
  return transaction.quantity !== undefined ||
    transaction.price !== undefined ||
    transaction.symbol !== undefined;
}

/**
 * Apply smart defaults for investment transactions
 */
function applyInvestmentDefaults(transaction: Partial<Transaction>): void {
  if (!transaction.currency) transaction.currency = 'EUR';
  if (!transaction.type) transaction.type = 'debit';
  if (!transaction.payee) {
    transaction.payee = transaction.securityName || transaction.symbol || 'Investment';
  }
  if (!transaction.description) {
    const desc = [];
    if (transaction.quantity) desc.push(`${transaction.quantity} units`);
    if (transaction.symbol) desc.push(transaction.symbol);
    transaction.description = desc.length > 0 ? desc.join(' - ') : 'Investment transaction';
  }
}

// ============================================
// Helper Functions - Validation
// ============================================

/**
 * Validate required fields for a transaction
 */
function validateRequiredFields(transaction: Partial<Transaction>, isInvestment: boolean): void {
  // Common required fields
  if (!transaction.date) throw new Error('Missing date');
  if (transaction.amount === undefined) throw new Error('Missing amount');

  // Investment transactions have relaxed requirements
  if (isInvestment) {
    return;
  }

  // Regular transaction - all fields required
  if (!transaction.currency) throw new Error('Missing currency');
  if (!transaction.type) throw new Error('Missing type');
  if (!transaction.payee) throw new Error('Missing payee');
  if (!transaction.description) throw new Error('Missing description');
}

/**
 * Apply default values for optional fields
 */
function applyDefaultFields(transaction: Partial<Transaction>, isInvestment: boolean): void {
  if (!transaction.accountNumber) transaction.accountNumber = 'Unknown';
  if (!transaction.transactionType) {
    transaction.transactionType = isInvestment ? 'Investment' : 'Unknown';
  }
  if (!transaction.archiveId) {
    transaction.archiveId = `${transaction.date!.getTime()}-${transaction.amount}`;
  }
}

// ============================================
// Helper Functions - Row Processing
// ============================================

/**
 * Process a single CSV row into a transaction
 */
function processRow(
  row: unknown,
  format: ImportFormatDefinition
): Transaction {
  const transaction: Partial<Transaction> = {
    id: uuidv4(),
    imported: new Date(),
    manuallyEdited: false,
  };

  // Apply all field mappings
  applyFieldMappings(transaction, row, format.fieldMappings);

  // Detect investment transaction
  const isInvestment = isInvestmentTransaction(transaction);

  // Apply smart defaults for investment transactions
  if (isInvestment) {
    applyInvestmentDefaults(transaction);
  }

  // Validate required fields
  validateRequiredFields(transaction, isInvestment);

  // Apply defaults for optional fields
  applyDefaultFields(transaction, isInvestment);

  return transaction as Transaction;
}

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
        // Initialize default accounts if they don't exist
        await initializeDefaultAccounts();

        // Create import record
        const importRecord: ImportRecord = {
            id: uuidv4(),
            fileName: fileName,
            importDate: new Date(),
            transactionCount: totalCount,
            newCount: transactions.length,
            duplicateCount: duplicateCount,
        };

        // Get all category rules once for efficient lookup
        const categoryRules = await db.categoryRules.toArray();
        const categoryRuleMap = new Map<string, CategoryRule>();
        categoryRules.forEach(rule => {
            categoryRuleMap.set(rule.name, rule);
        });

        // Perform batch operations in a transaction for consistency
        // Phase 1: DUAL-WRITE - Create both old Transaction and new JournalEntry
        await db.transaction(
            'rw',
            db.transactions,
            db.importHistory,
            async () => {
                // Bulk insert transactions (OLD FORMAT - backward compatibility)
                if (transactions.length > 0) {
                    await db.transactions.bulkAdd(transactions);
                }

                // Add import history record
                await db.importHistory.add(importRecord);
            }
        );

        // Create journal entries (NEW FORMAT - double-entry accounting)
        // This is done outside the main transaction because createJournalEntryFromTransaction
        // handles its own database operations and transactions
        for (const transaction of transactions) {
            // Find the category rule if transaction is categorized
            const categoryRule = transaction.category
                ? categoryRuleMap.get(transaction.category)
                : undefined;

            // Create journal entry with proper double-entry splits
            await createJournalEntryFromTransaction(transaction, categoryRule);
        }

        return {
            success: true,
            newCount: transactions.length,
            duplicateCount: duplicateCount,
            importRecordId: importRecord.id,
        };
    } catch (error) {
        logger.error('Import error:', error);
        return {
            success: false,
            newCount: 0,
            duplicateCount: 0,
            importRecordId: '',
        };
    }
}
