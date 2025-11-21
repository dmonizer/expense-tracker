import {beforeEach, describe, expect, it} from '@jest/globals';
import {detectDuplicates, importTransactions, parseSwedBankCSV} from './csvParser';
import {db} from './db';
import {getOrCreateBankAccount} from './accountManager';
import * as fs from 'fs';
import * as path from 'path';

describe('Multi-Currency Import Test', () => {
    beforeEach(async () => {
        // Clean database
        await db.delete();
        await db.open();
    });

    it('should import multi-currency transactions and update account supported currencies', async () => {
        // Read the multi-currency fixture
        const fixturePath = path.join(__dirname, '__fixtures__', 'multi_currency_swedbank.csv');
        const csvContent = fs.readFileSync(fixturePath, 'utf-8');

        // Create a File object from the CSV content
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const file = new File([blob], 'multi_currency_swedbank.csv', { type: 'text/csv' });

        // Parse the CSV
        const parseResult = await parseSwedBankCSV(file);

        expect(parseResult.errors).toHaveLength(0);
        expect(parseResult.transactions.length).toBeGreaterThan(0);

        // Verify we have transactions in different currencies
        const currencies = new Set(parseResult.transactions.map(t => t.currency));
        expect(currencies.has('EUR')).toBe(true);
        expect(currencies.has('USD')).toBe(true);
        expect(currencies.has('GBP')).toBe(true);
        expect(currencies.has('SEK')).toBe(true);

        // Check for duplicates (should be none on first import)
        const duplicateCheck = await detectDuplicates(parseResult.transactions);
        expect(duplicateCheck.duplicateTransactions).toHaveLength(0);
        expect(duplicateCheck.newTransactions.length).toBe(parseResult.transactions.length);

        // Import the transactions
        const importResult = await importTransactions(
            duplicateCheck.newTransactions,
            'multi_currency_swedbank.csv',
            parseResult.totalRows,
            duplicateCheck.duplicateTransactions.length
        );

        expect(importResult.success).toBe(true);
        expect(importResult.newCount).toBe(parseResult.transactions.length);

        // Get the bank account that was created/updated
        const accountNumber = parseResult.transactions[0].accountNumber;
        const account = await getOrCreateBankAccount(accountNumber);

        // Verify the account now supports all currencies from the transactions
        expect(account.supportedCurrencies).toBeDefined();
        expect(account.supportedCurrencies).toContain('EUR');
        expect(account.supportedCurrencies).toContain('USD');
        expect(account.supportedCurrencies).toContain('GBP');
        expect(account.supportedCurrencies).toContain('SEK');

        // Verify journal entries were created
        const journalEntries = await db.journalEntries.toArray();
        expect(journalEntries.length).toBe(parseResult.transactions.length);

        // Verify splits were created with correct currencies
        const splits = await db.splits.toArray();
        expect(splits.length).toBeGreaterThan(0);

        // Each transaction creates 2 splits (bank account + expense/income account)
        expect(splits.length).toBe(parseResult.transactions.length * 2);

        // Verify that splits maintain their original currencies
        const splitCurrencies = new Set(splits.map(s => s.currency));
        expect(splitCurrencies.has('EUR')).toBe(true);
        expect(splitCurrencies.has('USD')).toBe(true);
        expect(splitCurrencies.has('GBP')).toBe(true);
        expect(splitCurrencies.has('SEK')).toBe(true);
    });

    it('should not create duplicate transactions on re-import', async () => {
        // Read the multi-currency fixture
        const fixturePath = path.join(__dirname, '__fixtures__', 'multi_currency_swedbank.csv');
        const csvContent = fs.readFileSync(fixturePath, 'utf-8');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const file = new File([blob], 'multi_currency_swedbank.csv', { type: 'text/csv' });

        // First import
        const parseResult1 = await parseSwedBankCSV(file);
        const duplicateCheck1 = await detectDuplicates(parseResult1.transactions);
        await importTransactions(
            duplicateCheck1.newTransactions,
            'multi_currency_swedbank.csv',
            parseResult1.totalRows,
            0
        );

        // Second import (same file)
        const parseResult2 = await parseSwedBankCSV(file);
        const duplicateCheck2 = await detectDuplicates(parseResult2.transactions);

        // All transactions should be detected as duplicates
        expect(duplicateCheck2.duplicateTransactions.length).toBe(parseResult2.transactions.length);
        expect(duplicateCheck2.newTransactions.length).toBe(0);
    });
});
