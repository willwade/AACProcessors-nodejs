/**
 * Grid3 Style Helpers
 *
 * Utilities for creating and managing Grid3 styles, including default styles,
 * style XML generation, and style conversion utilities.
 */

import { XMLBuilder } from 'fast-xml-parser';
import { ensureAlphaChannel, darkenColor } from './colorUtils';

/**
 * Cell background shapes supported by Grid 3
 * Maps to Grid 3's CellBackgroundShape enum
 */
export enum CellBackgroundShape {
  Rectangle = 0,
  RoundedRectangle = 1,
  FoldedCorner = 2,
  Octagon = 3,
  Folder = 4,
  Ellipse = 5,
  SpeechBubble = 6,
  ThoughtBubble = 7,
  Star = 8,
  Circle = 9,
  ColouredCorner = 10,
}

/**
 * Human-readable shape names
 */
export const SHAPE_NAMES: Record<CellBackgroundShape, string> = {
  [CellBackgroundShape.Rectangle]: 'Rectangle',
  [CellBackgroundShape.RoundedRectangle]: 'Rounded Rectangle',
  [CellBackgroundShape.FoldedCorner]: 'Folded Corner',
  [CellBackgroundShape.Octagon]: 'Octagon',
  [CellBackgroundShape.Folder]: 'Folder',
  [CellBackgroundShape.Ellipse]: 'Ellipse',
  [CellBackgroundShape.SpeechBubble]: 'Speech Bubble',
  [CellBackgroundShape.ThoughtBubble]: 'Thought Bubble',
  [CellBackgroundShape.Star]: 'Star',
  [CellBackgroundShape.Circle]: 'Circle',
  [CellBackgroundShape.ColouredCorner]: 'Coloured Corner',
};

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
  BackgroundShape?: CellBackgroundShape;
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
 * Re-export ensureAlphaChannel from colorUtils for backward compatibility
 * @deprecated Use ensureAlphaChannel from colorUtils instead
 */
export { ensureAlphaChannel } from './colorUtils';

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
