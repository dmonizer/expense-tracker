import {useEffect, useState} from 'react';
import type {CSVSettings, FieldMapping, FieldTransform, TransactionField} from '../../../types';
import type {WizardState} from './FormatWizardMain';

interface Step2Props {
    csvSettings: CSVSettings;
    parsedPreview: {
        headers: string[];
        rows: string[][];
    };
    initialMappings: FieldMapping[];
    onComplete: (data: Partial<WizardState>) => void;
    onBack: () => void;
}

const TRANSACTION_FIELDS: Array<{ value: TransactionField; label: string; required: boolean }> = [
    {value: 'date', label: 'Date', required: true},
    {value: 'amount', label: 'Amount', required: true},
    {value: 'payee', label: 'Payee / Recipient', required: true},
    {value: 'description', label: 'Description', required: true},
    {value: 'currency', label: 'Currency', required: true},
    {value: 'type', label: 'Debit/Credit', required: true},
    {value: 'accountNumber', label: 'Account Number', required: false},
    {value: 'transactionType', label: 'Transaction Type', required: false},
    {value: 'archiveId', label: 'Archive ID (for deduplication)', required: false},
    {value: 'symbol', label: 'Security Symbol / ISIN', required: false},
    {value: 'securityName', label: 'Security Name', required: false},
    {value: 'quantity', label: 'Quantity / Shares', required: false},
    {value: 'price', label: 'Price per Share', required: false},
    {value: 'fee', label: 'Fee / Commission', required: false},
    {value: 'ignore', label: '(Ignore this column)', required: false},
];

