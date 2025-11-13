/**
 * Extracts suggested patterns from text with increasing specificity
 * Returns 3 levels: short, medium, long
 */
export function extractPatternSuggestions(text: string): string[] {
  if (!text || !text.trim()) {
    return [];
  }

  const cleaned = text.trim();
  
  // Split by various separators (spaces, numbers, special chars)
  const parts = cleaned.split(/[\s,;:\-_/\\]+/).filter(p => p.length > 0);
  
  // Remove common noise words and short parts
  const filtered = parts.filter(p => 
    p.length >= 3 && 
    !/^\d+$/.test(p) && // Not just numbers
    !/^[^a-zA-Z]+$/.test(p) // Not just special chars
  );

  if (filtered.length === 0) {
    // Fallback: use first meaningful word
    const firstWord = parts.find(p => p.length >= 3);
    return firstWord ? [firstWord] : [];
  }

  const suggestions: string[] = [];

  // Level 1: Short - First meaningful word
  if (filtered[0]) {
    suggestions.push(filtered[0]);
  }

  // Level 2: Medium - First 2 words
  if (filtered.length >= 2) {
    suggestions.push(filtered.slice(0, 2).join(' '));
  } else if (filtered.length === 1 && parts.length >= 2) {
    // Try with unfiltered if we don't have enough filtered
    suggestions.push(parts.slice(0, 2).join(' '));
  }

  // Level 3: Long - First 3 words or up to reasonable length
  if (filtered.length >= 3) {
    suggestions.push(filtered.slice(0, 3).join(' '));
  } else if (filtered.length === 2 && parts.length >= 3) {
    suggestions.push(parts.slice(0, 3).join(' '));
  } else if (cleaned.length <= 50) {
    // If text is short enough, include full text
    suggestions.push(cleaned);
  }

  // Remove duplicates and ensure increasing specificity
  return Array.from(new Set(suggestions));
}

/**
 * Calculates automatic weight based on pattern specificity
 * Longer, more specific patterns get higher weights
 */
export function calculatePatternWeight(pattern: string): number {
  // Base weight: 1-10 scale
  // Simple heuristic: longer patterns are more specific
  const length = pattern.trim().length;
  const wordCount = pattern.trim().split(/\s+/).length;

  // Weight calculation:
  // - 1-5 chars: weight 2
  // - 6-10 chars: weight 3
  // - 11-20 chars: weight 5
  // - 21-30 chars: weight 7
  // - 31+ chars: weight 9
  // Bonus: +1 for each additional word (up to +3)

  let weight = 2; // Base weight

  if (length > 30) {
    weight = 9;
  } else if (length > 20) {
    weight = 7;
  } else if (length > 10) {
    weight = 5;
  } else if (length > 5) {
    weight = 3;
  }

  // Add word count bonus (max +3)
  const wordBonus = Math.min(wordCount - 1, 3);
  weight += wordBonus;

  // Ensure weight is in range 1-10
  return Math.max(1, Math.min(10, weight));
}
