import {isValidPattern} from '@/utils';
import type {Pattern} from '@/types';
import WordListEditor from './WordListEditor';
import RegexEditor from './RegexEditor';
import {Label} from '@/components/ui/label';

interface PatternEditorProps {
    pattern: Pattern;
    onChange: (pattern: Pattern) => void;
    onRemove: () => void;
    index: number;
}

function PatternEditor({pattern, onChange, onRemove, index}: Readonly<PatternEditorProps>) {
    const handleFieldChange = (field: 'payee' | 'description') => {
        onChange({
            ...pattern,
            field,
        });
    };

    const handleMatchTypeChange = (matchType: 'wordlist' | 'regex') => {
        // Reset pattern data when changing type
        if (matchType === 'wordlist') {
            onChange({
                field: pattern.field,
                matchType: 'wordlist',
                words: [],
                caseSensitive: false,
                weight: pattern.weight,
            });
        } else {
            onChange({
                field: pattern.field,
                matchType: 'regex',
                regex: '',
                regexFlags: '',
                weight: pattern.weight,
            });
        }
    };

    const handleWeightChange = (weight: number) => {
        onChange({
            ...pattern,
            weight: Math.max(1, weight),
        });
    };

    const isValid = isValidPattern(pattern);

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-700">Pattern {index + 1}</h4>
                <button
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    title="Remove pattern"
                >
                    Remove
                </button>
            </div>

            <div className="space-y-4">
                {/* Field selector */}
                <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Match Field</Label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleFieldChange('payee')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                pattern.field === 'payee'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Payee
                        </button>
                        <button
                            onClick={() => handleFieldChange('description')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                pattern.field === 'description'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Description
                        </button>
                    </div>
                </div>

                {/* Match type toggle */}
                <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Match Type</Label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleMatchTypeChange('wordlist')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                pattern.matchType === 'wordlist'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Word List
                        </button>
                        <button
                            onClick={() => handleMatchTypeChange('regex')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                pattern.matchType === 'regex'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Regex
                        </button>
                    </div>
                </div>

                {/* Pattern editor (conditional) */}
                <div>
                    {pattern.matchType === 'wordlist' ? (
                        <WordListEditor pattern={pattern} onChange={onChange}/>
                    ) : (
                        <RegexEditor pattern={pattern} onChange={onChange}/>
                    )}
                </div>

                {/* Weight input */}
                <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight <span className="text-gray-500 font-normal ml-1">(Higher = more important)</span>
                    </Label>
                    <input
                        type="number"
                        min="1"
                        value={pattern.weight}
                        onChange={e => handleWeightChange(Number.parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>

                {/* Validation feedback */}
                {!isValid && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <svg
                            className="w-5 h-5 text-yellow-600 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <span className="text-sm text-yellow-800">
              This pattern is incomplete or invalid. Please fix before saving.
            </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PatternEditor;