export default function Step2FieldMapping({
                                              csvSettings,
                                              parsedPreview,
                                              initialMappings,
                                              onComplete,
                                              onBack
                                          }: Readonly<Step2Props>) {
    const [mappings, setMappings] = useState<FieldMapping[]>(() => {
        // Initialize with existing mappings or auto-detect
        if (initialMappings.length > 0) {
            return initialMappings;
        }
        return autoDetectMappings(parsedPreview.headers);
    });

    const [staticFields, setStaticFields] = useState<FieldMapping[]>(() => {
        // Extract static fields from initial mappings
        if (initialMappings.length > 0) {
            return initialMappings.filter(m => m.sourceType === 'static');
        }
        return [];
    });

    // Filter column mappings from initial mappings (backwards compatibility)
    useEffect(() => {
        if (initialMappings.length > 0) {
            const columnMappings = initialMappings.filter(m => !m.sourceType || m.sourceType === 'column');
            if (columnMappings.length > 0 && columnMappings.length !== mappings.length) {
                setMappings(columnMappings);
            }
        }
    }, []);

    const [selectedMapping, setSelectedMapping] = useState<number | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    useEffect(() => {
        validateMappings();
    }, [mappings]);

    function autoDetectMappings(headers: string[]): FieldMapping[] {
        const detected: FieldMapping[] = [];

        headers.forEach((header, index) => {
            const lowerHeader = header.toLowerCase().trim();
            let targetField: TransactionField | null = null;
            let transform: FieldTransform | undefined;

            // Date detection
            if (lowerHeader.includes('date') || lowerHeader.includes('kuupäev') || lowerHeader.includes('datum')) {
                targetField = 'date';
                transform = {
                    type: 'date',
                    dateFormat: 'dd.MM.yyyy', // Default Estonian format
                };
            }
            // Amount detection
            else if (lowerHeader.includes('amount') || lowerHeader.includes('summa') || lowerHeader.includes('betrag')) {
                targetField = 'amount';
                transform = {
                    type: 'number',
                    decimalSeparator: ',',
                    thousandsSeparator: '',
                };
            }
            // Payee detection
            else if (lowerHeader.includes('payee') || lowerHeader.includes('saaja') || lowerHeader.includes('maksja') || lowerHeader.includes('recipient')) {
                targetField = 'payee';
            }
            // Description detection
            else if (lowerHeader.includes('description') || lowerHeader.includes('selgitus') || lowerHeader.includes('memo') || lowerHeader.includes('details')) {
                targetField = 'description';
            }
            // Currency detection
            else if (lowerHeader.includes('currency') || lowerHeader.includes('valuuta') || lowerHeader.includes('währung')) {
                targetField = 'currency';
            }
            // Type detection
            else if (lowerHeader.includes('deebet') || lowerHeader.includes('kreedit') || lowerHeader.includes('debit') || lowerHeader.includes('credit')) {
                targetField = 'type';
                transform = {
                    type: 'debitCredit',
                    debitValue: 'D',
                    creditValue: 'K',
                };
            }
            // Account Number detection
            else if (lowerHeader.includes('account') || lowerHeader.includes('konto') || lowerHeader.includes('iban')) {
                targetField = 'accountNumber';
            }
            // Archive ID detection
            else if (lowerHeader.includes('archive') || lowerHeader.includes('arhiveerimistunnus') || lowerHeader.includes('reference')) {
                targetField = 'archiveId';
            }
            // Transaction Type detection
            else if (lowerHeader.includes('transaction type') || lowerHeader.includes('tehingu tüüp') || lowerHeader.includes('type')) {
                targetField = 'transactionType';
            }
            // Symbol / ISIN detection (investment accounts)
            else if (lowerHeader.includes('symbol') || lowerHeader.includes('isin') || lowerHeader.includes('ticker')) {
                targetField = 'symbol';
            }
            // Security Name detection (investment accounts)
            else if (lowerHeader.includes('security') || lowerHeader.includes('instrument') || lowerHeader.includes('väärtpaber')) {
                targetField = 'securityName';
            }
            // Quantity detection (investment accounts)
            else if (lowerHeader.includes('quantity') || lowerHeader.includes('shares') || lowerHeader.includes('kogus') || lowerHeader.includes('nominaalväärtus')) {
                targetField = 'quantity';
                transform = {
                    type: 'number',
                    decimalSeparator: ',',
                    thousandsSeparator: '',
                };
            }
            // Price detection (investment accounts)
            else if (lowerHeader.includes('price') || lowerHeader.includes('hind') || lowerHeader.includes('kurs')) {
                targetField = 'price';
                transform = {
                    type: 'number',
                    decimalSeparator: ',',
                    thousandsSeparator: '',
                };
            }
            // Fee/Commission detection (investment accounts)
            else if (lowerHeader.includes('fee') || lowerHeader.includes('commission') || lowerHeader.includes('tasu') || lowerHeader.includes('teenustasu') || lowerHeader.includes('komisjon')) {
                targetField = 'fee';
                transform = {
                    type: 'number',
                    decimalSeparator: ',',
                    thousandsSeparator: '',
                };
            }
            // Value date detection (alternative to regular date, common in investment accounts)
            else if (lowerHeader.includes('väärtuspäev') || lowerHeader.includes('value date')) {
                targetField = 'date';
                transform = {
                    type: 'date',
                    dateFormat: 'dd.MM.yyyy',
                };
            }
            // Default to ignore
            else {
                targetField = 'ignore';
            }

            detected.push({
                targetField,
                sourceType: 'column',
                sourceColumn: csvSettings.hasHeader ? header : index,
                transform,
                required: TRANSACTION_FIELDS.find(f => f.value === targetField)?.required || false,
            });
        });

        return detected;
    }

    function validateMappings(): boolean {
        const errors: string[] = [];
        const fieldCounts = new Map<string, number>();

        // Combine column mappings and static field mappings
        const allMappings = [...mappings, ...staticFields];
        const mappedFields = allMappings
            .filter(m => m.targetField !== 'ignore')
            .map(m => m.targetField);

        // Count how many times each field is mapped
        mappedFields.forEach(field => {
            fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
        });

        // Detect if this is an investment transaction
        const hasInvestmentFields = mappedFields.some(f =>
            ['quantity', 'price', 'symbol', 'securityName'].includes(f)
        );

        // Check for required fields
        const requiredFields = TRANSACTION_FIELDS.filter(f => f.required).map(f => f.value);

        requiredFields.forEach(field => {
            if (!mappedFields.includes(field)) {
                // For investment transactions, relax some requirements
                if (hasInvestmentFields) {
                    // Skip validation for these fields if it's an investment transaction
                    if (['payee', 'description', 'currency', 'type'].includes(field)) {
                        return; // These will be auto-filled with defaults
                    }
                }

                const fieldLabel = TRANSACTION_FIELDS.find(f => f.value === field)?.label;
                errors.push(`Required field "${fieldLabel}" is not mapped`);
            }
        });

        // Check for duplicate mappings (allow some fields to be duplicated)
        const allowMultiple = ['fee']; // Fields that can be summed from multiple columns

        fieldCounts.forEach((count, field) => {
            if (count > 1 && !allowMultiple.includes(field)) {
                const fieldLabel = TRANSACTION_FIELDS.find(f => f.value === field)?.label;
                errors.push(`Field "${fieldLabel}" is mapped multiple times`);
            }
        });

        setValidationErrors(errors);
        return errors.length === 0;
    }

    const handleMappingChange = (index: number, targetField: TransactionField) => {
        const newMappings = [...mappings];
        newMappings[index] = {
            ...newMappings[index],
            targetField,
            required: TRANSACTION_FIELDS.find(f => f.value === targetField)?.required || false,
        };

        // Set default transforms for certain field types
        if (targetField === 'date' && !newMappings[index].transform) {
            newMappings[index].transform = {
                type: 'date',
                dateFormat: 'dd.MM.yyyy',
            };
        } else if ((targetField === 'amount' || targetField === 'quantity' || targetField === 'price' || targetField === 'fee') && !newMappings[index].transform) {
            newMappings[index].transform = {
                type: 'number',
                decimalSeparator: ',',
                thousandsSeparator: '',
            };
        } else if (targetField === 'type' && !newMappings[index].transform) {
            newMappings[index].transform = {
                type: 'debitCredit',
                debitValue: 'D',
                creditValue: 'K',
            };
        }

        setMappings(newMappings);
    };

    const handleTransformChange = (index: number, transform: FieldTransform) => {
        const newMappings = [...mappings];
        newMappings[index] = {
            ...newMappings[index],
            transform,
        };
        setMappings(newMappings);
    };

    const handleAddStaticField = () => {
        // Find first unmapped required field, or default to payee
        const allMappedFields = [...mappings, ...staticFields].map(m => m.targetField);
        const unmappedRequired = TRANSACTION_FIELDS
            .filter(f => f.required && !allMappedFields.includes(f.value))
            .map(f => f.value);

        const defaultField = unmappedRequired[0] || 'payee';

        const newStaticField: FieldMapping = {
            targetField: defaultField,
            sourceType: 'static',
            staticValue: '',
            required: TRANSACTION_FIELDS.find(f => f.value === defaultField)?.required || false,
        };

        setStaticFields([...staticFields, newStaticField]);
    };

    const handleStaticFieldChange = (index: number, field: TransactionField, value: string) => {
        const newStaticFields = [...staticFields];
        newStaticFields[index] = {
            ...newStaticFields[index],
            targetField: field,
            staticValue: value,
            required: TRANSACTION_FIELDS.find(f => f.value === field)?.required || false,
        };
        setStaticFields(newStaticFields);
    };

    const handleRemoveStaticField = (index: number) => {
        setStaticFields(staticFields.filter((_, i) => i !== index));
    };

    const handleNext = () => {
        if (validateMappings()) {
            // Combine column mappings and static fields
            const allMappings = [...mappings, ...staticFields];
            onComplete({fieldMappings: allMappings});
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Step 2: Map CSV Columns to Transaction Fields
                </h3>
                <p className="text-sm text-gray-600">
                    Match each column from your CSV file to the appropriate transaction field.
                </p>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Please fix these issues:</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {validationErrors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Mapping Table */}
            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                            CSV Column
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                            Sample Data
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                            Maps To
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                            Transform
                        </th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {mappings.map((mapping, index) => (
                        <tr
                            key={index}
                            className={`hover:bg-gray-50 ${selectedMapping === index ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedMapping(index)}
                        >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {mapping.sourceColumn === undefined
                                    ? '(Static)'
                                    : (typeof mapping.sourceColumn === 'string'
                                        ? mapping.sourceColumn
                                        : `Column ${mapping.sourceColumn + 1}`)
                                }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                                {parsedPreview.rows[0]?.[index] || <span className="text-gray-400 italic">empty</span>}
                            </td>
                            <td className="px-4 py-3">
                                <select
                                    value={mapping.targetField}
                                    onChange={(e) => handleMappingChange(index, e.target.value as TransactionField)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {TRANSACTION_FIELDS.map(field => (
                                        <option key={field.value} value={field.value}>
                                            {field.label} {field.required ? '*' : ''}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-4 py-3 text-sm">
                                {mapping.targetField === 'date' && mapping.transform?.type === 'date' && (
                                    <input
                                        type="text"
                                        placeholder="dd.MM.yyyy"
                                        value={mapping.transform.dateFormat || ''}
                                        onChange={(e) => handleTransformChange(index, {
                                            ...mapping.transform!,
                                            dateFormat: e.target.value,
                                        })}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                                {(mapping.targetField === 'amount' || mapping.targetField === 'quantity' || mapping.targetField === 'price' || mapping.targetField === 'fee') && mapping.transform?.type === 'number' && (
                                    <div className="flex gap-1">
                                        <select
                                            value={mapping.transform.decimalSeparator || ','}
                                            onChange={(e) => handleTransformChange(index, {
                                                ...mapping.transform!,
                                                decimalSeparator: e.target.value as '.' | ',',
                                            })}
                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            title="Decimal separator"
                                        >
                                            <option value=",">Comma (,)</option>
                                            <option value=".">Dot (.)</option>
                                        </select>
                                        <select
                                            value={mapping.transform.thousandsSeparator || ''}
                                            onChange={(e) => handleTransformChange(index, {
                                                ...mapping.transform!,
                                                thousandsSeparator: e.target.value as '.' | ',' | ' ' | '',
                                            })}
                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            title="Thousands separator"
                                        >
                                            <option value="">None</option>
                                            <option value=",">Comma (,)</option>
                                            <option value=".">Dot (.)</option>
                                            <option value=" ">Space</option>
                                        </select>
                                    </div>
                                )}
                                {mapping.targetField === 'type' && mapping.transform?.type === 'debitCredit' && (
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder="D"
                                            value={mapping.transform.debitValue || ''}
                                            onChange={(e) => handleTransformChange(index, {
                                                ...mapping.transform!,
                                                debitValue: e.target.value,
                                            })}
                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            title="Debit value"
                                        />
                                        <input
                                            type="text"
                                            placeholder="K"
                                            value={mapping.transform.creditValue || ''}
                                            onChange={(e) => handleTransformChange(index, {
                                                ...mapping.transform!,
                                                creditValue: e.target.value,
                                            })}
                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            title="Credit value"
                                        />
                                    </div>
                                )}
                                {!mapping.transform && mapping.targetField !== 'ignore' && (
                                    <span className="text-gray-400 italic text-xs">No transform needed</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Static Fields Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900">Static Fields</h4>
                        <p className="text-xs text-gray-600 mt-1">
                            Add fields with the same value for all transactions (e.g., account number, default payee)
                        </p>
                    </div>
                    <button
                        onClick={handleAddStaticField}
                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
                    >
                        + Add Static Field
                    </button>
                </div>

                {staticFields.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    Field
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                                    Static Value
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {staticFields.map((field, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <select
                                            value={field.targetField}
                                            onChange={(e) => handleStaticFieldChange(index, e.target.value as TransactionField, field.staticValue || '')}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {TRANSACTION_FIELDS.filter(f => f.value !== 'ignore').map(tf => (
                                                <option key={tf.value} value={tf.value}>
                                                    {tf.label} {tf.required ? '*' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            placeholder="Enter static value..."
                                            value={field.staticValue || ''}
                                            onChange={(e) => handleStaticFieldChange(index, field.targetField, e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleRemoveStaticField(index)}
                                            className="text-sm text-red-600 hover:text-red-800"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Fields marked with * are required. Make sure all required fields are mapped
                    before proceeding.
                </p>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Back
                </button>

                <button
                    onClick={handleNext}
                    disabled={validationErrors.length > 0}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Next: Preview Results
                </button>
            </div>
        </div>
    );
}
