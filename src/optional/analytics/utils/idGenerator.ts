/**
 * ID Generator Utility for AAC Metrics
 *
 * Generates clone_id values based on grid location and button label.
 * Clone IDs help identify buttons that appear in the same location
 * across different boards in an AAC system.
 */

/**
 * Normalize a label for use in clone_id generation
 * Converts to lowercase, removes apostrophes, trims whitespace
 *
 * @param label - The button label to normalize
 * @returns Normalized label string
 */
export function normalizeLabelForCloneId(label: string): string {
  return label
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
}

/**
 * Generate a clone_id based on grid location and button label
 *
 * Clone ID format: "{rows}x{cols}-{row}.{col}-{label_normalized}"
 * Example: "6x4-2.3-more" for button "more" at row 2, col 3 in a 6x4 grid
 *
 * @param rows - Total number of rows in the grid
 * @param cols - Total number of columns in the grid
 * @param row - Zero-based row index of the button
 * @param col - Zero-based column index of the button
 * @param label - The button label
 * @returns A clone_id string
 */
export function generateCloneId(
  rows: number,
  cols: number,
  row: number,
  col: number,
  label: string
): string {
  const normalizedLabel = normalizeLabelForCloneId(label);
  return `${rows}x${cols}-${row}.${col}-${normalizedLabel}`;
}

/**
 * Generate a semantic_id based on button content
 *
 * Semantic IDs identify buttons with the same semantic meaning across boards.
 * This is a fallback for formats that don't have explicit semantic IDs.
 * Based on hash of message + label
 *
 * @param message - The button message/vocalization
 * @param label - The button label
 * @returns A semantic_id string (hash-based)
 */
export function generateSemanticId(message: string, label: string): string {
  const content = `${message || ''}::${label || ''}`;
  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  // Convert to positive hex string
  return `semantic_${(hash >>> 0).toString(16)}`;
}

/**
 * Extract all semantic_ids from a page's buttons
 *
 * @param buttons - Array of buttons to scan
 * @returns Array of unique semantic_id strings
 */
export function extractSemanticIds(buttons: Array<{ semantic_id?: string }>): string[] {
  const ids = new Set<string>();
  for (const button of buttons) {
    if (button.semantic_id) {
      ids.add(button.semantic_id);
    }
  }
  return Array.from(ids);
}

/**
 * Extract all clone_ids from a page's buttons
 *
 * @param buttons - Array of buttons to scan
 * @returns Array of unique clone_id strings
 */
export function extractCloneIds(buttons: Array<{ clone_id?: string }>): string[] {
  const ids = new Set<string>();
  for (const button of buttons) {
    if (button.clone_id) {
      ids.add(button.clone_id);
    }
  }
  return Array.from(ids);
}
