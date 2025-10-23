/**
 * Grid3 Style Helpers
 * 
 * Utilities for creating and managing Grid3 styles, including default styles,
 * style XML generation, and style conversion utilities.
 */

import { XMLBuilder } from 'fast-xml-parser';

/**
 * Grid3 Style object structure
 */
export interface Grid3Style {
  BackColour?: string;
  TileColour?: string;
  BorderColour?: string;
  FontColour?: string;
  FontName?: string;
  FontSize?: string | number;
}

/**
 * Default Grid3 styles for common use cases
 * Colors are in 8-digit ARGB hex format (#AARRGGBBFF)
 */
export const DEFAULT_GRID3_STYLES: Record<string, Grid3Style> = {
  Default: {
    BackColour: '#E2EDF8FF',
    TileColour: '#FFFFFFFF',
    BorderColour: '#000000FF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '16',
  },
  Workspace: {
    BackColour: '#FFFFFFFF',
    TileColour: '#FFFFFFFF',
    BorderColour: '#CCCCCCFF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '14',
  },
  'Auto content': {
    BackColour: '#E8F4F8FF',
    TileColour: '#E8F4F8FF',
    BorderColour: '#2C82C9FF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '14',
  },
  'Vocab cell': {
    BackColour: '#E8F4F8FF',
    TileColour: '#E8F4F8FF',
    BorderColour: '#2C82C9FF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '14',
  },
  'Keyboard key': {
    BackColour: '#F0F0F0FF',
    TileColour: '#F0F0F0FF',
    BorderColour: '#808080FF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '12',
  },
};

/**
 * Category-specific styles for navigation and organization
 */
export const CATEGORY_STYLES: Record<string, Grid3Style> = {
  'Actions category style': {
    BackColour: '#4472C4FF',
    TileColour: '#4472C4FF',
    BorderColour: '#2F5496FF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'People category style': {
    BackColour: '#ED7D31FF',
    TileColour: '#ED7D31FF',
    BorderColour: '#C65911FF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'Places category style': {
    BackColour: '#A5A5A5FF',
    TileColour: '#A5A5A5FF',
    BorderColour: '#595959FF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'Descriptive category style': {
    BackColour: '#70AD47FF',
    TileColour: '#70AD47FF',
    BorderColour: '#4F7C2FFF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'Social category style': {
    BackColour: '#FFC000FF',
    TileColour: '#FFC000FF',
    BorderColour: '#BF8F00FF',
    FontColour: '#000000FF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'Questions category style': {
    BackColour: '#5B9BD5FF',
    TileColour: '#5B9BD5FF',
    BorderColour: '#2E5C8AFF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
  'Little words category style': {
    BackColour: '#C55A11FF',
    TileColour: '#C55A11FF',
    BorderColour: '#8B3F0AFF',
    FontColour: '#FFFFFFFF',
    FontName: 'Arial',
    FontSize: '16',
  },
};

/**
 * Ensure a color has an alpha channel (Grid3 format requires 8-digit ARGB)
 * @param color - Color string (hex format)
 * @returns Color with alpha channel in format #AARRGGBBFF
 */
export function ensureAlphaChannel(color: string | undefined): string {
  if (!color) return '#FFFFFFFF';
  // If already 8 digits (with alpha), return as is
  if (color.match(/^#[0-9A-Fa-f]{8}$/)) return color;
  // If 6 digits (no alpha), add FF for fully opaque
  if (color.match(/^#[0-9A-Fa-f]{6}$/)) return color + 'FF';
  // If 3 digits (shorthand), expand to 8
  if (color.match(/^#[0-9A-Fa-f]{3}$/)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}FF`;
  }
  // Invalid or unknown format, return white
  return '#FFFFFFFF';
}

/**
 * Create a Grid3 style XML string with default and category styles
 * @param includeCategories - Whether to include category-specific styles (default: true)
 * @returns XML string for Settings0/styles.xml
 */
export function createDefaultStylesXml(includeCategories: boolean = true): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const styles = { ...DEFAULT_GRID3_STYLES };
  if (includeCategories) {
    Object.assign(styles, CATEGORY_STYLES);
  }

  const styleArray = Object.entries(styles).map(([key, style]) => ({
    '@_Key': key,
    BackColour: style.BackColour,
    TileColour: style.TileColour,
    BorderColour: style.BorderColour,
    FontColour: style.FontColour,
    FontName: style.FontName,
    FontSize: style.FontSize?.toString(),
  }));

  const stylesData = {
    StyleData: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      Styles: {
        Style: styleArray,
      },
    },
  };

  return builder.build(stylesData);
}

/**
 * Create a custom category style
 * @param categoryName - Name of the category
 * @param backgroundColor - Background color in hex format
 * @param fontColor - Font color in hex format (default: white)
 * @returns Grid3Style object
 */
export function createCategoryStyle(
  categoryName: string,
  backgroundColor: string,
  fontColor: string = '#FFFFFFFF'
): Grid3Style {
  return {
    BackColour: ensureAlphaChannel(backgroundColor),
    TileColour: ensureAlphaChannel(backgroundColor),
    BorderColour: ensureAlphaChannel(darkenColor(backgroundColor, 30)),
    FontColour: ensureAlphaChannel(fontColor),
    FontName: 'Arial',
    FontSize: '16',
  };
}

/**
 * Darken a hex color by a given amount
 * @param hexColor - Hex color string
 * @param amount - Amount to darken (0-255)
 * @returns Darkened hex color
 */
function darkenColor(hexColor: string, amount: number): string {
  const normalized = ensureAlphaChannel(hexColor);
  const hex = normalized.slice(1, 7); // Extract RGB part (skip # and alpha)
  const num = parseInt(hex, 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 0xff) - amount);
  const g = clamp(((num >> 8) & 0xff) - amount);
  const b = clamp((num & 0xff) - amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

