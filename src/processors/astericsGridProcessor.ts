import {
  BaseProcessor,
  ProcessorOptions,
  ExtractStringsResult,
  TranslatedString,
  SourceString,
} from '../core/baseProcessor';
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
  AstericsGridMetadata,
} from '../core/treeStructure';
import {
  ValidationFailureError,
  buildValidationResultFromMessage,
} from '../validation/validationTypes';
import {
  ProcessorInput,
  getBasename,
  getFs,
  readBinaryFromInput,
  readTextFromInput,
  writeTextToPath,
  encodeBase64,
} from '../utils/io';

// Asterics Grid data model interfaces
interface GridData {
  id: string;
  modelName: string;
  modelVersion: string;
  label: { [lang: string]: string };
  rowCount: number;
  columnCount?: number;
  minColumnCount?: number;
  gridElements: GridElement[];
  thumbnail?: {
    data: string;
    hash: string;
  };
}

interface GridElement {
  id: string;
  modelName: string;
  modelVersion: string;
  width: number;
  height: number;
  x: number;
  y: number;
  label: { [lang: string]: string };
  wordForms?: WordForm[];
  image?: GridImage;
  backgroundColor?: string;
  fontColor?: string;
  colorCategory?: string;
  actions: GridAction[];
  dontCollect?: boolean;
  type?: string;
  additionalProps?: any;
  hidden?: boolean; // Asterics Grid uses boolean hidden field
}

interface GridImage {
  id?: string;
  data?: string | null;
  url?: string;
  author?: string;
  authorURL?: string;
  searchProviderName?: string;
  searchProviderOptions?: any[];
}

interface WordForm {
  lang?: string;
  tags: string[];
  value: string;
  pronunciation?: string;
  base?: string;
}

interface GridAction {
  id: string;
  modelName: string;
  modelVersion?: string;
  [key: string]: any; // For action-specific properties
}

interface AstericsGridFile {
  grids: GridData[];
  metadata?: any;
}

interface AstericsColorConfig {
  additionalColorSchemes?: unknown[];
  colorSchemesActivated?: boolean;
  activeColorScheme?: string;
  colorMode?: string;
  gridBackgroundColor?: string;
  elementBackgroundColor?: string;
  elementBorderColor?: string;
  fontColor?: string;
  borderWidth?: number;
  fontFamily?: string;
  fontSizePct?: number;
}

interface ColorSchemeDefinition {
  name: string;
  categories: string[];
  colors: string[];
  mappings?: Record<string, string>;
  customBorders?: Record<string, string>;
}

