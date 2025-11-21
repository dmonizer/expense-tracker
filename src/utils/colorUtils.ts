/**
 * Color utility functions for category group color families
 */

/**
 * Parse HSL color string to components
 */
export function parseHSL(hslString: string): { h: number; s: number; l: number; a?: number } {
  const match = hslString.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
  if (!match) {
    throw new Error(`Invalid HSL color string: ${hslString}`);
  }
  return {
      h: Number.parseInt(match[1], 10),
      s: Number.parseInt(match[2], 10),
      l: Number.parseInt(match[3], 10),
      a: match[4] ? Number.parseFloat(match[4]) : undefined,
  };
}

/**
 * Convert HSL components to CSS string
 */
export function hslToString(h: number, s: number, l: number, a?: number): string {
  // Normalize values
  h = ((h % 360) + 360) % 360; // Keep in 0-360 range
  s = Math.max(0, Math.min(100, s)); // Clamp 0-100
  l = Math.max(0, Math.min(100, l)); // Clamp 0-100
  
  if (a !== undefined) {
    const normalizedA = Math.max(0, Math.min(1, a));
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${normalizedA})`;
  }
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Generate color variations for categories within a group
 * Creates visually distinct but related colors from a base color
 * 
 * @param baseColor - Base HSL color string (e.g., "hsl(0, 70%, 50%)")
 * @param count - Number of variations to generate
 * @returns Array of HSL color strings
 */
export function generateColorVariations(baseColor: string, count: number): string[] {
  const { h, s, l, a } = parseHSL(baseColor);
  const variations: string[] = [];

  // First variation is always the base color
  variations.push(hslToString(h, s, l, a));

  if (count === 1) return variations;

  // Strategy: alternate between lighter/darker and hue shifts
  // This creates a balanced set of related but distinct colors
  for (let i = 1; i < count; i++) {
    const offset = Math.ceil(i / 2);
    const isEven = i % 2 === 0;

    if (isEven) {
      // Even indices: shift hue and adjust lightness slightly darker
      const newH = h + (offset * 8); // +8° hue shift
      const newL = Math.max(25, l - (offset * 3)); // Darker
      const newS = Math.min(85, s + (offset * 2)); // More saturated
      variations.push(hslToString(newH, newS, newL, a));
    } else {
      // Odd indices: shift hue opposite direction and lighten
      const newH = h - (offset * 8); // -8° hue shift
      const newL = Math.min(75, l + (offset * 3)); // Lighter
      const newS = Math.max(40, s - (offset * 2)); // Less saturated
      variations.push(hslToString(newH, newS, newL, a));
    }
  }

  return variations;
}

/**
 * Get the color for a specific category based on its group and variant
 * 
 * @param baseColor - Group's base color
 * @param variantIndex - Category's color variant index (0 = base)
 * @param totalVariants - Total number of categories in the group (for optimization)
 * @returns HSL color string
 */
export function getCategoryColor(
  baseColor: string, 
  variantIndex: number = 0,
  totalVariants?: number
): string {
  if (variantIndex === 0) {
    return baseColor;
  }

  // Generate enough variations to cover the requested variant
  const needed = totalVariants || variantIndex + 1;
  const variations = generateColorVariations(baseColor, needed);
  
  return variations[variantIndex] || variations[0];
}

/**
 * Predefined base colors for default category groups
 */
export const DEFAULT_GROUP_COLORS = {
  critical: 'hsl(0, 70%, 50%)',      // Red
  important: 'hsl(30, 85%, 55%)',    // Orange
  optional: 'hsl(210, 70%, 55%)',    // Blue
  income: 'hsl(145, 65%, 45%)',      // Green
  savings: 'hsl(270, 60%, 55%)',     // Purple
  uncategorized: 'hsl(0, 0%, 60%)',  // Gray
};

/**
 * Get a predefined color palette for color picker UI
 * Returns 12 distinct base colors suitable for category groups
 */
export function getColorPalette(): string[] {
  return [
    'hsl(0, 70%, 50%)',    // Red
    'hsl(20, 85%, 55%)',   // Red-Orange
    'hsl(30, 85%, 55%)',   // Orange
    'hsl(45, 90%, 55%)',   // Yellow-Orange
    'hsl(145, 65%, 45%)',  // Green
    'hsl(170, 60%, 45%)',  // Teal
    'hsl(195, 70%, 50%)',  // Cyan
    'hsl(210, 70%, 55%)',  // Blue
    'hsl(240, 65%, 60%)',  // Indigo
    'hsl(270, 60%, 55%)',  // Purple
    'hsl(330, 70%, 55%)',  // Magenta
    'hsl(0, 0%, 60%)',     // Gray
  ];
}
