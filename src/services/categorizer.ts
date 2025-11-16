import type { Transaction, CategoryRule, Pattern } from '../types';
import { db } from './db';
import { CATEGORIZATION } from '../constants';

/**
 * Gets the value of a transaction field by name
 */
function getTransactionFieldValue(transaction: Transaction, field: string): string {
  switch (field) {
    case 'payee':
      return transaction.payee || '';
    case 'description':
      return transaction.description || '';
    case 'accountNumber':
      return transaction.accountNumber || '';
    case 'transactionType':
      return transaction.transactionType || '';
    case 'currency':
      return transaction.currency || '';
    case 'archiveId':
      return transaction.archiveId || '';
    default:
      return '';
  }
}

/**
 * Checks if a transaction matches a specific pattern
 * @param transaction - The transaction to check
 * @param pattern - The pattern to match against
 * @returns true if the transaction matches the pattern, false otherwise
 */
export function matchesPattern(transaction: Transaction, pattern: Pattern): boolean {
  // Support legacy patterns with single 'field' property
  const fields = pattern.fields || (pattern.field ? [pattern.field] : ['payee']);

  // Check if ANY of the specified fields match (OR logic across fields)
  return fields.some(field => {
    const fieldValue = getTransactionFieldValue(transaction, field);

    if (pattern.matchType === 'wordlist') {
      const words = pattern.words || [];
      const searchText = pattern.caseSensitive ? fieldValue : fieldValue.toLowerCase();

      // All conditions must be satisfied:
      // - At least one positive word must match (if any positive words exist)
      // - No negated word must match
      const positiveWords = words.filter(w => !w.negated);
      const negatedWords = words.filter(w => w.negated);

      // Check positive words: at least one must match (OR logic for positive words)
      const hasPositiveMatch = positiveWords.length === 0 || positiveWords.some(word => {
        const searchWord = pattern.caseSensitive ? word.text : word.text.toLowerCase();

        // Direct substring match
        if (searchText.includes(searchWord)) {
          return true;
        }

        // Fuzzy match: normalize whitespace and common punctuation
        // This helps match "Selver AS selver.ee" against "Selver AS, selver.ee"
        const normalizedSearch = searchText.replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedWord = searchWord.replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim();

        return normalizedSearch.includes(normalizedWord);
      });

      // Check negated words: none must match (AND NOT logic)
      const hasNegatedMatch = negatedWords.some(word => {
        const searchWord = pattern.caseSensitive ? word.text : word.text.toLowerCase();
        return searchText.includes(searchWord);
      });

      // Pattern matches if positive condition is met AND no negated words match
      return hasPositiveMatch && !hasNegatedMatch;
    } else {
      // Regex mode
      try {
        const regex = new RegExp(pattern.regex || '', pattern.regexFlags || '');
        return regex.test(fieldValue);
      } catch (e) {
        console.error('Invalid regex pattern:', pattern.regex, e);
        return false;
      }
    }
  });
}

/**
 * Calculates the match score for a transaction against a category rule
 * @param transaction - The transaction to score
 * @param rule - The category rule to match against
 * @returns The calculated match score
 */
export function calculateMatchScore(transaction: Transaction, rule: CategoryRule): number {
  const patternLogic = rule.patternLogic || 'OR'; // Default to OR for backward compatibility

  if (patternLogic === 'AND') {
    // AND logic: ALL patterns must match
    const allMatched = rule.patterns.every(pattern => matchesPattern(transaction, pattern));

    if (!allMatched) {
      return 0; // No match if any pattern fails
    }

    // All patterns matched - return sum of all weights
    const totalWeight = rule.patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    return totalWeight * (1 + rule.priority * 0.1);

  } else {
    // OR logic: ANY pattern can match (current behavior)
    let score = 0;

    for (const pattern of rule.patterns) {
      if (matchesPattern(transaction, pattern)) {
        score += pattern.weight;
      }
    }

    return score * (1 + rule.priority * 0.1);
  }
}

/**
 * Categorizes a single transaction by finding the best matching rule
 * @param transaction - The transaction to categorize
 * @returns An object with category name and confidence (0-100), or null if no matches
 */
