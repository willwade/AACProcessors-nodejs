/**
 * Gridset Generator
 *
 * Generates Grid3 gridset files from parsed templates
 */

import AdmZip from 'adm-zip';
import { XMLBuilder } from 'fast-xml-parser';
import { createDefaultStylesXml, ensureAlphaChannel } from '@willwade/aac-processors';
import { GridGeneratorTemplate, WordlistConfig, HomeGridConfig, StyleConfig } from './types.js';

const DEFAULT_GRID_BACKGROUND = '#E2EDF8FF';
const DEFAULT_LABEL_COLOUR = '#000000FF';
const DEFAULT_CELL_COLOUR = '#E8F4F8FF';
const DEFAULT_FONT_SIZE = 18;

interface TemplateStyleOptions {
  backgroundColour?: string;
  labelColour?: string;
  cellColour?: string;
  borderColour?: string;
  fontName?: string;
  fontSize?: number;
}

/**
 * Generates a Grid3 gridset from a template
 *
 * @param template - Parsed template configuration
 * @returns Gridset as a Buffer
 */
export function generateGridset(template: GridGeneratorTemplate): Buffer {
  const zip = new AdmZip();

  const templateStyles = resolveTemplateStyle(template.style);

  // Determine if we should create a home grid
  const homeGridConfig = template.homeGrid || {};
  const shouldCreateHomeGrid = homeGridConfig.enabled !== false; // Default to true
  const homeGridName = homeGridConfig.name || 'Home';
  const startGrid = shouldCreateHomeGrid ? homeGridName : template.wordlists[0]?.name || 'Grid1';

  // Create FileMap.xml
  const fileMap = createFileMap(template.wordlists, shouldCreateHomeGrid, homeGridName);
  zip.addFile('FileMap.xml', Buffer.from(fileMap, 'utf8'));

  // Create Settings0/settings.xml with proper start grid
  const settings = createSettings(startGrid);
  zip.addFile('Settings0/settings.xml', Buffer.from(settings, 'utf8'));

  // Create Settings0/styles.xml with default styles from library
  const styles = createDefaultStylesXml(true);
  zip.addFile('Settings0/styles.xml', Buffer.from(styles, 'utf8'));

  // Create home grid if enabled
  if (shouldCreateHomeGrid) {
    const homeGridXml = createHomeGridContent(homeGridConfig, template.wordlists, templateStyles);
    const gridPath = `Grids/${homeGridName}/grid.xml`;
    zip.addFile(gridPath, Buffer.from(homeGridXml, 'utf8'));
  }

  // Create a grid for each wordlist
  template.wordlists.forEach((wordlistConfig) => {
    const gridXml = createWordlistGrid(
      wordlistConfig,
      template,
      homeGridName,
      shouldCreateHomeGrid,
      templateStyles
    );
    const gridPath = `Grids/${wordlistConfig.name}/grid.xml`;
    zip.addFile(gridPath, Buffer.from(gridXml, 'utf8'));
  });

  return zip.toBuffer();
}

/**
 * Creates the FileMap.xml content
 */
function createFileMap(
  wordlists: WordlistConfig[],
  includeHome: boolean,
  homeGridName: string
): string {
  const grids: any[] = [];

  if (includeHome) {
    grids.push({
      Grid: {
        '@_Name': homeGridName,
        '@_Path': `Grids/${homeGridName}/grid.xml`,
      },
    });
  }

  wordlists.forEach((wl) => {
    grids.push({
      Grid: {
        '@_Name': wl.name,
        '@_Path': `Grids/${wl.name}/grid.xml`,
      },
    });
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const fileMapData = {
    FileMap: {
      Grids: {
        Grid: grids.length === 1 ? grids[0].Grid : grids.map((g) => g.Grid),
      },
    },
  };

  return builder.build(fileMapData);
}

/**
 * Creates the Settings0/settings.xml content with StartGrid element
 */
function createSettings(startGrid: string): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const settingsData = {
    GridSetSettings: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      StartGrid: startGrid,
    },
  };

  return builder.build(settingsData);
}

/**
 * Creates a home/index grid with navigation buttons to all wordlists
 */
