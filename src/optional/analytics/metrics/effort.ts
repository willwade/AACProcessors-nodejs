/**
 * Effort Score Calculation Algorithms
 *
 * Implements the core effort calculation algorithms from the Ruby aac-metrics tool.
 * These algorithms calculate how difficult it is to access each button based on
 * distance, visual scanning, grid complexity, and motor planning support.
 */

/**
 * Constants for effort score calculation
 * Values match the Ruby implementation exactly
 */
export const EFFORT_CONSTANTS = {
  SQRT2: Math.sqrt(2),
  BUTTON_SIZE_MULTIPLIER: 0.09,
  FIELD_SIZE_MULTIPLIER: 0.005,
  VISUAL_SCAN_MULTIPLIER: 0.015,
  BOARD_CHANGE_PROCESSING_EFFORT: 1.0,
  BOARD_HOME_EFFORT: 1.0,
  COMBINED_WORDS_REMEMBERING_EFFORT: 1.0,
  DISTANCE_MULTIPLIER: 0.4,
  DISTANCE_THRESHOLD_TO_SKIP_VISUAL_SCAN: 0.1,
  SKIPPED_VISUAL_SCAN_DISTANCE_MULTIPLIER: 0.5,
  SAME_LOCATION_AS_PRIOR_DISCOUNT: 0.1,
  RECOGNIZABLE_SEMANTIC_FROM_PRIOR_DISCOUNT: 0.5,
  RECOGNIZABLE_SEMANTIC_FROM_OTHER_DISCOUNT: 0.5,
  REUSED_SEMANTIC_FROM_OTHER_BONUS: 0.0025,
  RECOGNIZABLE_CLONE_FROM_PRIOR_DISCOUNT: 0.33,
  RECOGNIZABLE_CLONE_FROM_OTHER_DISCOUNT: 0.33,
  REUSED_CLONE_FROM_OTHER_BONUS: 0.005,
  SCAN_STEP_COST: 0.015, // Matches visual scan multiplier
  SCAN_SELECTION_COST: 0.1, // Cost of a switch selection
} as const;

/**
 * Calculate button size effort based on grid dimensions
 * Larger grids require more visual scanning and discrimination
 *
 * @param rows - Number of rows in the grid
 * @param cols - Number of columns in the grid
 * @returns Button size effort score
 */
export function buttonSizeEffort(rows: number, cols: number): number {
  return EFFORT_CONSTANTS.BUTTON_SIZE_MULTIPLIER * ((rows + cols) / 2);
}

/**
 * Calculate field size effort based on number of visible buttons
 * More buttons = more visual clutter = higher effort
 *
 * @param buttonCount - Number of visible buttons on the board
 * @returns Field size effort score
 */
export function fieldSizeEffort(buttonCount: number): number {
  return EFFORT_CONSTANTS.FIELD_SIZE_MULTIPLIER * buttonCount;
}

/**
 * Calculate visual scanning effort
 * Effort increases with each button that must be scanned before reaching target
 *
 * @param priorButtons - Number of buttons visually scanned before target
 * @returns Visual scan effort score
 */
export function visualScanEffort(priorButtons: number): number {
  return priorButtons * EFFORT_CONSTANTS.VISUAL_SCAN_MULTIPLIER;
}

/**
 * Calculate distance effort from entry point to button center
 * Uses Euclidean distance normalized by sqrt(2)
 *
 * @param x - Button center X coordinate (0-1 normalized)
 * @param y - Button center Y coordinate (0-1 normalized)
 * @param entryX - Entry point X coordinate (0-1 normalized, default 1.0 = bottom-right)
 * @param entryY - Entry point Y coordinate (0-1 normalized, default 1.0 = bottom-right)
 * @returns Distance effort score
 */
export function distanceEffort(
  x: number,
  y: number,
  entryX: number = 1.0,
  entryY: number = 1.0,
): number {
  const distance = Math.sqrt(Math.pow(x - entryX, 2) + Math.pow(y - entryY, 2));
  return (
    (distance / EFFORT_CONSTANTS.SQRT2) * EFFORT_CONSTANTS.DISTANCE_MULTIPLIER
  );
}

/**
 * Calculate spelling effort for words not available in the board set
 * Base cost + per-letter cost
 *
 * @param word - The word to spell
 * @returns Spelling effort score
 */
export function spellingEffort(word: string): number {
  return 10 + word.length * 2.5;
}

/**
 * Calculate base board effort
 * Combines button size and field size efforts
 *
 * @param rows - Number of rows in the grid
 * @param cols - Number of columns in the grid
 * @param buttonCount - Number of visible buttons
 * @returns Base board effort score
 */
