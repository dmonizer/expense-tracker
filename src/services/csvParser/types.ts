/**
 * Type definitions for CSV parsing
 */

export interface ParseError {
    rowNumber: number;
    message: string;
    rawData: string;
}

export interface ParseResult {
    transactions: Transaction[];
    errors: string[];
    errorDetails?: ParseError[];
    totalRows: number;
}

export interface DuplicateCheckResult {
    newTransactions: Transaction[];
    duplicateTransactions: Transaction[];
}

export interface ImportResult {
    success: boolean;
    newCount: number;
    duplicateCount: number;
    importRecordId: string;
}

import type {Transaction} from '../../types';
