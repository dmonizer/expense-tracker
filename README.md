# Personal Expense Tracker

A modern web-based expense tracking application that imports CSV bank statements (Estonian Swedbank format), automatically categorizes transactions using customizable rules with advanced pattern matching, and visualizes spending patterns.

## Features

### Core Functionality
- **CSV Import**: Drag-and-drop interface for importing Swedbank Estonia bank statements
- **Automatic Categorization**: 16 default category rules with intelligent pattern matching
- **Manual Overrides**: Edit transaction categories with manual override tracking
- **Duplicate Detection**: Automatic detection using archive IDs and fallback methods
- **Transaction Management**: Filtering, sorting, and search capabilities

### Advanced Pattern Matching
- **AND/OR Logic**: Choose whether patterns should match ANY (OR) or ALL (AND) conditions
- **Multi-field Matching**: Match on payee, description, or both
- **Pattern Types**: Wordlist (simple) and Regex (advanced) matching
- **Smart Suggestions**: Auto-extract patterns from transactions
- **Conflict Detection**: Warnings when patterns overlap with existing rules
- **Priority Resolution**: Higher-priority rules win when multiple rules match

### Data Visualization
- **Category Breakdown**: Pie chart showing expense distribution
- **Monthly Trends**: Bar chart with spending patterns over time
- **Balance Timeline**: Line chart tracking account balance
- **Interactive Filtering**: Click chart sections to filter transactions
- **Date Range Selection**: Preset and custom date ranges

### User Experience
- **Live Preview**: See matching transactions before saving rules
- **Bulk Operations**: Re-categorize all transactions, import/export rules
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Changes reflect immediately across all views
- **Pattern Creation**: Create categorization rules directly from transaction editor

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS
- **Database**: IndexedDB via Dexie.js 3.2.4
- **CSV Parsing**: PapaParse 5.4.1
- **Charts**: Chart.js 4.4.0 with react-chartjs-2
- **Date Handling**: date-fns 2.30.0

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

The development server will start at `http://localhost:5173`

## Usage Guide

### Importing Transactions

1. Click the **Import** tab
2. Drag and drop your Swedbank CSV file or click to browse
3. Review the preview showing new vs duplicate transactions
4. Click **Import** to add transactions to your database

### Creating Category Rules

#### Using the Categories Tab

1. Go to **Categories** tab
2. Click **+ Add New Rule**
3. Configure the rule:
   - **Name**: Category name (e.g., "Groceries")
   - **Type**: Income or Expense
   - **Pattern Logic**: OR (match ANY pattern) or AND (match ALL patterns)
   - **Priority**: 1-10 (higher wins conflicts)
   - **Patterns**: Add wordlist or regex patterns

#### From Transaction Editor

1. Click a transaction's category to edit
2. Select a category
3. Check "Add pattern to auto-categorize similar transactions"
4. Choose fields to match (payee/description)
5. Select suggested patterns or add custom ones
6. Adjust weight (specificity) if needed
7. Save to update the rule and recategorize all transactions

### Pattern Matching Logic

#### OR Logic (Default)
- Rule matches if **ANY** pattern matches
- Score = sum of matched pattern weights
- Example: "RIMI" OR "SELVER" → matches either store

#### AND Logic
- Rule matches only if **ALL** patterns match
- Score = 0 if any pattern fails, sum of all weights if all match
- Example: "RIMI" AND amount > 50 → only large grocery purchases

**When to use AND:**
- Combining multiple conditions (vendor + amount threshold)
- Creating very specific categories
- Reducing false positives

**When to use OR:**
- Matching multiple vendors for same category
- Flexible matching across variations
- General purpose categorization

### Managing Transactions

**Filtering:**
- Date range (presets or custom)
- Category (multi-select)
- Transaction type (income/expense/both)
- Amount range
- Search by payee or description

**Sorting:**
- Click column headers to sort
- Sort by: date, payee, amount, category, description
- Toggle ascending/descending

**Editing:**
- Click category to open editor
- Change category (marks as manually edited)
- Add patterns to auto-categorize similar transactions

### Bulk Operations

**Re-categorize All:**
- Applies current rules to all non-manually-edited transactions
- Useful after adding/modifying category rules

**Export/Import Rules:**
- Export all rules to JSON file
- Import rules from JSON file
- Choose to add or replace existing rules

## Data Model

### Transaction Structure
```typescript
interface Transaction {
  id: string;              // UUID
  accountNumber: string;   // Account number
  date: Date;             // Transaction date
  payee: string;          // Merchant/payee name
  description: string;    // Transaction description
  amount: number;         // Amount (positive or negative)
  currency: string;       // Currency code
  type: 'debit' | 'credit'; // Transaction type
  category?: string;      // Assigned category
  categoryConfidence?: number; // Match confidence (0-100)
  manuallyEdited: boolean; // Manual override flag
  transactionType: string; // Bank transaction type
  archiveId: string;      // For duplicate detection
  imported: Date;         // Import timestamp
}
```

### Category Rule Structure
```typescript
interface CategoryRule {
  id: string;
  name: string;
  patterns: Pattern[];
  patternLogic: 'OR' | 'AND'; // How patterns are combined
  priority: number;       // Conflict resolution (1-10)
  type: 'income' | 'expense';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Pattern {
  field: 'payee' | 'description';
  matchType: 'wordlist' | 'regex';
  words?: string[];       // For wordlist
  regex?: string;         // For regex
  regexFlags?: string;    // Regex flags
  caseSensitive?: boolean;
  weight: number;         // Specificity weight
}
```