const DEFAULT_COLOR_SCHEME_DEFINITIONS: ColorSchemeDefinition[] = [
  {
    name: 'CS_MODIFIED_FITZGERALD_KEY_VERY_LIGHT',
    categories: [
      'CC_PRONOUN_PERSON_NAME',
      'CC_NOUN',
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_SOCIAL_EXPRESSIONS',
      'CC_MISC',
      'CC_PLACE',
      'CC_CATEGORY',
      'CC_IMPORTANT',
      'CC_OTHERS',
    ],
    colors: [
      '#fafad0',
      '#fbf3e4',
      '#dff4df',
      '#eaeffd',
      '#fff0f6',
      '#ffffff',
      '#fbf2ff',
      '#ddccc1',
      '#FCE8E8',
      '#e4e4e4',
    ],
    mappings: {
      CC_ADJECTIVE: 'CC_DESCRIPTOR',
      CC_ADVERB: 'CC_DESCRIPTOR',
      CC_ARTICLE: 'CC_MISC',
      CC_PREPOSITION: 'CC_MISC',
      CC_CONJUNCTION: 'CC_MISC',
      CC_INTERJECTION: 'CC_SOCIAL_EXPRESSIONS',
    },
  },
  {
    name: 'CS_MODIFIED_FITZGERALD_KEY_LIGHT',
    categories: [
      'CC_PRONOUN_PERSON_NAME',
      'CC_NOUN',
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_SOCIAL_EXPRESSIONS',
      'CC_MISC',
      'CC_PLACE',
      'CC_CATEGORY',
      'CC_IMPORTANT',
      'CC_OTHERS',
    ],
    colors: [
      '#fdfd96',
      '#ffda89',
      '#c7f3c7',
      '#84b6f4',
      '#fdcae1',
      '#ffffff',
      '#bc98f3',
      '#d8af97',
      '#ff9688',
      '#bdbfbf',
    ],
    mappings: {
      CC_ADJECTIVE: 'CC_DESCRIPTOR',
      CC_ADVERB: 'CC_DESCRIPTOR',
      CC_ARTICLE: 'CC_MISC',
      CC_PREPOSITION: 'CC_MISC',
      CC_CONJUNCTION: 'CC_MISC',
      CC_INTERJECTION: 'CC_SOCIAL_EXPRESSIONS',
    },
  },
  {
    name: 'CS_MODIFIED_FITZGERALD_KEY_MEDIUM',
    categories: [
      'CC_PRONOUN_PERSON_NAME',
      'CC_NOUN',
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_SOCIAL_EXPRESSIONS',
      'CC_MISC',
      'CC_PLACE',
      'CC_CATEGORY',
      'CC_IMPORTANT',
      'CC_OTHERS',
    ],
    colors: [
      '#ffff6b',
      '#ffb56b',
      '#b5ff6b',
      '#6bb5ff',
      '#ff6bff',
      '#ffffff',
      '#ce6bff',
      '#bf9075',
      '#ff704d',
      '#a3a3a3',
    ],
    mappings: {
      CC_ADJECTIVE: 'CC_DESCRIPTOR',
      CC_ADVERB: 'CC_DESCRIPTOR',
      CC_ARTICLE: 'CC_MISC',
      CC_PREPOSITION: 'CC_MISC',
      CC_CONJUNCTION: 'CC_MISC',
      CC_INTERJECTION: 'CC_SOCIAL_EXPRESSIONS',
    },
  },
  {
    name: 'CS_MODIFIED_FITZGERALD_KEY_DARK',
    categories: [
      'CC_PRONOUN_PERSON_NAME',
      'CC_NOUN',
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_SOCIAL_EXPRESSIONS',
      'CC_MISC',
      'CC_PLACE',
      'CC_CATEGORY',
      'CC_IMPORTANT',
      'CC_OTHERS',
    ],
    colors: [
      '#79791F',
      '#804c26',
      '#4c8026',
      '#264c80',
      '#802680',
      '#747474',
      '#602680',
      '#52331f',
      '#80261a',
      '#464646',
    ],
    mappings: {
      CC_ADJECTIVE: 'CC_DESCRIPTOR',
      CC_ADVERB: 'CC_DESCRIPTOR',
      CC_ARTICLE: 'CC_MISC',
      CC_PREPOSITION: 'CC_MISC',
      CC_CONJUNCTION: 'CC_MISC',
      CC_INTERJECTION: 'CC_SOCIAL_EXPRESSIONS',
    },
  },
  {
    name: 'CS_GOOSENS_VERY_LIGHT',
    categories: [
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_PREPOSITION',
      'CC_NOUN',
      'CC_QUESTION_NEGATION_PRONOUN',
    ],
    colors: ['#fff0f6', '#eaeffd', '#dff4df', '#fafad0', '#fbf3e4'],
  },
  {
    name: 'CS_GOOSENS_LIGHT',
    categories: [
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_PREPOSITION',
      'CC_NOUN',
      'CC_QUESTION_NEGATION_PRONOUN',
    ],
    colors: ['#fdcae1', '#84b6f4', '#c7f3c7', '#fdfd96', '#ffda89'],
  },
  {
    name: 'CS_GOOSENS_MEDIUM',
    categories: [
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_PREPOSITION',
      'CC_NOUN',
      'CC_QUESTION_NEGATION_PRONOUN',
    ],
    colors: ['#ff6bff', '#6bb5ff', '#b5ff6b', '#ffff6b', '#ffb56b'],
  },
  {
    name: 'CS_GOOSENS_DARK',
    categories: [
      'CC_VERB',
      'CC_DESCRIPTOR',
      'CC_PREPOSITION',
      'CC_NOUN',
      'CC_QUESTION_NEGATION_PRONOUN',
    ],
    colors: ['#802680', '#264c80', '#4c8026', '#79791F', '#804c26'],
  },
  {
    name: 'CS_MONTESSORI_VERY_LIGHT',
    categories: [
      'CC_NOUN',
      'CC_ARTICLE',
      'CC_ADJECTIVE',
      'CC_VERB',
      'CC_PREPOSITION',
      'CC_ADVERB',
      'CC_PRONOUN_PERSON_NAME',
      'CC_CONJUNCTION',
      'CC_INTERJECTION',
      'CC_CATEGORY',
    ],
    colors: [
      '#ffffff',
      '#e3f5fa',
      '#eaeffd',
      '#FCE8E8',
      '#dff4df',
      '#fbf3e4',
      '#fbf2ff',
      '#fff0f6',
      '#fbf7e4',
      '#e4e4e4',
    ],
    customBorders: {
      CC_NOUN: '#353535',
    },
  },
  {
    name: 'CS_MONTESSORI_LIGHT',
    categories: [
      'CC_NOUN',
      'CC_ARTICLE',
      'CC_ADJECTIVE',
      'CC_VERB',
      'CC_PREPOSITION',
      'CC_ADVERB',
      'CC_PRONOUN_PERSON_NAME',
      'CC_CONJUNCTION',
      'CC_INTERJECTION',
      'CC_CATEGORY',
    ],
    colors: [
      '#afafaf',
      '#a8e0f0',
      '#a5bbf7',
      '#f4a8a8',
      '#ace3ac',
      '#f2d7a6',
      '#e4a5ff',
      '#ffa5c9',
      '#f2e5a6',
      '#d1d1d1',
    ],
  },
  {
    name: 'CS_MONTESSORI_MEDIUM',
    categories: [
      'CC_NOUN',
      'CC_ARTICLE',
      'CC_ADJECTIVE',
      'CC_VERB',
      'CC_PREPOSITION',
      'CC_ADVERB',
      'CC_PRONOUN_PERSON_NAME',
      'CC_CONJUNCTION',
      'CC_INTERJECTION',
      'CC_CATEGORY',
    ],
    colors: [
      '#000000',
      '#4ca6d9',
      '#1347ae',
      '#e73a0f',
      '#04bf82',
      '#fd9030',
      '#6118a2',
      '#f1c9d1',
      '#aa996b',
      '#d1d1d1',
    ],
  },
  {
    name: 'CS_MONTESSORI_DARK',
    categories: [
      'CC_NOUN',
      'CC_ARTICLE',
      'CC_ADJECTIVE',
      'CC_VERB',
      'CC_PREPOSITION',
      'CC_ADVERB',
      'CC_PRONOUN_PERSON_NAME',
      'CC_CONJUNCTION',
      'CC_INTERJECTION',
      'CC_CATEGORY',
    ],
    colors: [
      '#464646',
      '#18728c',
      '#0d3298',
      '#931212',
      '#287728',
      '#BC5800',
      '#7500a7',
      '#a70043',
      '#807351',
      '#747474',
    ],
  },
];

const COLOR_SCHEME_ALIASES: Record<string, string> = {
  CS_DEFAULT: 'CS_MODIFIED_FITZGERALD_KEY_LIGHT',
  CS_MONTESSORI: 'CS_MONTESSORI_LIGHT',
  CS_MONTESSORI_LIGHT: 'CS_MONTESSORI_LIGHT',
  CS_MONTESSORI_MEDIUM: 'CS_MONTESSORI_MEDIUM',
  CS_MONTESSORI_DARK: 'CS_MONTESSORI_DARK',
  CS_MONTESSORI_VERY_LIGHT: 'CS_MONTESSORI_VERY_LIGHT',
  CS_MODIFIED_FITZGERALD_KEY: 'CS_MODIFIED_FITZGERALD_KEY_LIGHT',
  CS_MODIFIED_FITZGERALD_KEY_LIGHT: 'CS_MODIFIED_FITZGERALD_KEY_LIGHT',
  CS_MODIFIED_FITZGERALD_KEY_MEDIUM: 'CS_MODIFIED_FITZGERALD_KEY_MEDIUM',
  CS_MODIFIED_FITZGERALD_KEY_DARK: 'CS_MODIFIED_FITZGERALD_KEY_DARK',
  CS_MODIFIED_FITZGERALD_KEY_VERY_LIGHT: 'CS_MODIFIED_FITZGERALD_KEY_VERY_LIGHT',
  CS_GOOSENS: 'CS_GOOSENS_LIGHT',
  CS_GOOSENS_LIGHT: 'CS_GOOSENS_LIGHT',
  CS_GOOSENS_MEDIUM: 'CS_GOOSENS_MEDIUM',
  CS_GOOSENS_DARK: 'CS_GOOSENS_DARK',
  CS_GOOSENS_VERY_LIGHT: 'CS_GOOSENS_VERY_LIGHT',
};

