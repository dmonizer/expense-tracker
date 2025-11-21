import {Label} from '@/components/ui/label';

interface FieldSelectorGridProps {
  selectedFields: string[];
  onChange: (fields: string[]) => void;
  availableFields?: string[]; // Optional: restrict which fields to show
  disabled?: boolean;
}

interface FieldInfo {
  id: string;
  label: string;
  description: string;
  group: 'identity' | 'financial' | 'technical';
}

const ALL_FIELDS: FieldInfo[] = [
  // Identity fields
  { id: 'payee', label: 'Payee', description: 'Transaction payee/recipient', group: 'identity' },
  { id: 'description', label: 'Description', description: 'Transaction description', group: 'identity' },

  // Financial fields
  { id: 'accountNumber', label: 'Account Number', description: 'Source account', group: 'financial' },
  { id: 'currency', label: 'Currency', description: 'Transaction currency', group: 'financial' },

  // Technical fields
  { id: 'transactionType', label: 'Transaction Type', description: 'Type of transaction', group: 'technical' },
  { id: 'archiveId', label: 'Archive ID', description: 'Reference/archive ID', group: 'technical' },
];

function FieldSelectorGrid({selectedFields, onChange, availableFields, disabled}: Readonly<FieldSelectorGridProps>) {
  const fields = availableFields
    ? ALL_FIELDS.filter(f => availableFields.includes(f.id))
    : ALL_FIELDS;

  const handleToggle = (fieldId: string) => {
    if (disabled) return;

    const newFields = selectedFields.includes(fieldId)
      ? selectedFields.filter(f => f !== fieldId)
      : [...selectedFields, fieldId];

    // Ensure at least one field is selected
    if (newFields.length > 0) {
      onChange(newFields);
    }
  };

  const groupedFields: Record<string, FieldInfo[]> = {
    identity: [],
    financial: [],
    technical: [],
  };

  fields.forEach(field => {
    groupedFields[field.group].push(field);
  });

  const renderGroup = (groupName: string, groupFields: FieldInfo[]) => {
    if (groupFields.length === 0) return null;

    return (
      <div key={groupName} className="mb-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {groupName}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groupFields.map(field => (
            <Label
              key={field.id}
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${selectedFields.includes(field.id)
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedFields.includes(field.id)}
                onChange={() => handleToggle(field.id)}
                disabled={disabled || (selectedFields.includes(field.id) && selectedFields.length === 1)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="ml-3 flex-1">
                <div className="text-sm font-medium text-gray-900">{field.label}</div>
                <div className="text-xs text-gray-500">{field.description}</div>
              </div>
            </Label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Label className="block text-sm font-medium text-gray-700 mb-3">
        Match against fields:
        <span className="ml-2 text-xs font-normal text-gray-500">
          (Pattern will match if ANY selected field matches)
        </span>
      </Label>
      <div className="space-y-4">
        {renderGroup('Identity', groupedFields.identity)}
        {renderGroup('Financial', groupedFields.financial)}
        {renderGroup('Technical', groupedFields.technical)}
      </div>
      {selectedFields.length === 1 && (
        <p className="mt-2 text-xs text-gray-500">
          At least one field must be selected
        </p>
      )}
    </div>
  );
}

export default FieldSelectorGrid;
