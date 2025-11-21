// Import Format Types
export type TransactionField =
    | 'accountNumber'
    | 'payeeAccountNumber'
    | 'date'
    | 'payee'
    | 'description'
    | 'amount'
    | 'currency'
    | 'type'
    | 'transactionType'
    | 'archiveId'
    | 'symbol'
    | 'quantity'
    | 'price'
    | 'fee'
    | 'securityName'
    | 'ignore'; // For columns we want to skip

export interface FieldTransform {
    type: 'date' | 'number' | 'currency' | 'debitCredit' | 'custom';

    // Date transform
    dateFormat?: string; // 'dd.MM.yyyy', 'MM/dd/yyyy', etc.

    // Number transform
    decimalSeparator?: '.' | ',';
    thousandsSeparator?: '.' | ',' | ' ' | '';

    // Debit/Credit transform
    debitValue?: string; // What represents debit (e.g., 'D', '-', 'out')
    creditValue?: string; // What represents credit (e.g., 'K', '+', 'in')

    // Custom transform (JavaScript expression)
    customExpression?: string; // e.g., "value.toUpperCase()"
}

export interface FieldMapping {
    targetField: TransactionField; // What field in our Transaction type
    sourceType: 'column' | 'static'; // Whether to map from column or use static value
    sourceColumn?: string | number; // Column name or index (for 'column' type)
    staticValue?: string; // Static value to use (for 'static' type)
    transform?: FieldTransform; // Optional transformation
    required: boolean;
    defaultValue?: string; // Use if column is missing
}

export interface CSVSettings {
    delimiter: string; // ';', ',', '	'
    hasHeader: boolean;
    encoding: string; // 'utf-8', 'windows-1252', etc.
    skipEmptyLines: boolean;
    skipRows?: number; // Number of rows to skip at start
}

export interface DetectionPattern {
    headerPattern?: string[]; // Match header columns
    sampleRowPattern?: string; // Regex for first data row
    fileNamePattern?: string; // Regex for filename
}

export interface ImportFormatDefinition {
    id: string;
    name: string;
    description?: string;
    fileType: 'csv' | 'xml'; // Start with CSV, XML later

    // CSV-specific settings
    csvSettings?: CSVSettings;

    // Field mappings
    fieldMappings: FieldMapping[];

    // Detection pattern (for auto-detection)
    detectionPattern?: DetectionPattern;

    // Metadata
    isBuiltIn: boolean; // true for Swedbank (non-editable)
    isDefault: boolean; // Use as default if no format detected
    createdAt: Date;
    updatedAt: Date;
}
