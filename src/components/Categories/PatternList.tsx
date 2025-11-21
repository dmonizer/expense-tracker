import type {Pattern, Transaction} from '@/types';
import PatternCard from './PatternCard';
import PatternEditorV2 from './PatternEditorV2';

interface PatternListProps {
  patterns: Pattern[];
  onPatternsChange: (patterns: Pattern[]) => void;
  expandedIndex: number | null;
  onExpandedChange: (index: number | null) => void;
  transactionContext?: Transaction;
  categoryName?: string;
  showSuggestions?: boolean;
  showConflicts?: boolean;
  showPreview?: boolean;
}

function PatternList({
  patterns,
  onPatternsChange,
  expandedIndex,
  onExpandedChange,
  transactionContext,
  categoryName,
  showSuggestions = false,
  showConflicts = false,
  showPreview = false,
}: Readonly<PatternListProps>) {
  const handlePatternUpdate = (index: number, pattern: Pattern) => {
    const newPatterns = [...patterns];
    newPatterns[index] = pattern;
    onPatternsChange(newPatterns);
  };

  const handlePatternDelete = (index: number) => {
    const newPatterns = patterns.filter((_, i) => i !== index);
    onPatternsChange(newPatterns);
    // Close expanded if we deleted it
    if (expandedIndex === index) {
      onExpandedChange(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      // Adjust expanded index if we deleted before it
      onExpandedChange(expandedIndex - 1);
    }
  };

  const handleToggleExpand = (index: number) => {
    onExpandedChange(expandedIndex === index ? null : index);
  };

  if (patterns.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="font-medium mb-1">No patterns added yet</p>
        <p className="text-sm">Add at least one pattern to match transactions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((pattern, index) => (
        <div key={index}>
          {expandedIndex === index ? (
            // Show full editor when expanded
            <PatternEditorV2
              pattern={pattern}
              onChange={(updatedPattern) => handlePatternUpdate(index, updatedPattern)}
              onRemove={() => handlePatternDelete(index)}
              onSave={() => onExpandedChange(null)}
              transactionContext={transactionContext}
              categoryName={categoryName}
              showSuggestions={showSuggestions}
              showConflicts={showConflicts}
              showPreview={showPreview}
            />
          ) : (
            // Show card when collapsed
            <PatternCard
              pattern={pattern}
              index={index}
              isExpanded={false}
              onToggleExpand={() => handleToggleExpand(index)}
              onDelete={() => handlePatternDelete(index)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default PatternList;