export function baseBoardEffort(
  rows: number,
  cols: number,
  buttonCount: number,
): number {
  const sizeEffort = buttonSizeEffort(rows, cols);
  const fieldEffort = fieldSizeEffort(buttonCount);
  return sizeEffort + fieldEffort;
}

/**
 * Apply reuse discount based on semantic_id/clone_id frequency
 *
 * @param boardEffort - Current board effort
 * @param reuseDiscount - Calculated reuse discount
 * @returns Adjusted board effort
 */
export function applyReuseDiscount(
  boardEffort: number,
  reuseDiscount: number,
): number {
  return Math.max(0, boardEffort - reuseDiscount);
}

/**
 * Calculate button-level effort with motor planning discounts
 *
 * @param baseEffort - Base board effort
 * @param boardPcts - Percentage of links matching semantic_id/clone_id
 * @param button - Button data
 * @returns Adjusted button effort
 */
export function calculateButtonEffort(
  baseEffort: number,
  boardPcts: { [id: string]: number },
  button: { semantic_id?: string; clone_id?: string },
): number {
  let buttonEffort = baseEffort;

  // Apply discounts for semantic_id
  if (button.semantic_id && boardPcts[button.semantic_id]) {
    const discount =
      EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
      boardPcts[button.semantic_id];
    buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
  }

  // Apply discounts for clone_id
  if (button.clone_id && boardPcts[button.clone_id]) {
    const discount =
      EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
      boardPcts[button.clone_id];
    buttonEffort = Math.min(buttonEffort, buttonEffort * discount);
  }

  return buttonEffort;
}

/**
 * Calculate distance with motor planning discounts
 *
 * @param distance - Raw distance effort
 * @param boardPcts - Percentage of links matching semantic_id/clone_id
 * @param button - Button data
 * @param setPcts - Percentage of boards containing semantic_id/clone_id
 * @returns Adjusted distance effort
 */
export function calculateDistanceWithDiscounts(
  distance: number,
  boardPcts: { [id: string]: number },
  button: { semantic_id?: string; clone_id?: string },
  setPcts: { [id: string]: number },
): number {
  let adjustedDistance = distance;

  // Apply semantic_id discounts
  if (button.semantic_id) {
    if (boardPcts[button.semantic_id]) {
      const discount =
        EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
        boardPcts[button.semantic_id];
      adjustedDistance = Math.min(
        adjustedDistance,
        adjustedDistance * discount,
      );
    } else if (setPcts[button.semantic_id]) {
      const discount =
        EFFORT_CONSTANTS.RECOGNIZABLE_SEMANTIC_FROM_OTHER_DISCOUNT /
        setPcts[button.semantic_id];
      adjustedDistance = Math.min(
        adjustedDistance,
        adjustedDistance * discount,
      );
    }
  }

  // Apply clone_id discounts
  if (button.clone_id) {
    if (boardPcts[button.clone_id]) {
      const discount =
        EFFORT_CONSTANTS.SAME_LOCATION_AS_PRIOR_DISCOUNT /
        boardPcts[button.clone_id];
      adjustedDistance = Math.min(
        adjustedDistance,
        adjustedDistance * discount,
      );
    } else if (setPcts[button.clone_id]) {
      const discount =
        EFFORT_CONSTANTS.RECOGNIZABLE_CLONE_FROM_OTHER_DISCOUNT /
        setPcts[button.clone_id];
      adjustedDistance = Math.min(
        adjustedDistance,
        adjustedDistance * discount,
      );
    }
  }

  return adjustedDistance;
}

/**
 * Check if visual scan should be skipped (button close to previous)
 *
 * @param distance - Distance from previous button
 * @returns True if close enough to skip full visual scan
 */
export function shouldSkipVisualScan(distance: number): boolean {
  return distance < EFFORT_CONSTANTS.DISTANCE_THRESHOLD_TO_SKIP_VISUAL_SCAN;
}

/**
 * Calculate local scan effort when buttons are close
 *
 * @param distance - Distance between buttons
 * @returns Local scan effort
 */
export function localScanEffort(distance: number): number {
  return distance * EFFORT_CONSTANTS.SKIPPED_VISUAL_SCAN_DISTANCE_MULTIPLIER;
}

/**
 * Calculate effort for switch scanning
 *
 * @param steps - Number of scan steps to reach target
 * @param selections - Number of switch selections required
 * @returns Scanning effort score
 */
export function scanningEffort(steps: number, selections: number): number {
  return (
    steps * EFFORT_CONSTANTS.SCAN_STEP_COST +
    selections * EFFORT_CONSTANTS.SCAN_SELECTION_COST
  );
}
