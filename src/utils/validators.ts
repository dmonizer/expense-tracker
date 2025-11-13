import type { Transaction, CategoryRule, Pattern } from '../types';

/**
 * Validates that a transaction object has all required fields
 * @param transaction - Partial transaction object to validate
 * @returns true if transaction is valid, false otherwise
 * @example
 * isValidTransaction({ id: '123', date: new Date(), amount: 10 }) // false (missing required fields)
 * isValidTransaction({ ...allRequiredFields }) // true
 */
export function isValidTransaction(transaction: Partial<Transaction>): boolean {
  if (!transaction) {
    return false;
  }

  // Check required fields
  if (!transaction.id || typeof transaction.id !== 'string') {
    return false;
  }

  if (!transaction.accountNumber || typeof transaction.accountNumber !== 'string') {
    return false;
  }

  if (!transaction.date || !(transaction.date instanceof Date) || isNaN(transaction.date.getTime())) {
    return false;
  }

  if (!transaction.payee || typeof transaction.payee !== 'string') {
    return false;
  }

  if (!transaction.description || typeof transaction.description !== 'string') {
    return false;
  }

  if (transaction.amount === undefined || typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
    return false;
  }

  if (!transaction.currency || typeof transaction.currency !== 'string') {
    return false;
  }

  if (!transaction.type || (transaction.type !== 'debit' && transaction.type !== 'credit')) {
    return false;
  }

  if (transaction.manuallyEdited === undefined || typeof transaction.manuallyEdited !== 'boolean') {
    return false;
  }

  if (!transaction.transactionType || typeof transaction.transactionType !== 'string') {
    return false;
  }

  if (!transaction.archiveId || typeof transaction.archiveId !== 'string') {
    return false;
  }

  return !(!transaction.imported || !(transaction.imported instanceof Date) || isNaN(transaction.imported.getTime()));


}

/**
 * Validates that a category rule has all required fields and at least one pattern
 * @param rule - Partial category rule object to validate
 * @returns true if category rule is valid, false otherwise
 * @example
 * isValidCategoryRule({ name: 'Food', patterns: [] }) // false (no patterns)
 * isValidCategoryRule({ name: 'Food', patterns: [validPattern], priority: 1 }) // true
 */
export function isValidCategoryRule(rule: Partial<CategoryRule>): boolean {
  if (!rule) {
    return false;
  }

  // Check required fields
  if (!rule.id || typeof rule.id !== 'string') {
    return false;
  }

  if (!rule.name || typeof rule.name !== 'string' || rule.name.trim().length === 0) {
    return false;
  }

  if (!rule.patterns || !Array.isArray(rule.patterns) || rule.patterns.length === 0) {
    return false;
  }

  // Validate all patterns
  if (!rule.patterns.every(pattern => isValidPattern(pattern))) {
    return false;
  }

  if (rule.priority === undefined || typeof rule.priority !== 'number') {
    return false;
  }

  if (!rule.type || (rule.type !== 'income' && rule.type !== 'expense')) {
    return false;
  }

  if (rule.isDefault === undefined || typeof rule.isDefault !== 'boolean') {
    return false;
  }

  if (!rule.createdAt || !(rule.createdAt instanceof Date) || isNaN(rule.createdAt.getTime())) {
    return false;
  }

  return !(!rule.updatedAt || !(rule.updatedAt instanceof Date) || isNaN(rule.updatedAt.getTime()));


}

/**
 * Validates that a pattern is properly configured based on its match type
 * @param pattern - Partial pattern object to validate
 * @returns true if pattern is valid, false otherwise
 * @example
 * isValidPattern({ field: 'payee', matchType: 'wordlist', words: ['STORE'], weight: 10 }) // true
 * isValidPattern({ field: 'payee', matchType: 'regex', regex: '\\d+', weight: 5 }) // true
 */
export function isValidPattern(pattern: Partial<Pattern>): boolean {
  if (!pattern) {
    return false;
  }

  // Check required fields
  if (!pattern.field || (pattern.field !== 'payee' && pattern.field !== 'description')) {
    return false;
  }

  if (!pattern.matchType || (pattern.matchType !== 'wordlist' && pattern.matchType !== 'regex')) {
    return false;
  }

  if (pattern.weight === undefined || typeof pattern.weight !== 'number' || pattern.weight <= 0) {
    return false;
  }

  // Validate based on match type
  if (pattern.matchType === 'wordlist') {
    if (!pattern.words || !Array.isArray(pattern.words) || pattern.words.length === 0) {
      return false;
    }

    // All words must be objects with text and negated properties
    if (!pattern.words.every(word => 
      typeof word === 'object' && 
      word !== null &&
      typeof word.text === 'string' && 
      word.text.trim().length > 0 &&
      typeof word.negated === 'boolean'
    )) {
      return false;
    }

    // caseSensitive should be boolean if provided
    if (pattern.caseSensitive !== undefined && typeof pattern.caseSensitive !== 'boolean') {
      return false;
    }
  } else if (pattern.matchType === 'regex') {
    if (!pattern.regex || typeof pattern.regex !== 'string' || pattern.regex.trim().length === 0) {
      return false;
    }

    // Validate regex is valid
    if (!isValidRegex(pattern.regex)) {
      return false;
    }

    // regexFlags should be string if provided
    if (pattern.regexFlags !== undefined && typeof pattern.regexFlags !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Tests if a regex string is syntactically valid
 * @param regex - The regex string to test
 * @returns true if the regex is valid, false otherwise
 * @example
 * isValidRegex('\\d+') // true
 * isValidRegex('[a-z') // false (unclosed bracket)
 */
export function isValidRegex(regex: string): boolean {
  try {
    new RegExp(regex);
    return true;
  } catch {
    return false;
  }
}