export function normalizeHexColor(hexColor: string): string | null {
  if (!hexColor || typeof hexColor !== 'string') return null;
  let value = hexColor.trim().toLowerCase();
  if (!value.startsWith('#')) {
    return null;
  }
  value = value.slice(1);
  if (value.length === 3) {
    value = value
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (value.length !== 6 || /[^0-9a-f]/.test(value)) {
    return null;
  }
  return `#${value}`;
}

export function adjustHexColor(hexColor: string, amount: number): string {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return hexColor;
  const hex = normalized.slice(1);
  const num = parseInt(hex, 16);
  const clamp = (value: number): number => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 0xff) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function getHighContrastNeutralColor(backgroundColor: string): string {
  const normalized = normalizeHexColor(backgroundColor);
  if (!normalized) {
    return '#808080';
  }
  return calculateLuminance(normalized) < 0.5 ? '#f5f5f5' : '#808080';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStringRecord(input: unknown): Record<string, string> | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const entries: [string, string][] = [];
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value === 'string') {
      entries.push([key, value]);
    }
  });
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function normalizeColorScheme(raw: unknown): ColorSchemeDefinition | null {
  if (!isRecord(raw)) return null;
  const scheme = raw;
  const nameCandidate = [scheme.name, scheme.key, scheme.id].find(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  if (!nameCandidate) return null;

  let categories: string[] = [];
  let colors: string[] = [];
  if (Array.isArray(scheme.categories) && Array.isArray(scheme.colors)) {
    categories = scheme.categories.filter(
      (value: unknown): value is string => typeof value === 'string'
    );
    colors = scheme.colors.filter((value: unknown): value is string => typeof value === 'string');
  } else if (isRecord(scheme.colorMap)) {
    const colorMap = scheme.colorMap;
    categories = Object.keys(colorMap);
    colors = categories.map((category) => {
      const colorValue = colorMap[category];
      return typeof colorValue === 'string' ? colorValue : '#ffffff';
    });
  }

  if (!categories.length || !colors.length) {
    return null;
  }

  const mappingsCandidate =
    normalizeStringRecord(scheme.mappings) ||
    normalizeStringRecord(scheme.categoryMappings) ||
    normalizeStringRecord(scheme.categoryMapping) ||
    undefined;

  const customBordersCandidate = normalizeStringRecord(scheme.customBorders);

  return {
    name: nameCandidate,
    categories,
    colors,
    mappings: mappingsCandidate,
    customBorders: customBordersCandidate,
  };
}

function getAllColorSchemeDefinitions(colorConfig?: AstericsColorConfig): ColorSchemeDefinition[] {
  const rawAdditional: unknown[] = Array.isArray(colorConfig?.additionalColorSchemes)
    ? colorConfig.additionalColorSchemes
    : [];
  const additional = rawAdditional
    .map((scheme) => normalizeColorScheme(scheme))
    .filter((value: ColorSchemeDefinition | null): value is ColorSchemeDefinition =>
      Boolean(value)
    );
  return [...DEFAULT_COLOR_SCHEME_DEFINITIONS, ...additional];
}

function getActiveColorSchemeDefinition(
  colorConfig?: AstericsColorConfig
): ColorSchemeDefinition | null {
  if (!colorConfig || colorConfig.colorSchemesActivated === false) {
    return null;
  }
  const schemes = getAllColorSchemeDefinitions(colorConfig);
  if (!schemes.length) {
    return null;
  }

  const activeName: string | undefined =
    (typeof colorConfig.activeColorScheme === 'string' && colorConfig.activeColorScheme) ||
    undefined;
  const normalizedName = activeName ? COLOR_SCHEME_ALIASES[activeName] || activeName : undefined;

  if (normalizedName) {
    const match = schemes.find((scheme) => scheme.name === normalizedName);
    if (match) {
      return match;
    }
  }

  return schemes[0];
}

function getSchemeColorForCategory(
  category: string | undefined,
  scheme: ColorSchemeDefinition | null,
  fallback?: string
): string | undefined {
  if (!scheme || !category) return fallback;
  let index = scheme.categories.indexOf(category);
  if (index === -1 && scheme.mappings && scheme.mappings[category]) {
    index = scheme.categories.indexOf(scheme.mappings[category]);
  }
  if (index === -1) {
    return fallback;
  }
  const color = scheme.colors[index];
  return typeof color === 'string' ? color : fallback;
}

function resolveBorderColor(
  element: GridElement,
  colorConfig: AstericsColorConfig = {},
  scheme: ColorSchemeDefinition | null,
  backgroundColor: string,
  schemeColor?: string,
  fallbackBorder?: string
): string {
  const defaultBorderColor = (fallbackBorder || '#808080').toLowerCase();
  const colorMode =
    typeof colorConfig.colorMode === 'string' ? colorConfig.colorMode : 'COLOR_MODE_BACKGROUND';

  if (colorMode === 'COLOR_MODE_BORDER') {
    return (
      getSchemeColorForCategory(element.colorCategory, scheme, fallbackBorder || '#808080') ||
      fallbackBorder ||
      '#808080'
    );
  }

  if (colorMode === 'COLOR_MODE_BOTH') {
    if (!element.colorCategory) {
      return 'transparent';
    }
    const customBorder = scheme?.customBorders?.[element.colorCategory];
    if (typeof customBorder === 'string') {
      return customBorder;
    }
    const baseColor =
      schemeColor ||
      getSchemeColorForCategory(element.colorCategory, scheme, backgroundColor) ||
      backgroundColor;
    const isDark = calculateLuminance(baseColor) < 0.5;
    const adjustment = isDark ? 60 : -40;
    return adjustHexColor(baseColor, adjustment);
  }

  if (defaultBorderColor !== '#808080') {
    return fallbackBorder || '#808080';
  }

  const gridBackground =
    typeof colorConfig.gridBackgroundColor === 'string'
      ? colorConfig.gridBackgroundColor
      : '#ffffff';
  return getHighContrastNeutralColor(gridBackground);
}

function resolveButtonColors(
  element: GridElement,
  colorConfig: AstericsColorConfig = {},
  scheme?: ColorSchemeDefinition | null
): { backgroundColor: string; borderColor: string; fontColor: string } {
  const fallbackBackground =
    typeof colorConfig.elementBackgroundColor === 'string'
      ? colorConfig.elementBackgroundColor
      : '#FFFFFF';
  const fallbackBorder =
    typeof colorConfig.elementBorderColor === 'string' ? colorConfig.elementBorderColor : '#808080';
  const colorMode =
    typeof colorConfig.colorMode === 'string' ? colorConfig.colorMode : 'COLOR_MODE_BACKGROUND';
  const isSchemeActive = colorConfig?.colorSchemesActivated !== false;
  const schemeColor =
    isSchemeActive && colorMode !== 'COLOR_MODE_BORDER'
      ? getSchemeColorForCategory(element.colorCategory, scheme || null)
      : undefined;

  const backgroundColor = element.backgroundColor || schemeColor || fallbackBackground || '#FFFFFF';

  const borderColor = resolveBorderColor(
    element,
    colorConfig,
    scheme || null,
    backgroundColor,
    schemeColor,
    fallbackBorder
  );

  const fontColor =
    element.fontColor || colorConfig?.fontColor || getContrastingTextColor(backgroundColor);

  return {
    backgroundColor,
    borderColor,
    fontColor,
  };
}

/**
 * Calculate relative luminance of a color using WCAG formula
 * @param hexColor - Hex color string (e.g., "#1d90ff")
 * @returns Relative luminance value between 0 and 1
 */
export function calculateLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Apply sRGB gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate relative luminance
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Choose white or black text color based on background luminance for optimal contrast
 * @param backgroundColor - Background color hex string
 * @returns "#FFFFFF" for dark backgrounds, "#000000" for light backgrounds
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const luminance = calculateLuminance(backgroundColor);
  // WCAG threshold: use white text if luminance < 0.5, black otherwise
  return luminance < 0.5 ? '#FFFFFF' : '#000000';
}

