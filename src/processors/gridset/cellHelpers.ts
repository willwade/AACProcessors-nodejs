/**
 * Grid3 Cell Helpers
 *
 * Utilities for working with Grid 3 cells, including finding button positions
 * and calculating cell spans in grid layouts.
 */

import type { AACPage, AACButton } from "../../core/treeStructure";

/**
 * Cell position with span information
 */
export interface CellPosition {
  /** X coordinate (column) */
  x: number;
  /** Y coordinate (row) */
  y: number;
  /** Number of columns the cell spans */
  columnSpan: number;
  /** Number of rows the cell spans */
  rowSpan: number;
}

/**
 * Find button position with span information
 *
 * Searches the page's grid layout for a button and calculates its position
 * and span (how many columns/rows it occupies).
 *
 * @param page - The AAC page containing the button
 * @param button - The button to locate
 * @param fallbackIndex - Index to use if button not found in grid
 * @returns Position and span information for the button
 *
 * @example
 * const position = findButtonPosition(page, button, 0);
 * console.log(`Button at ${position.x},${position.y} spans ${position.columnSpan}x${position.rowSpan}`);
 */
export function findButtonPosition(
  page: AACPage,
  button: AACButton,
  fallbackIndex: number,
): CellPosition {
  if (page.grid && page.grid.length > 0) {
    // Search for button in grid layout and calculate span
    for (let y = 0; y < page.grid.length; y++) {
      for (let x = 0; x < page.grid[y].length; x++) {
        const current = page.grid[y][x];
        if (current && current.id === button.id) {
          // Calculate span by checking how far the same button extends
          let columnSpan = 1;
          let rowSpan = 1;

          // Check column span (rightward)
          while (x + columnSpan < page.grid[y].length) {
            const right = page.grid[y][x + columnSpan];
            if (right && right.id === button.id) {
              columnSpan++;
            } else {
              break;
            }
          }

          // Check row span (downward)
          while (y + rowSpan < page.grid.length) {
            const below = page.grid[y + rowSpan][x];
            if (below && below.id === button.id) {
              rowSpan++;
            } else {
              break;
            }
          }

          return { x, y, columnSpan, rowSpan };
        }
      }
    }
  }

  // Fallback positioning
  const gridCols =
    page.grid?.[0]?.length || Math.ceil(Math.sqrt(page.buttons.length));
  return {
    x: fallbackIndex % gridCols,
    y: Math.floor(fallbackIndex / gridCols),
    columnSpan: 1,
    rowSpan: 1,
  };
}

/**
 * Calculate cell position key for Maps and Sets
 *
 * Creates a string key from X and Y coordinates for use as a Map key or Set entry.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns String key in format "x,y"
 *
 * @example
 * const key = cellPositionKey(5, 3);
 * console.log(key); // "5,3"
 */
export function cellPositionKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Parse cell position key
 *
 * Extracts X and Y coordinates from a position key string.
 *
 * @param key - Position key in format "x,y"
 * @returns Object with x and y properties
 *
 * @example
 * const pos = parseCellPositionKey("5,3");
 * console.log(pos); // { x: 5, y: 3 }
 */
export function parseCellPositionKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
