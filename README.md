# Personal Expense Tracker

A privacy-focused web application for tracking personal expenses and investments.
Import your bank statements, automatically categorize transactions with smart rules, and visualize your spending
habits — all running locally on your machine.

## Key Features

- **Easy Import**: Drag-and-drop support for bank CSV statements (Existing formats for Swedbank Estonia and SEB
  Estonia - but other formats can easily be added in the UI).
- **Smart Categorization**: Create custom rules using simple keywords or advanced regex to automatically categorize
  transactions.
- **Visual Analytics**: Interactive charts and graphs to understand where your money goes.
- **Privacy First**: All data is stored locally in your browser using IndexedDB. No data ever leaves your device except
  any investment symbols of shares you have (to get the current price)
- **Transaction Management**: Search, filter, and manually edit transactions with ease.

***WARNING***: This application is still in early development. While basic functionality is present, expect bugs and
incomplete features. Use at your own risk. Any help is greatly appreciated.

## Contributing

This project is built with **React 19**, **TypeScript**, and **Vite**.

### Reporting Issues

If you encounter any bugs or have suggestions for improvements, please **report them through GitHub Issues**.

### Development Commands

- `npm run build`: Build for production
- `npm run lint`: Run code linting
- `npm test`: Run test suite