function createHomeGridContent(
  config: HomeGridConfig,
  wordlists: WordlistConfig[],
  styleOptions: TemplateStyleOptions
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const columns = config.columns || 3;
  const rows = config.rows || 3;

  // Create navigation buttons for each wordlist
  const cells = wordlists.map((wordlist, index) => {
    const cellContent: any = {
      '@_X': String(index % columns),
      '@_Y': String(Math.floor(index / columns)),
      Content: {
        Commands: {
          Command: {
            '@_ID': 'Jump.To',
            Parameter: {
              '@_Key': 'grid',
              '#text': wordlist.name,
            },
          },
        },
        CaptionAndImage: {
          Caption: wordlist.name,
        },
        Style: buildCellStyle('Navigation category style', styleOptions),
      },
    };
    return { Cell: cellContent };
  });

  const columnDefs = Array(columns)
    .fill(null)
    .map(() => ({ ColumnDefinition: {} }));

  const rowDefs = Array(rows)
    .fill(null)
    .map(() => ({ RowDefinition: {} }));

  const gridData = {
    Grid: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      GridGuid: generateGuid(),
      BackgroundColour: styleOptions.backgroundColour || DEFAULT_GRID_BACKGROUND,
      ColumnDefinitions: {
        ColumnDefinition:
          columnDefs.length === 1
            ? columnDefs[0].ColumnDefinition
            : columnDefs.map((c) => c.ColumnDefinition),
      },
      RowDefinitions: {
        RowDefinition:
          rowDefs.length === 1 ? rowDefs[0].RowDefinition : rowDefs.map((r) => r.RowDefinition),
      },
      Cells: {
        Cell: cells.length === 1 ? cells[0].Cell : cells.map((c) => c.Cell),
      },
    },
  };

  return builder.build(gridData);
}

/**
 * Creates a grid XML with wordlist and back button
 */
function createWordlistGrid(
  wordlistConfig: WordlistConfig,
  template: GridGeneratorTemplate,
  homeGridName: string,
  hasHomeGrid: boolean,
  styleOptions: TemplateStyleOptions
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  // Create wordlist items
  const wordlistItems = wordlistConfig.items.map((text) => ({
    WordListItem: {
      Text: {
        s: {
          '@_Image': '',
          r: text,
        },
      },
      Image: '',
      PartOfSpeech: wordlistConfig.partOfSpeech || 'Unknown',
    },
  }));

  // Get layout config
  const layout = template.layout || {};
  const columns = layout.columns || 4;
  const rows = layout.rows || 4;

  // Create column and row definitions
  const columnDefs = Array(columns)
    .fill(null)
    .map(() => ({ ColumnDefinition: {} }));

  const rowDefs = Array(rows)
    .fill(null)
    .map(() => ({ RowDefinition: {} }));

  // Create cells with AutoContent for wordlist
  const cells: any[] = Array(columns * rows)
    .fill(null)
    .map((_, index) => ({
      Cell: {
        '@_X': String(index % columns),
        '@_Y': String(Math.floor(index / columns)),
        Content: {
          ContentType: 'AutoContent',
          ContentSubType: 'WordList',
          Style: buildCellStyle('Auto content', styleOptions),
        },
      },
    }));

  // Add back button if home grid exists
  if (hasHomeGrid) {
    cells.push({
      Cell: {
        '@_X': String((columns * rows) % columns),
        '@_Y': String(Math.floor((columns * rows) / columns)),
        Content: {
          Commands: {
            Command: {
              '@_ID': 'Jump.To',
              Parameter: {
                '@_Key': 'grid',
                '#text': homeGridName,
              },
            },
          },
          CaptionAndImage: {
            Caption: 'Back',
          },
          Style: buildCellStyle('Default', styleOptions),
        },
      },
    });
  }

  const gridData = {
    Grid: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      GridGuid: generateGuid(),
      BackgroundColour: styleOptions.backgroundColour || DEFAULT_GRID_BACKGROUND,
      ColumnDefinitions: {
        ColumnDefinition:
          columnDefs.length === 1
            ? columnDefs[0].ColumnDefinition
            : columnDefs.map((c) => c.ColumnDefinition),
      },
      RowDefinitions: {
        RowDefinition:
          rowDefs.length === 1 ? rowDefs[0].RowDefinition : rowDefs.map((r) => r.RowDefinition),
      },
      Cells: {
        Cell: cells.length === 1 ? cells[0].Cell : cells.map((c) => c.Cell),
      },
      WordList: {
        Items: {
          WordListItem:
            wordlistItems.length === 1
              ? wordlistItems[0].WordListItem
              : wordlistItems.map((i) => i.WordListItem),
        },
      },
    },
  };

  return builder.build(gridData);
}

