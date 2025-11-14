# Code Style and Conventions

## TypeScript Configuration
- TypeScript 5.9.3
- Strict mode enabled
- ES2020+ features available
- Module system: ESNext with module resolution

## Code Quality Standards
Based on the plan.md file (section 13), the project follows these principles:

### Clean Code Principles
- **Avoid code duplication**: DRY principle
- **Short methods**: Methods should have descriptive names and do one thing well
- **Small classes**: Keep classes focused and cohesive
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It - don't add functionality until needed
- **No global variables**: Avoid global state like the plague
- **Testable methods**: Keep methods easily testable and repeatable (same input = same output)

## ESLint Configuration
- Using ESLint 9 with flat config format
- TypeScript ESLint with recommended rules
- React Hooks plugin with recommended-latest config
- React Refresh plugin for Vite
- Target: ES2020
- Environment: browser globals

## Naming Conventions
- **Interfaces**: PascalCase (e.g., `Transaction`, `CategoryRule`)
- **Types**: PascalCase
- **Functions**: camelCase with descriptive names
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Files**: camelCase for utilities, PascalCase for components

## File Organization
- Components should be organized by feature (ImportWizard, Dashboard, Transactions, Categories, Settings)
- Services for business logic
- Utils for shared utilities
- Types centralized in types/index.ts

## Import/Export
- Use named exports for utilities and types
- Default exports for React components
- Use ES6 module syntax

## TypeScript Usage
- Always use explicit types where type inference isn't obvious
- Prefer interfaces over types for object shapes
- Use type guards for runtime type checking
- Avoid `any` - use `unknown` if type is truly unknown

## React Best Practices
- Functional components with hooks
- Props destructuring in component signatures
- Meaningful component and prop names
- Keep components small and focused
