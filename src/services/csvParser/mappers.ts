import { v4 as uuidv4 } from 'uuid';
import type { FieldMapping, ImportFormatDefinition, Transaction } from '../../types';
import { applyTransform } from './transformers';
import {
    isInvestmentTransaction,
    applyInvestmentDefaults,
    validateRequiredFields,
    applyDefaultFields
} from './validators';

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
            `Target field "${mapping.targetField}", source column: "${mapping.sourceColumn}": ${error instanceof Error ? error.message : 'Transform error'}`
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

/**
 * Process a single CSV row into a transaction
 */
export function processRow(
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
