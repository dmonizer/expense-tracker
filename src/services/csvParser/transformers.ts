import type {FieldTransform} from '@/types';
import {parse} from 'date-fns';

/**
 * Apply field transformation to a value
 */
export function applyTransform(value: string, transform?: FieldTransform): string | number | Date {
    if (!transform) {
        return value;
    }

    switch (transform.type) {
        case 'date':
            return transformDate(value, transform.dateFormat);
        case 'number':
            return transformNumber(value, transform);
        case 'debitCredit':
            return transformCreditDebit(value, transform);
        case 'currency':
            return value.toUpperCase().trim();
        case 'custom':
            return transformCustom(value, transform);
        default:
            return value;
    }
}

function transformDate(value: string, dateFormat?: string): Date {
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

function transformNumber(value: string, transform: FieldTransform): number {
    let cleaned = value;

    // Remove thousands separator if present
    if (transform.thousandsSeparator) {
        cleaned = cleaned.replaceAll(new RegExp(`\\\\${transform.thousandsSeparator}`, 'g'), '');
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

function transformCreditDebit(value: string, transform: FieldTransform): string {
    if (value === transform.debitValue) {
        return 'debit';
    } else if (value === transform.creditValue) {
        return 'credit';
    } else {
        throw new Error(`Unknown debit/credit value: ${value}`);
    }
}

function transformCustom(value: string, transform: FieldTransform): string | number | Date {
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

/**
 * Converts Estonian number format to JavaScript number
 * Examples: "1,23" → 1.23, "1234,56" → 1234.56, "1 234,56" → 1234.56
 */
export function parseEstonianNumber(value: string): number {
    const cleaned = value.replace(/\s/g, '');
    const normalized = cleaned.replace(',', '.');
    return parseFloat(normalized);
}
