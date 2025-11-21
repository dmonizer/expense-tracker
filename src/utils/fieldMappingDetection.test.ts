import {describe, expect, it} from '@jest/globals';
import {detectFieldMapping} from './fieldMappingDetection';

describe('detectFieldMapping', () => {
    it('returns date mapping for date-related headers', () => {
        const result = detectFieldMapping('kuupäev');
        expect(result).toEqual({
            targetField: 'date',
            transform: { type: 'date', dateFormat: 'dd.MM.yyyy' },
        });
    });

    it('returns amount mapping for amount-related headers', () => {
        const result = detectFieldMapping('summa');
        expect(result).toEqual({
            targetField: 'amount',
            transform: { type: 'number', decimalSeparator: ',', thousandsSeparator: '' },
        });
    });

    it('returns payee mapping for payee-related headers', () => {
        const result = detectFieldMapping('saaja');
        expect(result).toEqual({
            targetField: 'payee',
            transform: {},
        });
    });

    it('returns payeeAccountNumber mapping for payee account-related headers', () => {
        const result = detectFieldMapping('saaja konto');
        expect(result).toEqual({
            targetField: 'payeeAccountNumber',
            transform: {},
        });
    });

    it('returns ignore mapping for unknown headers', () => {
        const result = detectFieldMapping('unknown header');
        expect(result).toEqual({
            targetField: 'ignore',
            transform: {},
        });
    });

    it('returns correct mapping for headers with mixed case', () => {
        const result = detectFieldMapping('KuUpÄeV');
        expect(result).toEqual({
            targetField: 'date',
            transform: { type: 'date', dateFormat: 'dd.MM.yyyy' },
        });
    });

    it('returns accountNumber mapping for client account headers', () => {
        const result = detectFieldMapping('kliendi konto');
        expect(result).toEqual({
            targetField: 'accountNumber',
            transform: {},
        });
    });

    it('returns transactionType mapping for transaction type headers', () => {
        const result = detectFieldMapping('tehingu tüüp');
        expect(result).toEqual({
            targetField: 'transactionType',
            transform: {},
        });
    });

    it('returns fee mapping for banking fee headers', () => {
        const result = detectFieldMapping('teenustasu');
        expect(result).toEqual({
            targetField: 'fee',
            transform: { type: 'number', decimalSeparator: ',', thousandsSeparator: '' },
        });
    });

    it('returns symbol mapping for investment account headers', () => {
        const result = detectFieldMapping('isin');
        expect(result).toEqual({
            targetField: 'symbol',
            transform: {},
        });
    });
});
