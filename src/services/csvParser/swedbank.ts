import Papa from 'papaparse';
import {v4 as uuidv4} from 'uuid';
import {parse} from 'date-fns';
import type {SwedBankCSVRow, Transaction} from '@/types';
import type {ParseResult} from './types';
import {parseEstonianNumber} from './transformers';

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
