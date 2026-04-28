/**
 * Grid3 Grid Calculations
 *
 * Utilities for calculating grid dimensions and definitions
 * based on page layout and button count.
 */

import type { AACPage } from '../../core/treeStructure';

/**
 * Grid definition structure for Grid 3 XML
 */
export interface GridDefinitions {
  ColumnDefinition: any[];
}

export interface RowDefinitions {
  RowDefinition: any[];
}

/**
 * Calculate column definitions based on page layout
 *
 * Analyzes the page's grid structure to determine the number of columns.
 * If no grid exists, estimates from button count.
 *
 * @param page - The AAC page to analyze
 * @returns Column definitions object for Grid 3 XML
 *
 * @example
 * const columns = calculateColumnDefinitions(page);
 * // Returns: { ColumnDefinition: [{}, {}, {}, {}] } for 4 columns
 */
export function calculateColumnDefinitions(page: AACPage): GridDefinitions {
  let maxCols = 4; // Default minimum

  if (page.grid && page.grid.length > 0) {
    maxCols = Math.max(maxCols, page.grid[0]?.length || 0);
  } else {
    // Fallback: estimate from button count
    maxCols = Math.max(4, Math.ceil(Math.sqrt(page.buttons.length)));
  }

  return {
    ColumnDefinition: Array(maxCols).fill({}),
  };
}

/**
 * Calculate row definitions based on page layout
 *
 * Analyzes the page's grid structure to determine the number of rows.
 * If no grid exists, estimates from button count.
 *
 * @param page - The AAC page to analyze
 * @param addWorkspaceOffset - Whether to add 1 row for workspace (default: false)
 * @returns Row definitions object for Grid 3 XML
 *
 * @example
 * const rows = calculateRowDefinitions(page, false);
 * // Returns: { RowDefinition: [{}, {}, {}, {}] } for 4 rows
 */
export function calculateRowDefinitions(page: AACPage, addWorkspaceOffset = false): RowDefinitions {
  let maxRows = 4; // Default minimum
  const offset = addWorkspaceOffset ? 1 : 0;

  if (page.grid && page.grid.length > 0) {
    maxRows = Math.max(maxRows, page.grid.length + offset);
  } else {
    // Fallback: estimate from button count
    const estimatedCols = Math.ceil(Math.sqrt(page.buttons.length));
    maxRows = Math.max(4, Math.ceil(page.buttons.length / estimatedCols)) + offset;
  }

  return {
    RowDefinition: Array(maxRows).fill({}),
  };
}