/**
 * Generates a random GUID
 */
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveTemplateStyle(style?: StyleConfig): TemplateStyleOptions {
  if (!style) {
    return {
      fontSize: DEFAULT_FONT_SIZE,
    };
  }

  const options: TemplateStyleOptions = {};

  if (style.background) {
    options.backgroundColour = normalizeColour(style.background, DEFAULT_GRID_BACKGROUND);
  }

  if (style.labels) {
    options.labelColour = normalizeColour(style.labels, DEFAULT_LABEL_COLOUR);
  }

  const cellColourInput = style.cellColour ?? style.labelColour;
  if (cellColourInput) {
    const normalized = normalizeColour(cellColourInput, DEFAULT_CELL_COLOUR);
    options.cellColour = normalized;
    options.borderColour = darkenColour(normalized, 30);
  }

  if (style.fontFamily) {
    options.fontName = style.fontFamily;
  }

  const fontSize = style.fontSize ?? mapCellsizeToFontSize(style.cellsize) ?? DEFAULT_FONT_SIZE;
  options.fontSize = clampFontSize(fontSize);

  return options;
}

function buildCellStyle(baseStyle: string, styleOptions: TemplateStyleOptions) {
  const styleNode: Record<string, string | number> = {
    BasedOnStyle: baseStyle,
  };

  if (styleOptions.labelColour) {
    styleNode.FontColour = styleOptions.labelColour;
  }

  if (styleOptions.fontName) {
    styleNode.FontName = styleOptions.fontName;
  }

  if (typeof styleOptions.fontSize === 'number') {
    styleNode.FontSize = styleOptions.fontSize.toString();
  }

  if (styleOptions.cellColour) {
    styleNode.TileColour = styleOptions.cellColour;
    styleNode.BackColour = styleOptions.cellColour;
  }

  if (styleOptions.borderColour) {
    styleNode.BorderColour = styleOptions.borderColour;
  }

  return styleNode;
}

function mapCellsizeToFontSize(cellsize?: StyleConfig['cellsize']): number | undefined {
  if (!cellsize) {
    return undefined;
  }

  switch (cellsize) {
    case 'Small':
      return 16;
    case 'Medium':
      return 20;
    case 'Large':
      return 24;
    default:
      return undefined;
  }
}

function normalizeColour(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  const hex = toHexColour(trimmed);
  if (hex) {
    return ensureAlphaChannel(hex).toUpperCase();
  }

  return fallback;
}

function getNamedColour(name: string): string | undefined {
  const cssColours: Record<string, [number, number, number]> = {
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50],
  };

  const rgb = cssColours[name.toLowerCase()];
  if (!rgb) {
    return undefined;
  }

  return rgbaToHex(rgb[0], rgb[1], rgb[2], 1);
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const red = channelToHex(r);
  const green = channelToHex(g);
  const blue = channelToHex(b);
  const alpha = channelToHex(Math.round(a * 255));
  return `#${red}${green}${blue}${alpha}`;
}

function toHexColour(value: string): string | undefined {
  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      return `#${hex
        .split('')
        .map((char) => char + char)
        .join('')}`;
    }
    return `#${hex}`;
  }

  const rgbMatch = value.match(/^rgba?\((.+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 3 || parts.length === 4) {
      const [r, g, b, a] = parts;
      const red = clampColourChannel(parseFloat(r));
      const green = clampColourChannel(parseFloat(g));
      const blue = clampColourChannel(parseFloat(b));
      const alpha = parts.length === 4 ? clampAlpha(parseFloat(a)) : 1;
      return rgbaToHex(red, green, blue, alpha);
    }
  }

  const named = getNamedColour(value);
  if (named) {
    return named;
  }

  return undefined;
}

function channelToHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0').toUpperCase();
}

function clampColourChannel(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, value));
}

function clampAlpha(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

function clampFontSize(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_FONT_SIZE;
  }
  return Math.max(2, Math.min(84, value));
}

function darkenColour(hex: string, amount: number): string {
  const normalized = ensureAlphaChannel(hex).substring(1); // strip #
  const rgb = normalized.substring(0, 6);
  const alpha = normalized.substring(6) || 'FF';
  const r = parseInt(rgb.substring(0, 2), 16);
  const g = parseInt(rgb.substring(2, 4), 16);
  const b = parseInt(rgb.substring(4, 6), 16);
  const clamp = (val: number) => Math.max(0, Math.min(255, val));
  const newR = clamp(r - amount);
  const newG = clamp(g - amount);
  const newB = clamp(b - amount);
  return `#${channelToHex(newR)}${channelToHex(newG)}${channelToHex(newB)}${alpha.toUpperCase()}`;
}
