import type { Transaction, CategoryRule, Pattern } from '../types';

// Helper validation functions
/**
 * Validates a string field is non-empty
 */
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a date object is valid
 */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Validates a number is not NaN
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Validates a boolean field
 */
function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Validates required string field
 */
function hasRequiredString(obj: Record<string, unknown>, field: string): boolean {
  return isValidString(obj[field]);
}

/**
 * Validates required number field
 */
function hasRequiredNumber(obj: Record<string, unknown>, field: string): boolean {
  return isValidNumber(obj[field]);
}

/**
 * Validates required boolean field
 */
function hasRequiredBoolean(obj: Record<string, unknown>, field: string): boolean {
  return isValidBoolean(obj[field]);
}

/**
 * Validates required date field
 */
function hasRequiredDate(obj: Record<string, unknown>, field: string): boolean {
  return isValidDate(obj[field]);
}

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

  const requiredStrings = ['id', 'accountNumber', 'payee', 'description', 'currency', 'transactionType', 'archiveId'];
  const hasAllStrings = requiredStrings.every(field => hasRequiredString(transaction, field));
  if (!hasAllStrings) {
    return false;
  }

  const requiredDates = ['date', 'imported'];
  const hasAllDates = requiredDates.every(field => hasRequiredDate(transaction, field));
  if (!hasAllDates) {
    return false;
  }

  if (!hasRequiredNumber(transaction, 'amount')) {
    return false;
  }

  if (!hasRequiredBoolean(transaction, 'manuallyEdited')) {
    return false;
  }

  const validTypes = ['debit', 'credit'];
  return validTypes.includes(transaction.type as string);
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

  const requiredStrings = ['id', 'name'];
  const hasAllStrings = requiredStrings.every(field => hasRequiredString(rule, field));
  if (!hasAllStrings) {
    return false;
  }

  const requiredDates = ['createdAt', 'updatedAt'];
  const hasAllDates = requiredDates.every(field => hasRequiredDate(rule, field));
  if (!hasAllDates) {
    return false;
  }

  if (!hasRequiredNumber(rule, 'priority')) {
    return false;
  }

  if (!hasRequiredBoolean(rule, 'isDefault')) {
    return false;
  }

  if (!isValidPatternArray(rule.patterns)) {
    return false;
  }

  const validTypes = ['income', 'expense'];
  return validTypes.includes(rule.type as string);
}

/**
 * Validates pattern array has at least one valid pattern
 */
function isValidPatternArray(patterns: unknown): patterns is Pattern[] {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  return patterns.every(pattern => isValidPattern(pattern));
}

/**
 * Validates wordlist pattern fields
 */
function isValidWordlistPattern(pattern: Partial<Pattern>): boolean {
  if (!Array.isArray(pattern.words) || pattern.words.length === 0) {
    return false;
  }

  const allWordsValid = pattern.words.every(word =>
    typeof word === 'object' &&
    word !== null &&
    isValidString(word.text) &&
    isValidBoolean(word.negated)
  );

  if (!allWordsValid) {
    return false;
  }

  return !(pattern.caseSensitive !== undefined && !isValidBoolean(pattern.caseSensitive));


}

/**
 * Validates regex pattern fields
 */
function isValidRegexPattern(pattern: Partial<Pattern>): boolean {
  if (!isValidString(pattern.regex)) {
    return false;
  }

  if (!isValidRegex(pattern.regex)) {
    return false;
  }

  return !(pattern.regexFlags !== undefined && typeof pattern.regexFlags !== 'string');


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

  // Validate fields array (support both new and legacy format)
  const validFieldNames = ['payee', 'description', 'accountNumber', 'transactionType', 'currency', 'archiveId'];

  // Check for new format (fields array)
  if (pattern.fields) {
    if (!Array.isArray(pattern.fields) || pattern.fields.length === 0) {
      return false;
    }
    if (!pattern.fields.every(f => validFieldNames.includes(f as string))) {
      return false;
    }
  }
  // Check for legacy format (single field)
  else if (pattern.field) {
    if (!validFieldNames.includes(pattern.field as string)) {
      return false;
    }
  }
  // No field specification at all
  else {
    return false;
  }

  const validMatchTypes = ['wordlist', 'regex'];
  if (!validMatchTypes.includes(pattern.matchType as string)) {
    return false;
  }

  if (!isValidNumber(pattern.weight) || (pattern.weight as number) <= 0) {
    return false;
  }

  // Validate amount condition if present
  if (pattern.amountCondition) {
    const validOperators = ['lt', 'lte', 'eq', 'gte', 'gt'];
    if (!validOperators.includes(pattern.amountCondition.operator)) {
      return false;
    }
    if (!isValidNumber(pattern.amountCondition.value) || pattern.amountCondition.value < 0) {
      return false;
    }
  }

  if (pattern.matchType === 'wordlist') {
    return isValidWordlistPattern(pattern);
  }

  if (pattern.matchType === 'regex') {
    return isValidRegexPattern(pattern);
  }

  return false;
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