## CSV Format

### Swedbank Estonia Format

The application expects CSV files with semicolon delimiters:

```csv
"Kliendi konto";"Kuupäev";"Saaja/Maksja";"Selgitus";"Summa";"Valuuta";"Deebet/Kreedit";"Arhiveerimistunnus";"Tehingu tüüp"
"EE123456789";"01.11.2025";"RIMI";"Grocery shopping";"45,67";"EUR";"D";"2025110101234567";"K"
```

**Field Mapping:**
- Kliendi konto → Account Number
- Kuupäev → Date (DD.MM.YYYY)
- Saaja/Maksja → Payee
- Selgitus → Description
- Summa → Amount (comma as decimal)
- Valuuta → Currency
- Deebet/Kreedit → Type (D=Debit, K=Credit)
- Arhiveerimistunnus → Archive ID
- Tehingu tüüp → Transaction Type

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── Categories/      # Category management
│   ├── Dashboard/       # Charts and overview
│   ├── ImportWizard/    # CSV import flow
│   └── Transactions/    # Transaction list and editor
├── services/            # Business logic
│   ├── db.ts           # Database schema
│   ├── csvParser.ts    # CSV parsing
│   ├── categorizer.ts  # Auto-categorization
│   ├── analytics.ts    # Data aggregation
│   └── seedData.ts     # Default rules
├── utils/              # Utility functions
│   ├── formatters.ts   # Formatting helpers
│   ├── validators.ts   # Data validation
│   ├── matchers.ts     # Pattern matching
│   └── patternExtractor.ts # Pattern suggestions
├── types/              # TypeScript types
└── App.tsx             # Main application
```

### Database Schema

**IndexedDB with Dexie.js:**
- `transactions` - All imported transactions (indexed by date, category, archiveId)
- `categoryRules` - User-defined category rules (indexed by priority, type, name)
- `importHistory` - CSV import records
- `settings` - Application settings

**Schema Version:** 3
- v1: Initial schema
- v2: Added name index to categoryRules
- v3: Added patternLogic field for AND/OR logic

### Code Style

- Clean Code principles (DRY, KISS, YAGNI)
- Short, focused functions with descriptive names
- Type-safe (no `any` types)
- ESLint configuration enforced
- Comprehensive error handling

## Troubleshooting

### Import Issues

**Problem:** CSV file not parsing correctly
- Ensure file is in Swedbank Estonia format
- Check for correct delimiter (semicolon)
- Verify decimal separator (comma)

**Problem:** All transactions marked as duplicates
- Archive IDs are being reused
- Check date range of existing transactions

### Categorization Issues

**Problem:** Transactions not being categorized
- Check if patterns match transaction fields
- Verify pattern syntax (regex especially)
- Check rule priority and type (income vs expense)

**Problem:** Wrong category assigned
- Multiple rules matching - check priorities
- Use AND logic for more specific rules
- Review pattern weights

### Performance Issues

**Problem:** Slow with many transactions
- Pagination is enabled (20 per page)
- Use filters to reduce visible transactions
- Consider archiving old transactions

## Contributing

This is a personal project, but suggestions and bug reports are welcome via issues.

## License

Private project - not for redistribution.

## Acknowledgments

- Built with React, TypeScript, and Vite
- Uses Dexie.js for reliable IndexedDB access
- Chart.js for beautiful visualizations
- Tailwind CSS for responsive design

## Version History

### Phase 9 (November 13, 2025) - Current
- ✅ AND/OR logic for pattern matching
- ✅ Enhanced rule editor with logic toggle
- ✅ Purple AND badges in category manager
- ✅ Database v3 with automatic migration

### Phase 8 (November 13, 2025)
- ✅ Transaction sorting by all columns
- ✅ Click headers to toggle sort direction
- ✅ Sorting works correctly with filters

### Phase 7 (November 13, 2025)
- ✅ Pattern-based auto-categorization from transaction editor
- ✅ Smart pattern extraction with suggestions
- ✅ Conflict detection and warnings
- ✅ Real-time preview of affected transactions

### Phase 6 (November 13, 2025)
- ✅ Create categories from transaction editor
- ✅ Automatic re-categorization on rule changes
- ✅ Integrated transactions view on dashboard
- ✅ Click-to-filter on chart sections

### Phase 5 (November 13, 2025)
- ✅ Import/export category rules (JSON)
- ✅ Enhanced performance for large datasets

### Phase 4 (November 12, 2025)
- ✅ Three chart types (pie, bar, line)
- ✅ Data aggregation and filtering
- ✅ Interactive dashboard

### Phase 3 (November 12, 2025)
- ✅ Category rule editor with patterns
- ✅ Wordlist and regex pattern matching
- ✅ Priority-based conflict resolution
- ✅ Live preview of matching transactions

### Phase 2 (November 12, 2025)
- ✅ CSV import with duplicate detection
- ✅ Transaction list with filtering
- ✅ Basic categorization engine

### Phase 1 (November 11, 2025)
- ✅ Project setup with Vite + React + TypeScript
- ✅ IndexedDB schema with Dexie
- ✅ 16 default category rules

## Future Enhancements

- Budget tracking per category
- Recurring transaction detection
- Transaction notes and tags
- Receipt attachment support
- Multi-currency support with conversion
- Export reports (PDF, Excel)
- Pattern groups (complex AND/OR combinations)
- Machine learning suggestions