/**
 * Map Asterics Grid hidden value to AAC standard visibility
 * Asterics Grid: true = hidden, false = visible
 * Maps to: 'Hidden' | 'Visible' | undefined
 */
function mapAstericsVisibility(hidden: boolean | undefined): 'Hidden' | 'Visible' | undefined {
  if (hidden === undefined) {
    return undefined; // Default to visible
  }
  return hidden ? 'Hidden' : 'Visible';
}

class AstericsGridProcessor extends BaseProcessor {
  private loadAudio: boolean = false;

  constructor(options: ProcessorOptions & { loadAudio?: boolean } = {}) {
    super(options);
    this.loadAudio = options.loadAudio || false;
  }

  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const tree = await this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      if (page.name) texts.push(page.name);

      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    // Also extract texts from the raw file for comprehensive coverage
    const rawTexts = this.extractRawTexts(filePathOrBuffer);
    rawTexts.forEach((text) => {
      if (text && !texts.includes(text)) {
        texts.push(text);
      }
    });

    return texts;
  }

  private extractRawTexts(filePathOrBuffer: ProcessorInput): string[] {
    let content = readTextFromInput(filePathOrBuffer);

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const texts: string[] = [];

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      grdFile.grids.forEach((grid: GridData) => {
        // Extract grid labels
        Object.values(grid.label || {}).forEach((label) => {
          if (label && typeof label === 'string') texts.push(label);
        });

        // Extract element texts
        grid.gridElements.forEach((element: GridElement) => {
          // Element labels
          Object.values(element.label || {}).forEach((label) => {
            if (label && typeof label === 'string') texts.push(label);
          });

          // Word forms
          element.wordForms?.forEach((wordForm: WordForm) => {
            if (wordForm.value) texts.push(wordForm.value);
          });

          // Action-specific texts
          element.actions.forEach((action: GridAction) => {
            this.extractActionTexts(action, texts);
          });
        });
      });
    } catch (error) {
      // If JSON parsing fails, return empty array
    }

    return texts;
  }

  private extractActionTexts(action: GridAction, texts: string[]): void {
    switch (action.modelName) {
      case 'GridActionSpeakCustom':
        if (action.speakText && typeof action.speakText === 'object') {
          const speakTextMap = action.speakText as Record<string, unknown>;
          Object.values(speakTextMap).forEach((textValue) => {
            if (typeof textValue === 'string' && textValue.length > 0) {
              texts.push(textValue);
            }
          });
        }
        break;
      case 'GridActionChangeLang':
        if (action.language && typeof action.language === 'string') {
          texts.push(action.language);
        }
        if (action.voice && typeof action.voice === 'string') {
          texts.push(action.voice);
        }
        break;
      case 'GridActionHTTP':
        if (action.restUrl && typeof action.restUrl === 'string') {
          texts.push(action.restUrl);
        }
        if (action.body && typeof action.body === 'string') {
          texts.push(action.body);
        }
        break;
      case 'GridActionOpenWebpage':
        if (action.openURL && typeof action.openURL === 'string') {
          texts.push(action.openURL);
        }
        break;
      case 'GridActionMatrix':
        if (action.sendText && typeof action.sendText === 'string') {
          texts.push(action.sendText);
        }
        break;
      // Add more action types as needed
    }
  }

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    await Promise.resolve();
    const tree = new AACTree();
    const filename =
      typeof filePathOrBuffer === 'string' ? getBasename(filePathOrBuffer) : 'upload.grd';
    const buffer = readBinaryFromInput(filePathOrBuffer);

    try {
      let content = readTextFromInput(buffer);

      // Remove BOM if present
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }

      const grdFile: AstericsGridFile = JSON.parse(content);

      if (!grdFile.grids) {
        const validationResult = buildValidationResultFromMessage({
          filename,
          filesize: buffer.byteLength,
          format: 'asterics',
          message: 'Missing grids array in Asterics .grd file',
          type: 'structure',
          description: 'Asterics grid collection',
        });
        throw new ValidationFailureError('Invalid Asterics grid file', validationResult);
      }

      const rawColorConfig = grdFile.metadata?.colorConfig;
      const colorConfig: AstericsColorConfig | undefined = isRecord(rawColorConfig)
        ? (rawColorConfig as AstericsColorConfig)
        : undefined;
      const activeColorSchemeDefinition = getActiveColorSchemeDefinition(colorConfig);

      grdFile.grids.forEach((grid: GridData) => {
        const page = new AACPage({
          id: grid.id,
          name: this.getLocalizedLabel(grid.label) || grid.id,
          grid: [],
          buttons: [],
          parentId: null,
          style: {
            backgroundColor: colorConfig?.gridBackgroundColor || '#FFFFFF',
            borderColor: colorConfig?.elementBorderColor || '#CCCCCC',
            borderWidth: colorConfig?.borderWidth || 1,
            fontFamily: colorConfig?.fontFamily || 'Arial',
            fontSize: colorConfig?.fontSizePct ? colorConfig.fontSizePct * 16 : 16,
            fontColor: colorConfig?.fontColor || '#000000',
          },
        });
        tree.addPage(page);
      });

      grdFile.grids.forEach((grid: GridData) => {
        const page = tree.getPage(grid.id);
        if (!page) return;

        const gridLayout: (AACButton | null)[][] = [];
        const maxRows = Math.max(10, grid.rowCount || 10);
        const maxCols = Math.max(10, grid.minColumnCount || 10);
        for (let r = 0; r < maxRows; r++) {
          gridLayout[r] = new Array(maxCols).fill(null);
        }

        grid.gridElements.forEach((element: GridElement) => {
          const button = this.createButtonFromElement(
            element,
            colorConfig,
            activeColorSchemeDefinition
          );
          page.addButton(button);

          const buttonX = element.x || 0;
          const buttonY = element.y || 0;
          const buttonWidth = element.width || 1;
          const buttonHeight = element.height || 1;

          for (let r = buttonY; r < buttonY + buttonHeight && r < maxRows; r++) {
            for (let c = buttonX; c < buttonX + buttonWidth && c < maxCols; c++) {
              if (gridLayout[r] && gridLayout[r][c] === null) {
                gridLayout[r][c] = button;
              }
            }
          }

          const navAction = element.actions.find(
            (a: GridAction) => a.modelName === 'GridActionNavigate'
          );
          const targetGridId =
            navAction && typeof navAction.toGridId === 'string' ? navAction.toGridId : undefined;
          if (targetGridId) {
            const targetPage = tree.getPage(targetGridId);
            if (targetPage) {
              targetPage.parentId = page.id;
            }
          }
        });

        page.grid = gridLayout;
      });

      const astericsMetadata: AstericsGridMetadata = {
        format: 'asterics',
        hasGlobalGrid: false,
      };

      if (grdFile.grids && grdFile.grids.length > 0) {
        astericsMetadata.name = this.getLocalizedLabel(grdFile.grids[0].label);

        const languages = new Set<string>();
        grdFile.grids.forEach((grid) => {
          if (grid.label) {
            Object.keys(grid.label).forEach((lang) => languages.add(lang));
          }
          grid.gridElements?.forEach((element) => {
            if (element.label) {
              Object.keys(element.label).forEach((lang) => languages.add(lang));
            }
            element.wordForms?.forEach((wf) => {
              if (wf.lang) languages.add(wf.lang);
            });
          });
        });

        if (languages.size > 0) {
          astericsMetadata.languages = Array.from(languages).sort();
          astericsMetadata.locale = languages.has('en')
            ? 'en'
            : languages.has('de')
              ? 'de'
              : astericsMetadata.languages[0];
        }
      }

      tree.metadata = astericsMetadata;
      if (grdFile.metadata && grdFile.metadata.homeGridId) {
        tree.rootId = grdFile.metadata.homeGridId;
      }

      return tree;
    } catch (err: any) {
      if (err instanceof ValidationFailureError) {
        throw err;
      }

      const validationResult = buildValidationResultFromMessage({
        filename,
        filesize: buffer.byteLength,
        format: 'asterics',
        message: err?.message || 'Failed to parse Asterics grid file',
        type: 'parse',
        description: 'Parse Asterics grid JSON',
      });
      throw new ValidationFailureError('Failed to load Asterics grid', validationResult, err);
    }
  }

  private getLocalizedLabel(labelMap: { [lang: string]: string } | undefined): string {
    if (!labelMap) return '';

    // Prefer English, then any available language
    return labelMap.en || labelMap.de || labelMap.es || Object.values(labelMap)[0] || '';
  }

  private getLocalizedText(text: unknown): string {
    if (typeof text === 'string') return text;
    if (isRecord(text)) {
      const preferred = ['en', 'de', 'es'];
      for (const lang of preferred) {
        const value = text[lang];
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
      const fallback = Object.values(text).find(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
      if (fallback) {
        return fallback;
      }
    }
    return '';
  }

  private createButtonFromElement(
    element: GridElement,
    colorConfig?: AstericsColorConfig,
    activeColorScheme?: ColorSchemeDefinition | null
  ): AACButton {
    let audioRecording;
    if (this.loadAudio) {
      const audioAction = element.actions.find(
        (a: GridAction) => a.modelName === 'GridActionAudio'
      );
      if (audioAction && typeof audioAction.dataBase64 === 'string') {
        const parsedId = Number.parseInt(String(audioAction.id), 10);
        const metadata: Record<string, unknown> = {};
        if (typeof audioAction.mimeType === 'string') {
          metadata.mimeType = audioAction.mimeType;
        }
        if (typeof audioAction.durationMs === 'number') {
          metadata.durationMs = audioAction.durationMs;
        }
        audioRecording = {
          id: Number.isNaN(parsedId) ? undefined : parsedId,
          data: Buffer.from(audioAction.dataBase64, 'base64'),
          identifier: typeof audioAction.filename === 'string' ? audioAction.filename : undefined,
          metadata: JSON.stringify(metadata),
        };
      }
    }

    const colorStyles = resolveButtonColors(element, colorConfig, activeColorScheme);

    const navAction = element.actions.find((a: GridAction) => a.modelName === 'GridActionNavigate');
    const targetPageId =
      navAction && typeof navAction.toGridId === 'string' ? navAction.toGridId : null;

    const label = this.getLocalizedLabel(element.label);

    // Create semantic action from AstericsGrid element
    let semanticAction: AACSemanticAction | undefined;

    if (navAction && targetPageId) {
      semanticAction = {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: targetPageId,
        platformData: {
          astericsGrid: {
            modelName: navAction.modelName,
            properties: navAction,
          },
        },
        fallback: {
          type: 'NAVIGATE',
          targetPageId: targetPageId,
        },
      };
    } else {
      // Check for other action types
      const collectAction = element.actions.find((a) => a.modelName === 'GridActionCollectElement');

      if (collectAction) {
        // Handle text editing actions
        switch (collectAction.action) {
          case 'COLLECT_ACTION_REMOVE_WORD':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.DELETE_WORD,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Delete word',
              },
            };
            break;

          case 'COLLECT_ACTION_REMOVE_CHAR':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.DELETE_CHARACTER,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Delete character',
              },
            };
            break;

          case 'COLLECT_ACTION_CLEAR':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.CLEAR_TEXT,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Clear text',
              },
            };
            break;
        }
      }

      // Check for navigation actions with special nav types
      if (!semanticAction && navAction) {
        switch (navAction.navType) {
          case 'TO_LAST':
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.GO_BACK,
              platformData: {
                astericsGrid: {
                  modelName: navAction.modelName,
                  properties: navAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Go back',
              },
            };
            break;

          case 'TO_HOME':
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.GO_HOME,
              platformData: {
                astericsGrid: {
                  modelName: navAction.modelName,
                  properties: navAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Go home',
              },
            };
            break;
        }
      }

      // Check for speak actions if no other semantic action was found
      if (!semanticAction) {
        const speakAction = element.actions.find(
          (a) => a.modelName === 'GridActionSpeakCustom' || a.modelName === 'GridActionSpeak'
        );

        if (speakAction) {
          const speakText =
            speakAction.modelName === 'GridActionSpeakCustom'
              ? this.getLocalizedText(speakAction.speakText)
              : label;

          semanticAction = {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: speakText,
            platformData: {
              astericsGrid: {
                modelName: speakAction.modelName,
                properties: speakAction,
              },
            },
            fallback: {
              type: 'SPEAK',
              message: speakText,
            },
          };
        } else {
          // Default speak action
          semanticAction = {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: label,
            platformData: {
              astericsGrid: {
                modelName: 'GridActionSpeak',
                properties: {},
              },
            },
            fallback: {
              type: 'SPEAK',
              message: label,
            },
          };
        }
      }
    }

    // Determine the final background color
    const finalBackgroundColor =
      element.backgroundColor ||
      colorStyles.backgroundColor ||
      colorConfig?.elementBackgroundColor ||
      '#FFFFFF';

    // Determine font color with priority:
    // 1. Explicit element.fontColor (highest priority)
    // 2. Resolved color from color category
    // 3. Global colorConfig.fontColor
    // 4. Automatic contrast calculation based on background (lowest priority)
    const fontColor =
      element.fontColor ||
      colorStyles.fontColor ||
      colorConfig?.fontColor ||
      getContrastingTextColor(finalBackgroundColor);

    // Extract image data if present
    let imageData: Buffer | undefined;
    let imageName: string | undefined;
    if (element.image && element.image.data) {
      // Asterics Grid stores images as Data URLs (e.g., "data:image/png;base64,...")
      // We need to strip the Data URL prefix before decoding
      try {
        let base64Data = element.image.data;
        let imageFormat = 'png'; // Default format

        // Check if this is a Data URL and extract the base64 part
        const dataUrlMatch = base64Data.match(
          /^data:image\/(png|jpeg|jpg|gif|svg\+xml);base64,(.+)/
        );
        if (dataUrlMatch) {
          imageFormat = dataUrlMatch[1];
          base64Data = dataUrlMatch[2]; // Use only the base64 part, not the prefix
        }

        // Decode the base64 data
        imageData = Buffer.from(base64Data, 'base64');

        // Use detected format for filename
        imageName = element.image.id || `image.${imageFormat}`;
      } catch (e) {
        // Invalid base64 data, skip image
      }
    }

    return new AACButton({
      id: element.id,
      label: label,
      message: label,

      targetPageId: targetPageId || undefined,

      semanticAction: semanticAction,
      audioRecording: audioRecording,
      visibility: mapAstericsVisibility(element.hidden),
      image: imageName, // Store image filename/reference
      parameters: imageData
        ? {
            ...{ imageData: imageData }, // Store actual image data in parameters for conversion
          }
        : undefined,
      style: {
        backgroundColor: finalBackgroundColor,
        borderColor: colorStyles.borderColor || colorConfig?.elementBorderColor || '#CCCCCC',
        borderWidth: colorConfig?.borderWidth || 1,
        fontFamily: colorConfig?.fontFamily || 'Arial',
        fontSize: colorConfig?.fontSizePct ? colorConfig.fontSizePct * 16 : 16, // Default to 16px
        fontColor: fontColor,
      },
    });
  }

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string,
    targetLocale?: string
  ): Promise<Uint8Array> {
    await Promise.resolve();
    let content = readTextFromInput(filePathOrBuffer);

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const grdFile: AstericsGridFile = JSON.parse(content);

    // Apply translations directly to the JSON structure for comprehensive coverage
    this.applyTranslationsToGridFile(grdFile, translations, targetLocale);

    // Write the translated file
    writeTextToPath(outputPath, JSON.stringify(grdFile, null, 2));
    return readBinaryFromInput(outputPath);
  }

  private applyTranslationsToGridFile(
    grdFile: AstericsGridFile,
    translations: Map<string, string>,
    targetLocale?: string
  ): void {
    grdFile.grids.forEach((grid: GridData) => {
      // Translate grid labels
      if (grid.label) {
        if (typeof grid.label === 'string') {
          const originalText = grid.label as string;
          if (translations.has(originalText)) {
            const translation = translations.get(originalText);
            if (translation !== undefined) {
              if (targetLocale) {
                // Upgrade to object format
                grid.label = {
                  en: originalText, // Assume 'en' for legacy string labels
                  [targetLocale]: translation,
                };
              } else {
                grid.label = translation as any;
              }
            }
          }
        } else {
          Object.keys(grid.label).forEach((lang) => {
            const originalText = grid.label[lang];
            if (originalText && translations.has(originalText)) {
              const translation = translations.get(originalText);
              if (translation !== undefined) {
                if (targetLocale) {
                  grid.label[targetLocale] = translation;
                } else {
                  grid.label[lang] = translation;
                }
              }
            }
          });
        }
      }

      // Translate grid elements
      grid.gridElements.forEach((element: GridElement) => {
        // Translate element labels
        if (element.label) {
          if (typeof element.label === 'string') {
            const originalText = element.label as string;
            if (translations.has(originalText)) {
              const translation = translations.get(originalText);
              if (translation !== undefined) {
                if (targetLocale) {
                  // Upgrade to object format
                  element.label = {
                    en: originalText, // Assume 'en' for legacy string labels
                    [targetLocale]: translation,
                  };
                } else {
                  element.label = translation as any;
                }
              }
            }
          } else {
            Object.keys(element.label).forEach((lang) => {
              const originalText = element.label[lang];
              if (originalText && translations.has(originalText)) {
                const translation = translations.get(originalText);
                if (translation !== undefined) {
                  if (targetLocale) {
                    element.label[targetLocale] = translation;
                  } else {
                    element.label[lang] = translation;
                  }
                }
              }
            });
          }
        }

        // Translate word forms
        // Word forms are typically specific to a language, so adding a target locale might require structure change
        // For now, we only translate in place if no targetLocale, or skip if targetLocale is set (as word forms are language specific)
        if (element.wordForms && !targetLocale) {
          element.wordForms.forEach((wordForm: WordForm) => {
            if (wordForm.value && translations.has(wordForm.value)) {
              const translation = translations.get(wordForm.value);
              if (translation !== undefined) {
                wordForm.value = translation;
              }
            }
          });
        }

        // Translate action-specific texts
        element.actions.forEach((action: GridAction) => {
          this.applyTranslationsToAction(action, translations, targetLocale);
        });
      });
    });
  }

  private applyTranslationsToAction(
    action: GridAction,
    translations: Map<string, string>,
    targetLocale?: string
  ): void {
    switch (action.modelName) {
      case 'GridActionSpeakCustom':
        if (action.speakText && typeof action.speakText === 'object') {
          const speakTextMap = action.speakText as Record<string, unknown>;
          Object.keys(speakTextMap).forEach((lang) => {
            const originalText = speakTextMap[lang];
            if (typeof originalText === 'string' && translations.has(originalText)) {
              const translation = translations.get(originalText);
              if (translation !== undefined) {
                if (targetLocale) {
                  speakTextMap[targetLocale] = translation;
                } else {
                  speakTextMap[lang] = translation;
                }
              }
            }
          });
        }
        break;
      case 'GridActionChangeLang':
        if (typeof action.language === 'string' && translations.has(action.language)) {
          const translation = translations.get(action.language);
          if (translation !== undefined) {
            action.language = translation;
          }
        }
        if (typeof action.voice === 'string' && translations.has(action.voice)) {
          const translation = translations.get(action.voice);
          if (translation !== undefined) {
            action.voice = translation;
          }
        }
        break;
      case 'GridActionHTTP':
        if (typeof action.restUrl === 'string' && translations.has(action.restUrl)) {
          const translation = translations.get(action.restUrl);
          if (translation !== undefined) {
            action.restUrl = translation;
          }
        }
        if (typeof action.body === 'string' && translations.has(action.body)) {
          const translation = translations.get(action.body);
          if (translation !== undefined) {
            action.body = translation;
          }
        }
        break;
      case 'GridActionOpenWebpage':
        if (typeof action.openURL === 'string' && translations.has(action.openURL)) {
          const translation = translations.get(action.openURL);
          if (translation !== undefined) {
            action.openURL = translation;
          }
        }
        break;
      case 'GridActionMatrix':
        if (typeof action.sendText === 'string' && translations.has(action.sendText)) {
          const translation = translations.get(action.sendText);
          if (translation !== undefined) {
            action.sendText = translation;
          }
        }
        break;
      // Add more action types as needed
    }
  }

  async saveFromTree(tree: AACTree, outputPath: string): Promise<void> {
    await Promise.resolve();
    // Use default Asterics Grid styling instead of taking from first page
    // This prevents issues where the first page has unusual colors (like purple)
    const defaultPageStyle = {
      backgroundColor: '#FFFFFF', // White background by default
      borderColor: '#CCCCCC',
      borderWidth: 1,
      fontFamily: 'Arial',
      fontSize: 16,
      fontColor: '#000000',
    };

    const grids: GridData[] = Object.values(tree.pages).map((page) => {
      // Create a map of button positions from the grid layout
      const buttonPositions = new Map<string, { x: number; y: number }>();

      // Extract positions from the 2D grid if available
      if (page.grid && page.grid.length > 0) {
        page.grid.forEach((row, y) => {
          row.forEach((button, x) => {
            if (button) {
              buttonPositions.set(button.id, { x, y });
            }
          });
        });
      }

      // Filter out navigation/system buttons if configured
      const filteredButtons = this.filterPageButtons(page.buttons);

      const gridElements: GridElement[] = filteredButtons.map((button, index) => {
        // Use grid position if available, otherwise arrange in rows of 4
        const gridWidth = 4;
        const position = buttonPositions.get(button.id);
        const calculatedX = position ? position.x : index % gridWidth;
        const calculatedY = position ? position.y : Math.floor(index / gridWidth);
        const actions: GridAction[] = [];

        // Add appropriate actions - prefer semantic actions
        if (button.semanticAction?.platformData?.astericsGrid) {
          // Use original AstericsGrid action data
          const astericsData = button.semanticAction.platformData.astericsGrid;
          actions.push({
            id: `grid-action-${button.id}`,
            ...astericsData.properties,
            modelName: astericsData.modelName,
            modelVersion:
              astericsData.properties.modelVersion || '{"major": 5, "minor": 0, "patch": 0}',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO) {
          // Create navigation action from semantic data
          const targetId = button.semanticAction.targetId || button.targetPageId;
          actions.push({
            id: `grid-action-navigate-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'navigateToGrid',
            toGridId: targetId,
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.GO_BACK) {
          // Create back navigation action
          actions.push({
            id: `grid-action-navigate-back-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'TO_LAST',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.GO_HOME) {
          // Create home navigation action
          actions.push({
            id: `grid-action-navigate-home-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'TO_HOME',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.DELETE_WORD) {
          // Create delete word action
          actions.push({
            id: `grid-action-delete-word-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_REMOVE_WORD',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.DELETE_CHARACTER) {
          // Create delete character action
          actions.push({
            id: `grid-action-delete-char-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_REMOVE_CHAR',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.CLEAR_TEXT) {
          // Create clear text action
          actions.push({
            id: `grid-action-clear-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_CLEAR',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.SPEAK_TEXT) {
          // Create speak action from semantic data
          if (button.semanticAction.text && button.semanticAction.text !== button.label) {
            actions.push({
              id: `grid-action-speak-${button.id}`,
              modelName: 'GridActionSpeakCustom',
              modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
              speakText: { en: button.semanticAction.text },
            });
          } else {
            actions.push({
              id: `grid-action-speak-${button.id}`,
              modelName: 'GridActionSpeak',
              modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            });
          }
        } else {
          // Default to speak action if no semantic action
          actions.push({
            id: `grid-action-speak-${button.id}`,
            modelName: 'GridActionSpeak',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
          });
        }

        // Add audio action if present
        if (button.audioRecording && button.audioRecording.data) {
          const metadata = JSON.parse(button.audioRecording.metadata || '{}');
          actions.push({
            id: button.audioRecording.id?.toString() || `grid-action-audio-${button.id}`,
            modelName: 'GridActionAudio',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            dataBase64: encodeBase64(button.audioRecording.data),
            mimeType: metadata.mimeType || 'audio/wav',
            durationMs: metadata.durationMs || 0,
            filename: button.audioRecording.identifier || `audio-${button.id}`,
          });
        }

        const locale = tree.metadata?.locale || 'en';

        return {
          id: button.id,
          modelName: 'GridElement',
          modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
          width: 1,
          height: 1,
          x: calculatedX,
          y: calculatedY,
          label: { [locale]: button.label },
          wordForms: [],
          image: {
            data: null,
            author: undefined,
            authorURL: undefined,
          },
          actions: actions,
          type: 'ELEMENT_TYPE_NORMAL',
          additionalProps: {},
          backgroundColor:
            button.style?.backgroundColor ||
            page.style?.backgroundColor ||
            defaultPageStyle.backgroundColor,
        };
      });

      // Calculate grid dimensions based on button count
      const gridWidth = 4;
      const buttonCount = page.buttons.length;
      const calculatedRows = Math.max(3, Math.ceil(buttonCount / gridWidth));
      const calculatedCols = Math.max(3, Math.min(gridWidth, buttonCount));

      return {
        id: page.id,
        modelName: 'GridData',
        modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
        label: { [tree.metadata?.locale || 'en']: page.name },
        rowCount: calculatedRows,
        minColumnCount: calculatedCols,
        gridElements: gridElements,
      };
    });

    // Determine the home grid ID from tree.rootId, fallback to first grid
    const homeGridId = tree.rootId || (grids.length > 0 ? grids[0].id : undefined);

    const grdFile: AstericsGridFile = {
      grids: grids,
      metadata: {
        homeGridId: homeGridId,
        colorConfig: {
          gridBackgroundColor: defaultPageStyle.backgroundColor,
          elementBackgroundColor: defaultPageStyle.backgroundColor,
          elementBorderColor: defaultPageStyle.borderColor,
          borderWidth: defaultPageStyle.borderWidth,
          fontFamily: defaultPageStyle.fontFamily,
          fontSizePct: defaultPageStyle.fontSize / 16, // Convert pixels to percentage
          fontColor: defaultPageStyle.fontColor,
          // Add additional properties that might be useful
          elementMargin: 2, // Default margin
          borderRadius: 4, // Default border radius
          colorMode: 'default',
          lineHeight: 1.2,
          maxLines: 2,
          textPosition: 'center',
          fittingMode: 'fit',
        },
      },
    };

    writeTextToPath(outputPath, JSON.stringify(grdFile, null, 2));
  }

  /**
   * Add audio recording to a specific grid element
   */
  addAudioToElement(
    filePath: string,
    elementId: string,
    audioData: Buffer,
    metadata?: string
  ): void {
    let content = readTextFromInput(filePath);

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const grdFile: AstericsGridFile = JSON.parse(content);

    // Find the element and add audio action
    let elementFound = false;
    grdFile.grids.forEach((grid: GridData) => {
      grid.gridElements.forEach((element: GridElement) => {
        if (element.id === elementId) {
          elementFound = true;

          // Remove existing audio action if present
          element.actions = element.actions.filter((a) => a.modelName !== 'GridActionAudio');

          // Add new audio action
          const audioAction: GridAction = {
            id: `grid-action-audio-${elementId}`,
            modelName: 'GridActionAudio',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            dataBase64: encodeBase64(audioData),
            mimeType: 'audio/wav',
            durationMs: 0, // Could be calculated from audio data
            filename: `audio-${elementId}.wav`,
          };

          if (metadata) {
            try {
              const parsedMetadata = JSON.parse(metadata);
              audioAction.mimeType = parsedMetadata.mimeType || audioAction.mimeType;
              audioAction.durationMs = parsedMetadata.durationMs || audioAction.durationMs;
              audioAction.filename = parsedMetadata.filename || audioAction.filename;
            } catch (e) {
              // Use defaults if metadata parsing fails
            }
          }

          element.actions.push(audioAction);
        }
      });
    });

    if (!elementFound) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    // Write back to file
    writeTextToPath(filePath, JSON.stringify(grdFile, null, 2));
  }

  /**
   * Create a copy of the grid file with audio recordings added
   */
  createAudioEnhancedGridFile(
    sourceFilePath: string,
    targetFilePath: string,
    audioMappings: Map<string, { audioData: Buffer; metadata?: string }>
  ): void {
    // Copy the source file to target
    const fs = getFs();
    fs.copyFileSync(sourceFilePath, targetFilePath);

    // Add audio recordings to the copy
    audioMappings.forEach((audioInfo, elementId) => {
      try {
        this.addAudioToElement(targetFilePath, elementId, audioInfo.audioData, audioInfo.metadata);
      } catch (error) {
        // Failed to add audio to element - continue with others
        console.warn(`Failed to add audio to element ${elementId}:`, error);
      }
    });
  }

  /**
   * Extract all element IDs from the grid file for audio mapping
   */
  getElementIds(filePathOrBuffer: ProcessorInput): string[] {
    let content = readTextFromInput(filePathOrBuffer);

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const elementIds: string[] = [];

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      grdFile.grids.forEach((grid: GridData) => {
        grid.gridElements.forEach((element: GridElement) => {
          elementIds.push(element.id);
        });
      });
    } catch (error) {
      // If JSON parsing fails, return empty array
    }

    return elementIds;
  }

  /**
   * Check if an element has audio recording
   */
  hasAudioRecording(filePathOrBuffer: ProcessorInput, elementId: string): boolean {
    let content = readTextFromInput(filePathOrBuffer);

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      for (const grid of grdFile.grids) {
        for (const element of grid.gridElements) {
          if (element.id === elementId) {
            return element.actions.some((action) => action.modelName === 'GridActionAudio');
          }
        }
      }
    } catch (error) {
      // If JSON parsing fails, return false
    }

    return false;
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }
}

export { AstericsGridProcessor };
