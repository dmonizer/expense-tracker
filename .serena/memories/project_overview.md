# Personal Expense Tracker - Project Overview

## Purpose
A web-based expense tracking application that imports CSV bank statements (Estonian Swedbank format), automatically categorizes transactions using customizable rules, and visualizes spending patterns. The application allows users to:
- Import and parse CSV bank statements
- Automatically categorize transactions based on customizable rules (wordlist and regex patterns)
- Manually override categorizations
- Visualize spending patterns with charts
- Manage category rules with priority-based conflict resolution

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
2. Auto-categorization with pattern matching (wordlist and regex)
3. Priority-based rule conflict resolution
4. Transaction visualization with multiple chart types
5. Fully editable default category rules
6. Manual category override functionality

## Project Structure
```
src/
├── types/           # TypeScript interfaces
├── assets/          # Static assets
├── services/        # Business logic (db, csvParser, categorizer, etc.)
├── components/      # React components
├── utils/           # Utility functions
├── App.tsx          # Main application component
└── main.tsx         # Application entry point
```

## Current State
The project is in the foundation phase with:
- Basic project setup with Vite + React + TypeScript
- Type definitions defined in src/types/index.ts
- Dependencies installed
- Next step: Implement IndexedDB schema with Dexie
