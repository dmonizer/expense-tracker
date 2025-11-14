# Personal Expense Tracker - Technical Documentation

## Overview
A React-based expense tracking application that imports CSV bank statements (Estonian Swedbank format), automatically categorizes transactions using pattern matching, and visualizes spending with charts and analytics.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS
- **Database**: IndexedDB (Dexie.js 3.2.4)
- **CSV Parsing**: PapaParse 5.4.1
- **Charts**: Chart.js 4.4.0 + react-chartjs-2
- **Date Utilities**: date-fns 2.30.0

## Architecture

### Project Structure
```
src/
├── components/
│   ├── Categories/         # Category & group management
│   ├── Dashboard/          # Analytics & visualizations
│   ├── ImportWizard/       # CSV import flow
│   ├── Transactions/       # Transaction list & filters
│   ├── UI/                 # Reusable UI components
│   └── ErrorBoundary.tsx   # Error handling wrapper
├── services/
│   ├── db.ts              # Dexie database schema
│   ├── categorizer.ts     # Pattern matching engine
│   ├── csvParser.ts       # CSV parsing & duplicate detection
│   ├── analytics.ts       # Data aggregation & statistics
│   ├── seedData.ts        # Default rules & groups
│   └── errorHandler.ts    # Unified error handling
├── utils/
│   ├── transactionFilters.ts  # Filtering logic (group/date/amount/etc)
│   ├── dateUtils.ts           # Date operations
│   ├── formatters.ts          # Currency/date formatters
│   ├── validators.ts          # Input validation
│   └── colorUtils.ts          # Color generation
├── types/index.ts         # TypeScript interfaces
├── constants.ts           # Application constants
└── App.tsx               # Main application shell

## Key Features

### 1. CSV Import with Duplicate Detection
- Parses Estonian Swedbank CSV format
- Detects duplicates using archive IDs
- Auto-categorizes on import
- Preview & summary screens

### 2. Pattern-Based Categorization
- **Wordlist matching**: Case-insensitive word matching in payee/description
- **Regex matching**: Pattern matching with flags
- **Priority system**: Higher priority rules take precedence
- **Confidence scoring**: 0-100% confidence per match
- **AND/OR logic**: Combine multiple patterns per rule

### 3. Category Groups
- Organize categories by priority (Critical/Important/Optional/Savings/Income)
- Color-coded visualization
- Group-level analytics
- Special "Uncategorized" group for unmatched transactions

### 4. Filtering & Analytics
- Date range, category, group, amount, transaction type filters
- Category pie charts with drill-down
- Monthly bar charts (category/group views)
- Balance over time line chart
- Real-time updates with Dexie live queries

## Recent Maintenance (2025-01)

### Phase 1: Code Consolidation
✅ **Extracted duplicate filtering logic** to `utils/transactionFilters.ts`
- 93% code reduction in TransactionList (120 → 8 lines)
- Centralized group filtering (handles UNCATEGORIZED_GROUP_ID)
- Reusable filter functions across analytics & components

✅ **Created constants file** (`constants.ts`)
- Pagination, file upload, categorization constants
- Eliminated magic numbers

✅ **Added date utilities** (`dateUtils.ts`)
- Date normalization, range checking, presets

### Phase 2: Reusable Components
✅ **Created UI component library** (`components/UI/`)
- `LoadingSpinner`: Consistent loading states
- `Button`: Multiple variants (primary/secondary/danger/ghost)
- `EmptyState`: Standardized empty state UX

### Phase 3: Error Handling
✅ **Unified error handling** (`services/errorHandler.ts`)
- Normalized error format
- User-friendly messages
- Error severity levels
- Consistent logging with context

✅ **Added ErrorBoundary wrappers**
- Per-tab error isolation in App.tsx
- Graceful error recovery

## Database Schema (Dexie)

### Tables
1. **transactions**: All imported transactions
   - Indexed: date, payee, category, archiveId
   - Fields: amount, type (credit/debit), currency, description, ignored, manuallyEdited

2. **categoryRules**: Pattern matching rules
   - Indexed: name, priority, groupId
   - Fields: patterns[], patternLogic (AND/OR), type (income/expense)

3. **categoryGroups**: Category organization
   - Indexed: id, priority
   - Fields: name, description, baseColor, sortOrder

4. **importRecords**: Import history
   - Indexed: timestamp, fileName
   - Fields: totalCount, newCount, duplicateCount

## Code Patterns & Conventions

### Clean Code Principles
- **DRY**: No code duplication (utilities for common operations)
- **KISS**: Simple, focused functions
- **YAGNI**: No speculative features
- **Single Responsibility**: Components/functions do one thing well
- **Short methods**: Descriptive names, clear purpose

### TypeScript Usage
- Strict mode enabled
- Explicit types where inference isn't obvious
- Interfaces for object shapes
- Type guards for runtime validation
- Avoid `any`, use `unknown` instead

### React Best Practices
- Functional components with hooks
- Props destructuring
- Memoization with `useMemo`/`useCallback` where needed
- Live queries with `useLiveQuery` for real-time updates

## Performance Considerations
- **Pagination**: 20 items per page (configurable)
- **Live queries**: Dexie reactive updates
- **Memoization**: Filtered/sorted data cached with useMemo
- **Lazy loading**: Components loaded on-demand

## Known Limitations
1. **CSV Format**: Only supports Estonian Swedbank format
2. **Currency**: Primarily designed for EUR (multi-currency supported but not fully optimized)
3. **Categorization**: Manual pattern creation required for new merchants/patterns

## Future Improvements (Optional)
- [ ] Split large components (FileUpload 330+, Overview 420+, CategoryManager 400+, TransactionList 350+ lines)
- [ ] Add React.memo for chart components
- [ ] Create custom hooks (useTransactionFilters, usePagination, useTransactionStats)
- [ ] Virtual scrolling for large transaction lists (10k+ rows)
- [ ] Export functionality (CSV, JSON)
- [ ] Bulk transaction operations
- [ ] Multi-file import

## Testing & Development

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Development
```bash
npm run dev
```

## Error Handling Strategy
1. **Database errors**: Logged + user-friendly message
2. **Import errors**: Shown in preview with skip option
3. **Component errors**: Caught by ErrorBoundary
4. **Validation errors**: Inline form feedback

## Security Notes
- No server-side component (all client-side)
- Data stored locally in IndexedDB
- No external API calls
- No authentication (single-user local app)

---

**Last Updated**: 2025-01-14
**Maintainer**: Claude Code Refactoring Session