export async function categorizeTransaction(
  transaction: Transaction
): Promise<{ category: string; confidence: number } | null> {
  // Load all category rules from database
  const rules = await db.categoryRules.toArray();

  if (rules.length === 0) {
    return null;
  }

  // Find all matching rules and calculate scores
  const matches: Array<{ rule: CategoryRule; score: number }> = [];

  for (const rule of rules) {
    const score = calculateMatchScore(transaction, rule);
    if (score > 0) {
      matches.push({ rule, score });
    }
  }

  // Return null if no matches found
  if (matches.length === 0) {
    return null;
  }

  // Select rule with highest score
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];

  // Calculate confidence (0-100)
  // Normalize score to 0-100 range
  // Using a logarithmic scale to prevent over-confidence
  const confidence = Math.min(100, (bestMatch.score / CATEGORIZATION.MAX_REASONABLE_SCORE) * 100);

  return {
    category: bestMatch.rule.name,
    confidence: Math.round(confidence),
  };
}

/**
 * Categorizes multiple transactions efficiently
 * @param transactions - Array of transactions to categorize
 * @returns Array of transactions with updated category and confidence
 */
export async function categorizeBatch(transactions: Transaction[]): Promise<Transaction[]> {
  // Load rules once and reuse for all transactions
  const rules = await db.categoryRules.toArray();

  if (rules.length === 0) {
    // No rules exist, clear categories from all transactions
    return transactions.map(transaction => ({
      ...transaction,
      category: undefined,
      categoryConfidence: undefined,
      manuallyEdited: false,
    }));
  }

  // Process each transaction
  const updatedTransactions: Transaction[] = [];

  for (const transaction of transactions) {
    // Find all matching rules and calculate scores
    const matches: Array<{ rule: CategoryRule; score: number }> = [];

    for (const rule of rules) {
      const score = calculateMatchScore(transaction, rule);
      if (score > 0) {
        matches.push({ rule, score });
      }
    }

    // Update transaction with category and confidence
    if (matches.length > 0) {
      // Select rule with highest score
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      // Calculate confidence (0-100)
      const confidence = Math.min(100, (bestMatch.score / CATEGORIZATION.MAX_REASONABLE_SCORE) * 100);

      updatedTransactions.push({
        ...transaction,
        category: bestMatch.rule.name,
        categoryConfidence: Math.round(confidence),
        manuallyEdited: false,
      });
    } else {
      // No matches found
      updatedTransactions.push({
        ...transaction,
        category: undefined,
        categoryConfidence: undefined,
        manuallyEdited: false,
      });
    }
  }

  return updatedTransactions;
}

/**
 * Re-runs categorization on all transactions where manuallyEdited = false
 * @returns Count of updated transactions
 */
export async function recategorizeAll(): Promise<number> {
  // Get all transactions where manuallyEdited = false
  const transactionsToRecategorize = await db.transactions
    .filter(transaction => !transaction.manuallyEdited)
    .toArray();

  if (transactionsToRecategorize.length === 0) {
    return 0;
  }

  // Categorize them
  const categorizedTransactions = await categorizeBatch(transactionsToRecategorize);

  // Update transactions in database
  await db.transaction('rw', db.transactions, async () => {
    for (const transaction of categorizedTransactions) {
      // Get the existing transaction from database
      const existing = await db.transactions.get(transaction.id);
      if (existing) {
        // Create updated transaction
        const updated = { ...existing };

        if (transaction.category !== undefined) {
          updated.category = transaction.category;
          updated.categoryConfidence = transaction.categoryConfidence;
        } else {
          // Remove category fields when undefined
          delete updated.category;
          delete updated.categoryConfidence;
        }
        updated.manuallyEdited = transaction.manuallyEdited;

        await db.transactions.put(updated);
      }
    }
  });

  return categorizedTransactions.length;
}

/**
 * Detects if a new pattern would conflict with existing category rules
 * @param newPattern - The pattern to check
 * @param targetCategoryName - The category the pattern would be added to
 * @param transaction - Sample transaction to test pattern against
 * @returns Array of conflicting category names, or empty array if no conflicts
 */
export async function detectPatternConflicts(
  newPattern: Pattern,
  targetCategoryName: string,
  transaction: Transaction
): Promise<string[]> {
  // Get all category rules except the target one
  const rules = await db.categoryRules
    .filter(rule => rule.name !== targetCategoryName)
    .toArray();

  const conflicts: string[] = [];

  // Check if the sample transaction would match any existing patterns
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      // Check if both patterns match the same fields and would match this transaction
      if (pattern.field === newPattern.field && matchesPattern(transaction, pattern)) {
        conflicts.push(rule.name);
        break; // Only add each category once
      }
    }
  }

  return conflicts;
}
