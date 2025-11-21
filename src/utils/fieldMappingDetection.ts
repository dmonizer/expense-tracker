import type {CSVSettings, FieldMapping, FieldTransform, TransactionField} from "@/types";
import {
    ACCOUNT_FIELDS,
    AMOUNT_FIELDS,
    BANKINGFEE_FIELDS,
    CURRENCY_FIELDS,
    DATE_FIELDS,
    DEBITCREDIT_FIELDS,
    DESCRIPTION_FIELDS,
    PAYEE_FIELDS,
    TRANSACTION_FIELDS
} from "@/constants";

export function notIn(haystack: string | string[], needles: string[]): boolean {
    return !isIn(haystack, needles);
}

export function isIn(haystack: string | string[], needles: string[]): boolean {
    if (Array.isArray(haystack)) {
        return haystack.some(h => needles.some(keyword => h.includes(keyword)));
    } else
        return needles.some(keyword => haystack.includes(keyword));
}

const QUANTITY_FIELDS = ['quantity', 'shares', 'kogus', 'nominaalväärtus'];

const SECURITYNAME_FIELDS = ['security', 'instrument', 'väärtpaber'];

const INVESTMENTSYMBOL_FIELDS = ['symbol', 'isin', 'ticker'];

const TRANSACTIONTYPE_FIELDS = ['transaction type', 'tehingu tüüp', 'type'];

const ARCHIVINGID_FIELDS = ['archive', 'arhiveerimistunnus', 'reference'];

const PRICE_FIELDS = ['price', 'hind', 'kurs'];

export function detectFieldMapping(headerField: string) {
    let targetField: TransactionField | null;
    let transform: FieldTransform | undefined

    const headerFieldLower = headerField.toLowerCase().trim();

    // Date detection && Value date detection (alternative to regular date, common in investment accounts)
    if (isIn(headerFieldLower, DATE_FIELDS) || isIn(headerFieldLower, ['väärtuspäev', 'value date'])) {
        return {
            targetField: 'date',
            transform: {
                type: 'date',
                dateFormat: 'dd.MM.yyyy', // Default Estonian format
            }
        };
    }
    // Amount detection
    if (isIn(headerFieldLower, AMOUNT_FIELDS)) {
        return {
            targetField: 'amount',
            transform: {
                type: 'number',
                decimalSeparator: ',',
                thousandsSeparator: '',
            }
        };
    }
    // Payee detection
if (isIn(headerFieldLower, PAYEE_FIELDS) && isIn(headerFieldLower, ACCOUNT_FIELDS)) {
            return {targetField: 'payeeAccountNumber', transform: {}};
        }

        if (isIn(headerFieldLower, PAYEE_FIELDS)) {
            return {targetField: 'payee', transform: {}};
        }

        if (
            (isIn(headerFieldLower, ['kliendi konto', 'account']) &&
            !isIn(headerFieldLower, ['payee', 'recipient'])) ||
            headerFieldLower.includes('iban')
        ) {
            return {targetField: 'accountNumber', transform: {}};
        }
    // Description detection
    else if (isIn(headerFieldLower, DESCRIPTION_FIELDS)) {
        return {targetField: 'description', transform: {}}
    }
    // Currency detection
    else if (isIn(headerFieldLower, CURRENCY_FIELDS)) {
        return {targetField: 'currency', transform: {}}
    }
    // Type detection
    else if (isIn(headerFieldLower, DEBITCREDIT_FIELDS)) {
        return {
            targetField: 'type',
            transform: {
                "type": 'debitCredit',
                "debitValue": 'D',
                "creditValue": 'K',
            }
        }
    }
    // Account Number detection (client's own account)

    // Archive ID detection
    else if (isIn(headerFieldLower, ARCHIVINGID_FIELDS)) {
        return {targetField: 'archiveId', transform: {}}
    }
    // Transaction Type detection
    else if (isIn(headerFieldLower, TRANSACTIONTYPE_FIELDS)) {
        return {targetField: 'transactionType', transform: {}}
    }
    // Symbol / ISIN detection (investment accounts)
    else if (isIn(headerFieldLower, INVESTMENTSYMBOL_FIELDS)) {
        return {targetField: 'symbol', transform: {}}
    }
    // Security Name detection (investment accounts)
    else if (isIn(headerFieldLower, SECURITYNAME_FIELDS)) {
        targetField = 'securityName';
        return {targetField, transform: {}}
    }
    // Quantity detection (investment accounts)
    else if (isIn(headerFieldLower, QUANTITY_FIELDS)) {
        targetField = 'quantity';
        transform = {
            type: 'number',
            decimalSeparator: ',',
            thousandsSeparator: '',
        };
        return {targetField, transform}
    }
    // Price detection (investment accounts)
    else if (isIn(headerFieldLower, PRICE_FIELDS)) {
        targetField = 'price';
        transform = {
            type: 'number',
            decimalSeparator: ',',
            thousandsSeparator: '',
        };
        return {targetField, transform}
    }
    // Fee/Commission detection (investment accounts)
    else if (isIn(headerFieldLower, BANKINGFEE_FIELDS)) {
        targetField = 'fee';
        transform = {
            type: 'number',
            decimalSeparator: ',',
            thousandsSeparator: '',
        };
        return {targetField, transform}
    }
    // Default to ignore
    else {
        targetField = 'ignore';
        return {targetField, transform: {}}
    }
}

export function autoDetectMappings(headers: string[], csvSettings: CSVSettings): FieldMapping[] {
    const detected: FieldMapping[] = [];

    for (const [index, header] of headers.entries()) {
        const {targetField, transform} = detectFieldMapping(header) as {
            targetField: TransactionField;
            transform: FieldTransform | undefined;
        }

        detected.push({
            targetField,
            sourceType: 'column',
            sourceColumn: csvSettings.hasHeader ? header : index,
            transform,
            required: TRANSACTION_FIELDS.find(f => f.value === targetField)?.required || false,
        });
    }

    return detected;
}

