import type {TransactionField} from "@/types";

export const TRANSACTION_FIELDS: Array<{ value: TransactionField; label: string; required: boolean }> = [
    {value: 'date', label: 'Date', required: true},
    {value: 'amount', label: 'Amount', required: true},
    {value: 'payee', label: 'Payee / Recipient', required: true},
    {value: 'description', label: 'Description', required: true},
    {value: 'currency', label: 'Currency', required: true},
    {value: 'type', label: 'Debit/Credit', required: true},
    {value: 'accountNumber', label: 'Account Number', required: false},
    {value: 'payeeAccountNumber', label: 'Payee Account Number', required: false},
    {value: 'transactionType', label: 'Transaction Type', required: false},
    {value: 'archiveId', label: 'Archive ID (for deduplication)', required: false},
    {value: 'symbol', label: 'Security Symbol / ISIN', required: false},
    {value: 'securityName', label: 'Security Name', required: false},
    {value: 'quantity', label: 'Quantity / Shares', required: false},
    {value: 'price', label: 'Price per Share', required: false},
    {value: 'fee', label: 'Fee / Commission', required: false},
    {value: 'ignore', label: '(Ignore this column)', required: false},
];

export const DATE_FIELDS = ['date', 'kuupäev', 'datum'];
export const AMOUNT_FIELDS = ['amount', 'summa', 'betrag'];
export const PAYEE_FIELDS = ['payee', 'saaja', 'maksja', 'recipient'];

export const DESCRIPTION_FIELDS = ['description', 'selgitus', 'memo', 'details'];
export const CURRENCY_FIELDS = ['currency', 'valuuta', 'währung'];
export const DEBITCREDIT_FIELDS = ['deebet', 'kreedit', 'debit', 'credit'];
export const ACCOUNT_FIELDS = ['konto', 'account', 'iban'];
export const BANKINGFEE_FIELDS = ['fee', 'commission', 'tasu', 'teenustasu', 'komisjon'];

export const INVESTMENT_FIELDS = ['quantity', 'price', 'symbol', 'securityName'];
export const INVESTMENT_NONVALIDATED_FIELDS = ['payee', 'description', 'currency', 'type'];


