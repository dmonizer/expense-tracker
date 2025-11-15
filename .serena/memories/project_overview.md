# Personal Expense Tracker - Project Overview

## Purpose
A web-based expense tracking application that imports CSV bank statements (Estonian Swedbank format), automatically categorizes transactions using customizable rules, and visualizes spending patterns. The application allows users to:
- Import and parse CSV bank statements
- Automatically categorize transactions based on customizable rules (wordlist and regex patterns)
- Manually override categorizations
- Visualize spending patterns with interactive charts
- Manage category rules and groups with priority-based conflict resolution
- Drill down through hierarchical data (groups → categories → transactions)

## Tech Stack
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS
- **Data Storage**: IndexedDB (via Dexie.js 3.2.4)
- **CSV Parsing**: PapaParse 5.4.1
- **Data Visualization**: Chart.js 4.4.0 with react-chartjs-2
- **Date Utilities**: date-fns 2.30.0
- **ID Generation**: uuid 9.0.1
- **Linting**: ESLint 9 with TypeScript ESLint

## Key Features
1. CSV import with duplicate detection using archive IDs
2. **Custom Import Format Wizard** - Create, save, and manage custom CSV import formats
3. **Format Auto-Detection** - Automatically detects known formats when importing files
4. Auto-categorization with pattern matching (wordlist and regex)
5. AND/OR logic for pattern combinations
6. Category groups with color coding and priority management
7. Priority-based rule conflict resolution
8. Interactive chart visualizations with drill-down
9. Centralized filter management with FilterContext
10. Transaction visualization with multiple chart types
11. Fully editable default category rules
12. Manual category override functionality
13. Tooltip sorting by amount (descending)
14. Dynamic chart interactions (click-to-filter, cursor-following tooltips)
15. **Format Export/Import** - Share format definitions via JSON files
16. **Built-in Swedbank Format** - Pre-configured format for Swedbank Estonia

## Project Structure
```
src/
├── types/           # TypeScript interfaces
├── assets/          # Static assets
├── services/        # Business logic (db, csvParser, categorizer, analytics)
├── components/      # React components
│   ├── Categories/  # Category & group management
│   ├── Dashboard/   # Analytics & visualizations
│   ├── ImportWizard/# CSV import flow
│   ├── Transactions/# Transaction list & filters
│   └── UI/          # Reusable UI components
├── contexts/        # React contexts (FilterContext)
├── utils/           # Utility functions (filters, formatters, validators)
├── hooks/           # Custom React hooks
├── constants.ts     # Application constants
├── App.tsx          # Main application component
└── main.tsx         # Application entry point
```

## Current State (November 2025)
**Status:** Fully functional production-ready application

**Completed Phases:**
- ✅ Phase 1-9: Core features, categorization, visualization, AND/OR logic
- ✅ Phase 10: FilterContext implementation and chart drilldown improvements

**Recent Updates (November 15, 2025 - Import Format Wizard):**
- Implemented comprehensive import format wizard for custom CSV formats
- Added format auto-detection with pattern matching (filename, headers)
- Created format manager UI for CRUD operations on import formats
- Built-in Swedbank format preserved with backward compatibility
- Field mapping with visual preview and transformation configuration
- Support for various date, number, and debit/credit formats
- Format export/import as JSON for sharing configurations
- 4-step wizard: File Analysis → Field Mapping → Preview → Save Format

**Components Added:**
- `src/components/ImportWizard/FormatWizard/` - 4-step format creation wizard
- `src/components/ImportWizard/FormatSelector.tsx` - Format selection on import
- `src/components/Settings/FormatManager/` - Format management UI
- `src/services/formatManager.ts` - Format CRUD operations
- `src/services/formatDetector.ts` - Auto-detection logic

**Previous Updates (November 14, 2025):**
- Implemented FilterContext for centralized filter state management
- Fixed bar chart to show all months in date range (not just months with data)
- Fixed transaction list filtering to properly sync with chart drilldown state
- Implemented tooltip sorting by amount (descending order)
- Added cursor-following tooltips for better UX
- Fixed "Unknown expenses" group handling for proper drilldown
- Improved back button navigation (incremental level-up)
- Enhanced group and category filtering consistency across all components

**Key Technical Achievements:**
- Centralized filter management (date ranges, drilldown state, category/group filters)
- Real-time filter synchronization across charts and transaction list
- Proper handling of virtual groups (uncategorized transactions)
- Smooth drill-down UX: Groups Overview → Group View → Category View
- Custom Chart.js tooltip positioning for better visibility
- Type-safe implementation with zero TypeScript errors

**Database Schema:** Version 11
- transactions: All imported transactions
- categoryRules: Pattern matching rules with AND/OR logic
- categoryGroups: Category organization with priorities
- importRecords: Import history tracking
- importFormats: Custom CSV format definitions with field mappings and transformations
- accounts: Double-entry accounting accounts
- journalEntries: Journal entries for double-entry accounting
- splits: Transaction splits for journal entries
- exchangeRates: Exchange rate history
- accountBalances: Cached account balances
- holdings: Investment holdings

**Next Opportunities:**
- Add budget tracking per category
- Implement recurring transaction detection
- Add transaction notes and tags
- Export functionality (CSV, PDF reports)
- Multi-currency conversion support
