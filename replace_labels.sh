#!/bin/bash

# List of files to process
files=(
  "src/components/Journal/JournalView.tsx"
  "src/components/Settings/ExchangeRateManager.tsx"
  "src/components/Settings/ExchangeRateApiSettings.tsx"
  "src/components/Settings/ApiSettings.tsx"
  "src/components/Dashboard/Overview.tsx"
  "src/components/Transactions/Filters.tsx"
  "src/components/Transactions/TransactionEditor.tsx"
  "src/components/Categories/WordListEditor.tsx"
  "src/components/Categories/RuleEditor.tsx"
  "src/components/Categories/RegexEditor.tsx"
  "src/components/Categories/PatternEditor.tsx"
  "src/components/Categories/CategoryGroupManager.tsx"
  "src/components/Categories/FieldSelectorGrid.tsx"
  "src/components/Categories/UnifiedRuleEditor.tsx"
  "src/components/Categories/PatternEditorV2.tsx"
  "src/components/ImportWizard/FormatWizard/Step4SaveFormat.tsx"
  "src/components/ImportWizard/FormatWizard/Step1FileAnalysis.tsx"
  "src/components/ImportWizard/FileUpload.tsx"
  "src/components/ImportWizard/FormatSelector.tsx"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  
  # Check if file already has Label import
  if ! grep -q "from '@/components/ui/label'" "$file"; then
    # Find the last import line and add Label import after it
    # Use perl for in-place editing with proper newline handling
    perl -i -pe '
      if (/^import .* from/ && !$label_added) {
        $last_import = $_;
        $_ = $last_import;
      }
      if (/^$/ && $last_import && !$label_added) {
        $_ = "import { Label } from '\''@/components/ui/label'\'';\n" . $_;
        $label_added = 1;
      }
    ' "$file"
  fi
  
  # Replace <label with <Label
  sed -i '' 's/<label/<Label/g' "$file"
  
  # Replace </label> with </Label>
  sed -i '' 's/<\/label>/<\/Label>/g' "$file"
  
  echo "✓ Completed $file"
done

echo "All files processed!"
