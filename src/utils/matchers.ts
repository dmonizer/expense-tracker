/**
 * Normalizes text for matching by trimming and converting to lowercase
 * @param text - The text to normalize
 * @returns Normalized text
 * @example
 * normalizeText('  HELLO World  ') // "hello world"
 * normalizeText('Café') // "café"
 */
export function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Escapes special regex characters in a string to make it safe for use in a RegExp
 * @param text - The text to escape
 * @returns Text with regex special characters escaped
 * @example
 * escapeRegex('hello.world') // "hello\\.world"
 * escapeRegex('cost: $10 (discount)') // "cost: \\$10 \\(discount\\)"
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a word list to a regex pattern that matches any of the words
 * Used for converting wordlist patterns to regex format (future conversion feature)
 * @param words - Array of words to match
 * @param caseSensitive - Whether the match should be case-sensitive
 * @returns Regex pattern string that matches any word in the list
 * @example
 * wordListToRegex(['STORE', 'SHOP'], false) // "(?i)\\b(?:STORE|SHOP)\\b"
 * wordListToRegex(['test', 'demo'], true) // "\\b(?:test|demo)\\b"
 */
export function wordListToRegex(words: string[], caseSensitive: boolean): string {
  if (words.length === 0) {
    return '';
  }

  // Escape each word and join with alternation (|)
  const escapedWords = words.map(word => escapeRegex(word));
  const pattern = `\\b(?:${escapedWords.join('|')})\\b`;

  // Add case-insensitive flag if needed
  return caseSensitive ? pattern : `(?i)${pattern}`;
}

/**
 * Attempts to convert a simple regex pattern back to a word list
 * Returns null if the regex is too complex to convert
 * Used for converting regex patterns to wordlist format (future conversion feature)
 * @param regex - The regex string to convert
 * @returns Array of words if conversion is possible, null otherwise
 * @example
 * regexToWordList('\\b(?:STORE|SHOP)\\b') // ['STORE', 'SHOP']
 * regexToWordList('(?i)\\b(?:test|demo)\\b') // ['test', 'demo']
 * regexToWordList('\\d+[a-z]*') // null (too complex)
 */
export function regexToWordList(regex: string): string[] | null {
  try {
    // Remove case-insensitive flag if present
    const cleanRegex = regex.replace(/^\(\?i\)/, '');

    // Match pattern: \b(?:word1|word2|word3)\b
    const wordListPattern = /^\\b\(\?:([^)]+)\)\\b$/;
    const match = cleanRegex.match(wordListPattern);

    if (!match) {
      return null;
    }

    const wordsString = match[1];
    const words = wordsString.split('|');

    // Check if all words are simple (escaped literals)
    // If any word contains unescaped regex special chars, it's too complex
    const allSimple = words.every(word => {
      // After splitting, each word should be an escaped literal
      // Try to unescape and see if it's a simple string
      const unescaped = word.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');
      
      // If unescaping changes the string, check if the escaping was valid
      if (unescaped !== word) {
        // Re-escape and compare to ensure it was properly escaped
        const reescaped = escapeRegex(unescaped);
        return reescaped === word;
      }
      
      // If no escaping was present, it's simple
      return true;
    });

    if (!allSimple) {
      return null;
    }

    // Unescape all words
    return words.map(word => word.replace(/\\([.*+?^${}()|[\]\\])/g, '$1'));
  } catch {
    return null;
  }
}
