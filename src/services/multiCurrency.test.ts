import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateAccountBalance, createJournalEntryFromTransaction } from './journalEntryManager';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { Account, Transaction } from '../types';

describe('Multi-Currency Support', () => {
    beforeEach(async () => {
        await db.delete();
        await db.open();
    });

    it('should calculate balances for multiple currencies', async () => {
        // Create an account
        const accountId = uuidv4();
        const account: Account = {
            id: accountId,
            name: 'Test Account',
            type: 'asset',
            currency: 'EUR',
            supportedCurrencies: ['EUR', 'USD'],
            isActive: true,
            isSystem: false,
            openingBalance: 100,
            openingBalanceDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.accounts.add(account);

        // Create a transaction in EUR (primary)
        const txEur: Transaction = {
            id: uuidv4(),
            accountNumber: '123',
            date: new Date(),
            payee: 'Test Payee EUR',
            description: 'Test EUR',
            amount: 50,
            currency: 'EUR',
            type: 'debit', // Money out
            manuallyEdited: false,
            transactionType: 'payment',
            archiveId: '1',
            imported: new Date(),
        };

        // Create a transaction in USD (secondary)
        const txUsd: Transaction = {
            id: uuidv4(),
            accountNumber: '123',
            date: new Date(),
            payee: 'Test Payee USD',
            description: 'Test USD',
            amount: 20,
            currency: 'USD',
            type: 'credit', // Money in
            manuallyEdited: false,
            transactionType: 'payment',
            archiveId: '2',
            imported: new Date(),
        };

        // Create journal entries
        // Note: We need to mock getOrCreateBankAccount to return our account
        // But since we can't easily mock internal functions here without more setup,
        // we'll manually create splits to test calculateAccountBalance directly.

        // Manually create splits for testing calculateAccountBalance
        await db.splits.bulkAdd([
            {
                id: uuidv4(),
                journalEntryId: uuidv4(),
                accountId: accountId,
                amount: -50, // Debit transaction = credit to asset account (negative)
                currency: 'EUR',
                reconciled: false,
            },
            {
                id: uuidv4(),
                journalEntryId: uuidv4(),
                accountId: accountId,
                amount: 20, // Credit transaction = debit to asset account (positive)
                currency: 'USD',
                reconciled: false,
            }
        ]);

        // Calculate balance
        const result = await calculateAccountBalance(accountId, new Date());

        expect(result.currency).toBe('EUR');
        expect(result.balance).toBe(50); // 100 (opening) - 50 = 50
        expect(result.balances['EUR']).toBe(50);
        expect(result.balances['USD']).toBe(20);
    });

    it('should automatically add new currency to supported currencies', async () => {
        // Create an account with only EUR
        const accountId = uuidv4();
        const accountNumber = 'TEST_IBAN_123';
        const account: Account = {
            id: accountId,
            name: 'Test Bank Account',
            type: 'asset',
            currency: 'EUR',
            supportedCurrencies: ['EUR'],
            accountNumber: accountNumber,
            isActive: true,
            isSystem: false,
            openingBalance: 0,
            openingBalanceDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.accounts.add(account);

        // Create a transaction in GBP
        const txGbp: Transaction = {
            id: uuidv4(),
            accountNumber: accountNumber,
            date: new Date(),
            payee: 'London Shop',
            description: 'Tea',
            amount: 10,
            currency: 'GBP',
            type: 'debit',
            manuallyEdited: false,
            transactionType: 'payment',
            archiveId: '3',
            imported: new Date(),
        };

        // This function calls getOrCreateBankAccount which looks up by account number
        await createJournalEntryFromTransaction(txGbp);

        // Verify account was updated
        const updatedAccount = await db.accounts.get(accountId);
        expect(updatedAccount).toBeDefined();
        expect(updatedAccount?.supportedCurrencies).toContain('GBP');
        expect(updatedAccount?.supportedCurrencies).toHaveLength(2); // EUR + GBP
    });
});
