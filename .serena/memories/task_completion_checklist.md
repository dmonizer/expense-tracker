# Task Completion Checklist

When completing a task, follow these steps:

## 1. Code Quality
- [ ] Follow Clean Code principles (no duplication, short methods, KISS, YAGNI)
- [ ] Ensure code is easily testable (pure functions where possible)
- [ ] Use descriptive variable and function names
- [ ] Keep classes and components small and focused
- [ ] Avoid global variables

## 2. TypeScript
- [ ] Ensure all types are properly defined
- [ ] No use of `any` without good reason
- [ ] Type inference is leveraged where appropriate
- [ ] Interfaces match the data model in docs/plan.md

## 3. Linting
```bash
npm run lint
```
- [ ] No ESLint errors or warnings
- [ ] Code follows ESLint configuration

## 4. Build Check
```bash
npm run build
```
- [ ] TypeScript compilation succeeds
- [ ] No type errors
- [ ] Build completes successfully

## 5. Testing (when applicable)
- Currently no testing framework set up
- When tests are added, run them before completing a task

## 6. Documentation
- [ ] Update relevant comments if needed
- [ ] Complex logic has explanatory comments
- [ ] Public APIs have clear documentation

## 7. Integration
- [ ] New code integrates with existing codebase
- [ ] Follows established patterns
- [ ] File organization is logical

## Minimal Checklist (for simple tasks)
For simple changes, at minimum:
1. Run `npm run lint` - should pass
2. Run `npm run build` - should succeed
3. Verify code follows clean code principles
