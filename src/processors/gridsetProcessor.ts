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
  GridSetMetadata,
} from '../core/treeStructure';
import { AACStyle } from '../types/aac';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { resolveGrid3CellImage } from './gridset/resolver';
import {
  extractAllButtonsForTranslation,
  validateTranslationResults,
  type ButtonForTranslation,
  type LLMLTranslationResult,
} from '../utilities/translation/translationProcessor';
import {
  getZipEntriesFromAdapter,
  resolveGridsetPassword,
  type ZipEntry,
} from './gridset/password';
import { decryptGridsetEntry } from './gridset/crypto';
import { GridsetValidator } from '../validation/gridsetValidator';
import { ValidationResult } from '../validation/validationTypes';
// New imports for enhanced Grid 3 support
import { detectPluginCellType, Grid3CellType } from './gridset/pluginTypes';
import { detectCommand } from './gridset/commands';
import { type SymbolReference, parseSymbolReference } from './gridset/symbols';
import { isSymbolLibraryReference } from './gridset/resolver';
import { generateCloneId } from '../utilities/analytics/utils/idGenerator';
import { translateWithSymbols, extractSymbolsFromButton } from './gridset/symbolAlignment';
import {
  ProcessorInput,
  readBinaryFromInput,
  decodeText,
  writeBinaryToPath,
  getNodeRequire,
  isNodeRuntime,
} from '../utils/io';
import { openZipFromInput } from '../utils/zip';

class GridsetProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }

  // Determine password to use when opening encrypted gridset archives (.gridsetx)
  private getGridsetPassword(source?: ProcessorInput): string | undefined {
    return resolveGridsetPassword(this.options, source);
  }

  // Helper function to ensure color has alpha channel (Grid3 format)
  private ensureAlphaChannel(color: string | undefined): string {
    if (!color) return '#FFFFFFFF';

    // Handle rgb() and rgba() formats
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0;
      const alphaHex = Math.round(a * 255)
        .toString(16)
        .toUpperCase()
        .padStart(2, '0');
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alphaHex}`;
    }

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
   * Calculate appropriate font color (black or white) based on background brightness
   * Uses WCAG relative luminance formula to determine contrast
   */
  private getContrastFontColor(backgroundColor: string | undefined): string {
    if (!backgroundColor) return '#FF000000FF'; // Default to black

    // Parse color from various formats
    let r = 255,
      g = 255,
      b = 255;

    // Handle hex colors
    const hexMatch = backgroundColor.match(/#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/);
    if (hexMatch) {
      r = parseInt(hexMatch[1], 16);
      g = parseInt(hexMatch[2], 16);
      b = parseInt(hexMatch[3], 16);
    } else {
      // Handle rgb() format
      const rgbMatch = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1]);
        g = parseInt(rgbMatch[2]);
        b = parseInt(rgbMatch[3]);
      }
    }

    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Use white text for dark backgrounds (luminance < 0.5), black for light backgrounds
    // Return 6-digit hex (ensureAlphaChannel will add FF for alpha)
    return luminance < 0.5 ? '#FFFFFF' : '#000000';
  }

  /**
   * Extract words from Grid3 WordList structure
   */
  private _extractWordsFromWordList(param: any): string[] {
    if (!param) return [];

    // Sometimes the param itself is the WordList, sometimes it has a WordList property
    const wordList =
      param.WordList || param.wordlist || (param.Items || param.items ? param : undefined);
    if (!wordList || !(wordList.Items || wordList.items)) return [];

    const items = wordList.Items?.WordListItem || wordList.items?.wordlistitem || [];
    const itemArr = Array.isArray(items) ? items : [items];
    const words: string[] = [];

    for (const item of itemArr) {
      const text = item.Text || item.text;
      if (text) {
        const val = this.textOf(text);
        if (val) words.push(val);
      } else if (item['#text'] !== undefined) {
        words.push(String(item['#text']));
      } else if (typeof item === 'string') {
        words.push(item);
      }
    }
    return words;
  }

  // Helper function to generate Grid3 commands from semantic actions
  private generateCommandsFromSemanticAction(button: AACButton, tree?: AACTree): any {
    const semanticAction = button.semanticAction;

    if (!semanticAction) {
      // Default to insert text action with structured XML format
      // Use two <s> elements: one for the word, one for the space (CDATA preserves whitespace)
      let text = button.message || button.label || '';
      // Remove trailing space from message if present (we'll add it as separate segment)
      if (text.endsWith(' ')) {
        text = text.slice(0, -1);
      }
      return {
        Command: {
          '@_ID': 'Action.InsertText',
          Parameter: {
            '@_Key': 'text',
            p: {
              s: [
                {
                  r: text,
                },
                {
                  r: { __cdata: ' ' },
                },
              ],
            },
          },
        },
      };
    }

    // Use platform-specific Grid3 data if available
    if (semanticAction.platformData?.grid3) {
      const grid3Data = semanticAction.platformData.grid3;
      const params = Object.entries(grid3Data.parameters || {}).map(([key, value]) => ({
        '@_Key': key,
        '#text': String(value),
      }));

      return {
        Command: {
          '@_ID': grid3Data.commandId,
          ...(params.length > 0 ? { Parameter: params } : {}),
        },
      };
    }

    // Convert semantic actions to Grid3 commands
    const intentStr = String(semanticAction.intent);
    switch (intentStr) {
      case 'NAVIGATE_TO': {
        // For Grid3, we need to use the grid name, not the ID
        let targetGridName = semanticAction.targetId || '';
        if (tree && semanticAction.targetId) {
          const targetPage = tree.getPage(semanticAction.targetId);
          if (targetPage) {
            targetGridName = targetPage.name || targetPage.id;
          }
        }
        return {
          Command: {
            '@_ID': 'Jump.To',
            Parameter: {
              '@_Key': 'grid',
              '#text': targetGridName,
            },
          },
        };
      }

      case 'GO_BACK':
        return {
          Command: {
            '@_ID': 'Jump.Back',
          },
        };

      case 'GO_HOME':
        return {
          Command: {
            '@_ID': 'Jump.Home',
          },
        };

      case 'DELETE_WORD':
        return {
          Command: {
            '@_ID': 'Action.DeleteWord',
          },
        };

      case 'DELETE_CHARACTER':
        return {
          Command: {
            '@_ID': 'Action.DeleteLetter',
          },
        };

      case 'CLEAR_TEXT':
        return {
          Command: {
            '@_ID': 'Action.Clear',
          },
        };

      case 'SPEAK_TEXT':
      case 'SPEAK_IMMEDIATE': {
        // Users can speak the complete sentence with a dedicated Speak button // Use two <s> elements: one for the word, one for the space (CDATA preserves whitespace) // Grid3 requires explicit trailing space for automatic word spacing // For communication buttons, insert text into message bar (sentence building)
        let text = semanticAction.text || button.message || button.label || '';
        // Remove trailing space from message if present (we'll add it as separate segment)
        if (text.endsWith(' ')) {
          text = text.slice(0, -1);
        }
        return {
          Command: {
            '@_ID': 'Action.InsertText',
            Parameter: {
              '@_Key': 'text',
              p: {
                s: [
                  {
                    r: text,
                  },
                  {
                    r: { __cdata: ' ' },
                  },
                ],
              },
            },
          },
        };
      }

      case 'INSERT_TEXT': {
        // Use two <s> elements: one for the word, one for the space (CDATA preserves whitespace) // Add trailing space for word buttons to enable sentence building
        let text = semanticAction.text || button.message || button.label || '';
        // Remove trailing space from message if present (we'll add it as separate segment)
        if (text.endsWith(' ')) {
          text = text.slice(0, -1);
        }
        return {
          Command: {
            '@_ID': 'Action.InsertText',
            Parameter: {
              '@_Key': 'text',
              p: {
                s: [
                  {
                    r: text,
                  },
                  {
                    r: { __cdata: ' ' },
                  },
                ],
              },
            },
          },
        };
      }

      default: {
        // Use two <s> elements: one for the word, one for the space (CDATA preserves whitespace)
        // Fallback to insert text with structured XML format
        let text = semanticAction.text || button.message || button.label || '';
        // Remove trailing space from message if present (we'll add it as separate segment)
        if (text.endsWith(' ')) {
          text = text.slice(0, -1);
        }
        return {
          Command: {
            '@_ID': 'Action.InsertText',
            Parameter: {
              '@_Key': 'text',
              p: {
                s: [
                  {
                    r: text,
                  },
                  {
                    r: { __cdata: ' ' },
                  },
                ],
              },
            },
          },
        };
      }
    }
  }

  // Helper function to convert Grid 3 style to AACStyle
  private convertGrid3StyleToAACStyle(grid3Style: any): any {
    if (!grid3Style) return {};

    return {
      backgroundColor: grid3Style.BackColour || grid3Style.TileColour,
      borderColor: grid3Style.BorderColour,
      fontColor: grid3Style.FontColour,
      fontFamily: grid3Style.FontName,
      fontSize: grid3Style.FontSize ? parseInt(String(grid3Style.FontSize)) : undefined,
      backgroundShape:
        grid3Style.BackgroundShape !== undefined
          ? parseInt(String(grid3Style.BackgroundShape))
          : undefined,
    };
  }

  // Helper function to get style by ID or return default
  private getStyleById(styles: Map<string, any>, styleId?: string): any {
    if (!styleId || !styles.has(styleId)) {
      return {};
    }
    return this.convertGrid3StyleToAACStyle(styles.get(styleId));
  }
  // Helper to safely extract text from XML parser values
  private textOf(val: any): string | undefined {
    if (!val) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);

    if (typeof val === 'object') {
      // Don't immediately return #text - it might be whitespace alongside structured content
      // Process structured format first: <p><s><r>text</r></s></p>

      // Handle Grid3 structured format <p><s><r>text</r></s></p>
      // Can start at p, s, or r level
      const parts: string[] = [];
      const processS = (s: any): void => {
        if (!s) return;
        if (s.r !== undefined) {
          const rElements = Array.isArray(s.r) ? s.r : [s.r];
          for (const r of rElements) {
            if (typeof r === 'number') {
              if (r !== 0) {
                parts.push(String(r));
              }
              continue;
            }
            if (typeof r === 'object' && r !== null) {
              // Check for #text (regular text) or #cdata (CDATA sections)
              if ('#text' in r) {
                parts.push(String(r['#text']));
              } else if ('#cdata' in r) {
                parts.push(String(r['#cdata']));
              } else {
                parts.push(String(r));
              }
            } else {
              parts.push(String(r));
            }
          }
        }
      };

      if (val.p) {
        const p = val.p;
        const sElements = Array.isArray(p.s) ? p.s : p.s ? [p.s] : [];
        sElements.forEach(processS);
      } else if (val.s) {
        const sElements = Array.isArray(val.s) ? val.s : [val.s];
        sElements.forEach(processS);
      } else if (val.r !== undefined) {
        processS(val);
      }

      if (parts.length > 0) {
        return parts.join('').trim();
      }
    }
    return undefined;
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

    return texts;
  }

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const tree = new AACTree();

    let zipResult: Awaited<ReturnType<typeof openZipFromInput>>;
    try {
      const zipInput = readBinaryFromInput(filePathOrBuffer);
      zipResult = this.options.zipAdapter
        ? await this.options.zipAdapter(zipInput)
        : await openZipFromInput(zipInput);
    } catch (error: any) {
      throw new Error(`Invalid ZIP file format: ${error.message}`);
    }
    const password = this.getGridsetPassword(filePathOrBuffer);
    const entries = getZipEntriesFromAdapter(zipResult.zip, password);
    const options = {
      ignoreAttributes: false,
      ignoreDeclaration: true,
      parseTagValue: false,
      trimValues: false,
      textNodeName: '#text',
      cdataProp: '#cdata',
    };
    const parser = new XMLParser(options);
    const isEncryptedArchive =
      typeof filePathOrBuffer === 'string' && filePathOrBuffer.toLowerCase().endsWith('.gridsetx');
    const encryptedContentPassword = this.getGridsetPassword(filePathOrBuffer);

    // Initialize metadata
    const metadata: GridSetMetadata = {
      format: 'gridset',
      isSmartBox: isEncryptedArchive, // SmartBox files are .gridsetx encrypted archives
      passwordProtected: !!password,
    };

    const readEntryBuffer = async (entry: ZipEntry): Promise<Uint8Array> => {
      const raw = await entry.getData();
      if (!isEncryptedArchive) {
        return raw;
      }
      return decryptGridsetEntry(Buffer.from(raw), encryptedContentPassword);
    };

    // Parse FileMap.xml if present to index dynamic files per grid
    const fileMapIndex = new Map<string, string[]>();
    try {
      const fmEntry = entries.find((e) => e.entryName.endsWith('FileMap.xml'));
      if (fmEntry) {
        const fmXml = decodeText(await readEntryBuffer(fmEntry));
        const fmData = parser.parse(fmXml);
        const entries = fmData?.FileMap?.Entries?.Entry || fmData?.fileMap?.entries?.entry;
        if (entries) {
          const arr = Array.isArray(entries) ? entries : [entries];
          for (const ent of arr) {
            const rawStaticFile = ent['@_StaticFile'] || ent.StaticFile || ent.staticFile;
            const staticFile =
              typeof rawStaticFile === 'string' ? rawStaticFile.replace(/\\/g, '/') : '';
            if (!staticFile) continue;
            const df = ent.DynamicFiles || ent.dynamicFiles;
            const candidates = df?.File || df?.file || df?.Files || df?.files;
            const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
            const files: string[] = [];
            for (const v of list) {
              if (!v) continue;
              if (typeof v === 'string') files.push(v.replace(/\\/g, '/'));
              else if (typeof v === 'object' && '#text' in v)
                files.push(String(v['#text']).replace(/\\/g, '/'));
            }
            fileMapIndex.set(staticFile, files);
          }
        }
      }
    } catch (e) {
      /* ignore: optional FileMap.xml may be missing or malformed */
    }

    // First, load styles from Settings0/Styles/styles.xml (Grid3 format)
    const styles = new Map<string, any>();
    const styleEntry = entries.find(
      (entry) => entry.entryName.endsWith('styles.xml') || entry.entryName.endsWith('style.xml')
    );
    if (styleEntry) {
      try {
        const styleXmlContent = decodeText(await readEntryBuffer(styleEntry));
        const styleData = parser.parse(styleXmlContent);
        // Parse styles and store them in the map
        // Grid3 uses StyleData.Styles.Style with Key attribute
        if (styleData.StyleData?.Styles?.Style) {
          const styleArray = Array.isArray(styleData.StyleData.Styles.Style)
            ? styleData.StyleData.Styles.Style
            : [styleData.StyleData.Styles.Style];
          styleArray.forEach((style: any) => {
            if (style['@_Key']) {
              styles.set(String(style['@_Key']), style);
            }
          });
        }
        // Also handle legacy format with @_ID
        else if (styleData.Styles?.Style) {
          const styleArray = Array.isArray(styleData.Styles.Style)
            ? styleData.Styles.Style
            : [styleData.Styles.Style];
          styleArray.forEach((style: any) => {
            if (style['@_ID']) {
              styles.set(String(style['@_ID']), style);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to parse styles.xml:', e);
      }
    }

    // Debug: log all entry names
    console.log('[Gridset] Total zip entries:', entries.length);
    const normalizeEntryName = (entryName: string): string =>
      entryName.replace(/\\/g, '/').toLowerCase();
    const isGridXmlEntry = (entryName: string): boolean => {
      const normalized = normalizeEntryName(entryName);
      if (!normalized.endsWith('grid.xml')) return false;
      return normalized.startsWith('grids/') || normalized.includes('/grids/');
    };
    const gridEntries = entries.filter((e) => isGridXmlEntry(e.entryName));
    console.log('[Gridset] Grid XML entries found:', gridEntries.length);
    if (gridEntries.length > 0) {
      console.log(
        '[Gridset] First few grid entries:',
        gridEntries.slice(0, 3).map((e) => e.entryName)
      );
    }

    // Pre-load all image data for conversion to other formats (e.g., Snap)
    const imageDataCache = new Map<string, Buffer>();
    const imageEntries = entries.filter((e) => {
      const name = e.entryName.toLowerCase();
      return (
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.gif') ||
        name.endsWith('.svg')
      );
    });

    for (const imageEntry of imageEntries) {
      try {
        const raw = await imageEntry.getData();
        const data = isEncryptedArchive
          ? decryptGridsetEntry(Buffer.from(raw), encryptedContentPassword)
          : Buffer.from(raw);
        const normalizedEntry = imageEntry.entryName.replace(/\\/g, '/');
        imageDataCache.set(normalizedEntry, data);
      } catch (err) {
        // Silently fail - individual image loading failures shouldn't break the entire load
      }
    }

    // First pass: collect all grid names and IDs for navigation resolution
    const gridNameToIdMap = new Map<string, string>();
    const gridIdToNameMap = new Map<string, string>();

    for (const entry of entries) {
      if (isGridXmlEntry(entry.entryName)) {
        try {
          const xmlContent = decodeText(await readEntryBuffer(entry));
          const data = parser.parse(xmlContent);
          const grid = data.Grid || data.grid;
          if (!grid) continue;

          const gridId = this.textOf(grid.GridGuid || grid.gridGuid || grid.id);
          const gridName =
            this.textOf(grid.Name) || this.textOf(grid.name) || this.textOf(grid['@_Name']);

          const folderMatch = entry.entryName.match(/^Grids\/([^/]+)\//);
          const folderName = folderMatch ? folderMatch[1] : undefined;

          if (gridId) {
            if (gridName) {
              gridNameToIdMap.set(gridName, gridId);
              gridIdToNameMap.set(gridId, gridName);
            }
            if (folderName) {
              // Folder name is often used as the grid name in Jump.To commands
              gridNameToIdMap.set(folderName, gridId);
              if (!gridName) {
                gridIdToNameMap.set(gridId, folderName);
              }
            }
          }
        } catch (e) {
          // Skip errors in first pass
        }
      }
    }

    // Second pass: process each grid file in the gridset
    for (const entry of entries) {
      // Only process files named grid.xml under Grids/ (any subdir)
      if (isGridXmlEntry(entry.entryName)) {
        let xmlContent: string;
        try {
          const buffer = await readEntryBuffer(entry);
          xmlContent = decodeText(buffer);
          console.log(
            `[Gridset] Raw XML content (first 200 chars) for ${entry.entryName}:`,
            xmlContent.substring(0, 200)
          );
        } catch (e) {
          // Skip unreadable files
          continue;
        }
        let data: Record<string, unknown>;
        try {
          data = parser.parse(xmlContent) as Record<string, unknown>;
          console.log(`[Gridset] Parsed ${entry.entryName}, root keys:`, Object.keys(data));
        } catch (error: any) {
          // Skip malformed XML but log the specific error
          console.warn(`Malformed XML in ${entry.entryName}: ${error.message}`);
          continue;
        }

        // Grid3 XML: <Grid> root
        const grid = (data as { Grid?: any; grid?: any }).Grid || (data as { grid?: any }).grid;
        if (!grid) {
          console.warn(`[Gridset] No Grid/grid found in ${entry.entryName}`);
          continue;
        }
        // Defensive: GridGuid and Name required
        const gridId = this.textOf(grid.GridGuid || grid.gridGuid || grid.id);
        let gridName =
          this.textOf(grid.Name) || this.textOf(grid.name) || this.textOf(grid['@_Name']);
        if (!gridName) {
          // Fallback: get folder name from entry path
          const match = entry.entryName.match(/^Grids\/([^/]+)\//);
          if (match) gridName = match[1];
        }
        if (!gridId || !gridName) {
          continue;
        }

        const page = new AACPage({
          id: String(gridId),
          name: String(gridName),
          grid: [],
          buttons: [],
          parentId: null,
          style: {
            backgroundColor: grid.BackgroundColour || grid.backgroundColour,
          },
        });

        // Calculate grid dimensions from ColumnDefinitions and RowDefinitions
        const columnDefs = grid.ColumnDefinitions?.ColumnDefinition || [];
        const rowDefs = grid.RowDefinitions?.RowDefinition || [];
        const maxCols = Array.isArray(columnDefs) ? columnDefs.length : columnDefs ? 1 : 5;
        const maxRows = Array.isArray(rowDefs) ? rowDefs.length : rowDefs ? 1 : 4;

        // Process buttons: <Cells><Cell>
        const cells = grid.Cells?.Cell || grid.cells?.cell;
        if (cells) {
          // Cells may be array or single object
          const cellArr = Array.isArray(cells) ? cells : [cells];

          // Create a 2D grid to track button positions
          const gridLayout: (AACButton | null)[][] = [];
          for (let r = 0; r < maxRows; r++) {
            gridLayout[r] = new Array(maxCols).fill(null);
          }

          // Track grid-level prediction wordlists so we can attach them to AutoContent
          const gridPredictionWords: string[] = [];
          let predictionCellCounter = 0;

          // Extract words from grid-level AutoContentCommands (e.g., Prediction Bar)
          if (grid.AutoContentCommands) {
            const collections = grid.AutoContentCommands.AutoContentCommandCollection;
            const collectionArr = Array.isArray(collections)
              ? collections
              : collections
                ? [collections]
                : [];

            collectionArr.forEach((collection: any) => {
              const commands = collection.Commands?.Command;
              const commandArr = Array.isArray(commands) ? commands : commands ? [commands] : [];

              commandArr.forEach((command: any) => {
                const commandId = command['@_ID'] || command.ID || command.id;
                if (commandId === 'Prediction.PredictThis') {
                  const params = command.Parameter;
                  const paramArr = Array.isArray(params) ? params : params ? [params] : [];
                  const wordListParam = paramArr.find(
                    (p: any) => (p['@_Key'] || p.Key || p.key) === 'wordlist'
                  );

                  if (wordListParam) {
                    const words = this._extractWordsFromWordList(wordListParam);
                    gridPredictionWords.push(...words);
                  }
                }
              });
            });
          }

          // Extract page-level WordList (for WordList AutoContent cells)
          // Page-level WordList is separate from AutoContentCommands and provides
          // content for cells with ContentType="AutoContent" and ContentSubType="WordList"
          interface PageWordListItem {
            text: string;
            image?: string;
            partOfSpeech?: string;
          }
          const pageWordListItems: PageWordListItem[] = [];
          if (grid.WordList && grid.WordList.Items) {
            const items =
              grid.WordList.Items.WordListItem || grid.WordList.Items.wordlistitem || [];
            const itemArr = Array.isArray(items) ? items : items ? [items] : [];

            for (const item of itemArr) {
              const text = item.Text || item.text;
              if (text) {
                const val = this.textOf(text);
                if (val) {
                  // Debug: log WordList items with spaces to check extraction
                  if (pageWordListItems.length < 3) {
                    console.log(
                      `[WordList] Extracted text: "${val}" (length: ${val.length}, has spaces: ${val.includes(' ')})`
                    );
                    console.log(
                      `[WordList] Chars:`,
                      Array.from(val)
                        .map((c) => `"${c}" (${c.charCodeAt(0)})`)
                        .join(', ')
                    );
                  }
                  pageWordListItems.push({
                    text: val,
                    image: item.Image || item.image || undefined,
                    partOfSpeech: item.PartOfSpeech || item.partOfSpeech || undefined,
                  });
                }
              }
            }
          }

          // Track WordList AutoContent cells and their positions for "more" button placement
          const wordListAutoContentCells: Array<{
            cell: any;
            idx: number;
            x: number;
            y: number;
          }> = [];
          let wordListCellIndex = 0;

          // Helper function to find next available position in grid (auto-flow)
          // Returns {x, y} for next available slot that can accommodate the given span
          const findNextAvailablePosition = (
            width: number,
            height: number,
            gridLayout: (AACButton | null)[][]
          ): { x: number; y: number } => {
            for (let y = 0; y < maxRows; y++) {
              for (let x = 0; x <= maxCols - width; x++) {
                // Check if this position and the required span area are all free
                let fits = true;
                for (let dy = 0; dy < height && y + dy < maxRows; dy++) {
                  for (let dx = 0; dx < width && x + dx < maxCols; dx++) {
                    if (gridLayout[y + dy][x + dx] !== null) {
                      fits = false;
                      break;
                    }
                  }
                  if (!fits) break;
                }
                if (fits) {
                  return { x, y };
                }
              }
            }
            // If no position found, return 0,0 (will be placed at first available)
            return { x: 0, y: 0 };
          };

          // Helper function to find next available X position in a specific row
          const findNextAvailableXInRow = (
            rowY: number,
            width: number,
            gridLayout: (AACButton | null)[][]
          ): number => {
            for (let x = 0; x <= maxCols - width; x++) {
              let fits = true;
              for (let dx = 0; dx < width; dx++) {
                if (gridLayout[rowY][x + dx] !== null) {
                  fits = false;
                  break;
                }
              }
              if (fits) return x;
            }
            return 0;
          };

          // First pass: categorize cells by their positioning
          interface CellWithIndex {
            cell: any;
            idx: number;
          }
          const cellsWithExplicitPosition: CellWithIndex[] = [];
          const cellsWithYOnly: CellWithIndex[] = [];
          const cellsWithXOnly: CellWithIndex[] = [];
          const cellsWithAutoFlow: CellWithIndex[] = [];

          cellArr.forEach((cell: any, idx: number) => {
            if (!cell || !cell.Content) return;

            const hasX = cell['@_X'] !== undefined;
            const hasY = cell['@_Y'] !== undefined;

            if (hasX && hasY) {
              cellsWithExplicitPosition.push({ cell, idx });
            } else if (hasY && !hasX) {
              cellsWithYOnly.push({ cell, idx });
            } else if (!hasY && hasX) {
              cellsWithXOnly.push({ cell, idx });
            } else {
              cellsWithAutoFlow.push({ cell, idx });
            }
          });

          // Process cells in order: explicit -> Y-only -> X-only -> auto-flow
          const allCellsToProcess = [
            ...cellsWithExplicitPosition,
            ...cellsWithYOnly,
            ...cellsWithXOnly,
            ...cellsWithAutoFlow,
          ];

          allCellsToProcess.forEach(({ cell, idx }) => {
            // Extract span information first
            const colSpan = parseInt(String(cell['@_ColumnSpan'] || '1'), 10);
            const rowSpan = parseInt(String(cell['@_RowSpan'] || '1'), 10);

            // Determine position based on what attributes are present
            const hasX = cell['@_X'] !== undefined;
            const hasY = cell['@_Y'] !== undefined;

            let cellX: number;
            let cellY: number;

            if (hasX && hasY) {
              // Explicit position: both X and Y provided
              // Grid 3 XML coordinates are already 0-based, use them directly
              cellX = Math.max(0, parseInt(String(cell['@_X']), 10));
              cellY = Math.max(0, parseInt(String(cell['@_Y']), 10));
            } else if (hasY && !hasX) {
              // Y-only: auto-flow X in the specified row
              // Grid 3 XML coordinates are already 0-based, use them directly
              cellY = Math.max(0, parseInt(String(cell['@_Y']), 10));
              cellX = findNextAvailableXInRow(cellY, colSpan, gridLayout);
            } else if (!hasY && hasX) {
              // X-only: place at specified X in next available row
              // Grid 3 XML coordinates are already 0-based, use them directly
              cellX = Math.max(0, parseInt(String(cell['@_X']), 10));
              // Find first row where this X position is available
              cellY = 0;
              let found = false;
              for (let y = 0; y < maxRows; y++) {
                let fits = true;
                for (let dx = 0; dx < colSpan && cellX + dx < maxCols; dx++) {
                  if (gridLayout[y][cellX + dx] !== null) {
                    fits = false;
                    break;
                  }
                }
                if (fits) {
                  cellY = y;
                  found = true;
                  break;
                }
              }
              if (!found) {
                // No available row found, use auto-flow
                const pos = findNextAvailablePosition(colSpan, rowSpan, gridLayout);
                cellX = pos.x;
                cellY = pos.y;
              }
            } else {
              // No position: auto-flow both X and Y
              const pos = findNextAvailablePosition(colSpan, rowSpan, gridLayout);
              cellX = pos.x;
              cellY = pos.y;
            }

            // Extract scan block number (1-8) for block scanning support
            const scanBlock = parseInt(String(cell['@_ScanBlock'] || '1'), 10);

            // Extract visibility from Grid 3's <Visibility> child element
            // Grid 3 stores visibility as a child element, not an attribute
            // Valid values: Visible, Hidden, Disabled, PointerAndTouchOnly, TouchOnly, PointerOnly
            const grid3Visibility = cell.Visibility || cell.visibility;

            // Map Grid 3 visibility values to AAC standard values
            // Grid 3 can have additional values like TouchOnly, PointerOnly that map to PointerAndTouchOnly
            let cellVisibility:
              | 'Visible'
              | 'Hidden'
              | 'Disabled'
              | 'PointerAndTouchOnly'
              | 'Empty'
              | undefined;
            if (grid3Visibility) {
              const vis = String(grid3Visibility);
              // Direct mapping for standard values
              if (
                vis === 'Visible' ||
                vis === 'Hidden' ||
                vis === 'Disabled' ||
                vis === 'PointerAndTouchOnly'
              ) {
                cellVisibility = vis;
              }
              // Map Grid 3 specific values to AAC standard
              else if (vis === 'TouchOnly' || vis === 'PointerOnly') {
                cellVisibility = 'PointerAndTouchOnly';
              }
              // Grid 3 may use 'Empty' for cells that exist but have no content
              else if (vis === 'Empty') {
                cellVisibility = 'Empty';
              }
              // Unknown visibility - default to Visible
              else {
                cellVisibility = undefined; // Let it default
              }
            }

            // Extract label from CaptionAndImage/Caption
            const content = cell.Content;
            const captionAndImage = content.CaptionAndImage || content.captionAndImage;
            let label = this.textOf(captionAndImage?.Caption || captionAndImage?.caption) || '';

            // Check if cell has an image/symbol (needed to decide if we should keep it)
            const hasImageCandidate = !!(
              captionAndImage?.Image ||
              captionAndImage?.image ||
              captionAndImage?.ImageName ||
              captionAndImage?.imageName ||
              captionAndImage?.Symbol ||
              captionAndImage?.symbol
            );

            // If no caption, try other sources or create a placeholder
            if (!label) {
              // For cells without captions, check if they have images/symbols before skipping
              if (content.ContentType === 'AutoContent') {
                label = `AutoContent_${idx}`;
              } else if (
                hasImageCandidate ||
                content.ContentType === 'Workspace' ||
                content.ContentType === 'LiveCell'
              ) {
                // Keep cells with images/symbols even if no caption
                label = `Cell_${idx}`;
              } else {
                return; // Skip cells without labels AND without images/symbols
              }
            }

            let message = label; // Use caption as message

            // Detect plugin cell type (Workspace, LiveCell, AutoContent)
            const pluginMetadata = detectPluginCellType(content);

            // Friendly labels for workspace/prediction cells when captions are missing
            if (pluginMetadata.cellType === Grid3CellType.Workspace) {
              if (!label || label.startsWith('Cell_')) {
                label =
                  pluginMetadata.displayName ||
                  pluginMetadata.subType ||
                  pluginMetadata.pluginId ||
                  'Workspace';
              }
            }

            if (
              pluginMetadata.cellType === Grid3CellType.AutoContent &&
              pluginMetadata.autoContentType === 'Prediction'
            ) {
              predictionCellCounter += 1;
              // Always surface a friendly label for predictions even if a placeholder exists
              label = `Prediction ${predictionCellCounter}`;
            }

            // Handle WordList AutoContent cells - populate from page-level WordList
            let isMoreButton = false;
            if (
              pluginMetadata.cellType === Grid3CellType.AutoContent &&
              pluginMetadata.autoContentType === 'WordList' &&
              pageWordListItems.length > 0
            ) {
              // Track this cell for potential "more" button
              wordListAutoContentCells.push({
                cell,
                idx,
                x: cellX,
                y: cellY,
              });

              // Check if we have more WordList items than available cells
              // The "more" button replaces the last WordList cell
              const cellsNeededForWordList = pageWordListItems.length;
              const availableWordListCells = wordListAutoContentCells.length;
              const isLastWordListCell = availableWordListCells === cellsNeededForWordList + 1; // +1 for "more" button

              if (isLastWordListCell) {
                // This cell becomes the "more" button
                label = 'more...';
                message = 'more...';
                isMoreButton = true;
              } else if (wordListCellIndex < pageWordListItems.length) {
                // Populate this cell with the next WordList item
                const wordListItem = pageWordListItems[wordListCellIndex];
                label = wordListItem.text;
                message = wordListItem.text;
                // Use the WordList item's image if available
                if (wordListItem.image && !label) {
                  label = wordListItem.image; // Fallback to image path if no text
                }
                wordListCellIndex++;
              } else {
                // No more WordList items - skip this cell
                return;
              }
            }

            // Parse all command types from Grid3 and create semantic actions
            let semanticAction: AACSemanticAction | undefined;
            let legacyAction: any = null;
            // infer action type implicitly from commands; no explicit enum needed
            let navigationTarget: string | undefined;
            let detectedCommands: any[] = []; // Store detected command metadata

            const commands = content.Commands?.Command || content.commands?.command;
            let predictionWords: string[] | undefined;

            // Resolve image for this cell using FileMap and coordinate heuristics
            const imageCandidate =
              captionAndImage?.Image ||
              captionAndImage?.image ||
              captionAndImage?.ImageName ||
              captionAndImage?.imageName ||
              captionAndImage?.Symbol ||
              captionAndImage?.symbol;
            const declaredImageName = imageCandidate ? this.textOf(imageCandidate) : undefined;
            const gridEntryPath = entry.entryName.replace(/\\/g, '/');
            const baseDir = gridEntryPath.replace(/\/grid\.xml$/, '/');
            const dynamicFiles = fileMapIndex.get(gridEntryPath) || [];
            const resolvedImageEntry =
              resolveGrid3CellImage(
                null,
                {
                  baseDir,
                  imageName: declaredImageName,
                  x: cellX,
                  y: cellY,
                  dynamicFiles,
                },
                entries
              ) || undefined;

            // Debug: log resolution for cells with images
            if (declaredImageName && resolvedImageEntry) {
              console.log(
                `[GridsetProcessor] Cell (${cellX + 1},${cellY + 1}) [XML coords]: ${declaredImageName} -> ${resolvedImageEntry}`
              );
            } else if (declaredImageName && !resolvedImageEntry) {
              console.log(
                `[GridsetProcessor] Cell (${cellX + 1},${cellY + 1}) [XML coords]: ${declaredImageName} -> NOT FOUND`
              );
            }

            // Load binary image data from cache for conversion to other formats (e.g., Snap)
            const imageData = resolvedImageEntry
              ? imageDataCache.get(resolvedImageEntry)
              : undefined;

            // Check if image is a symbol library reference
            let symbolLibraryRef: SymbolReference | null = null;
            if (declaredImageName && isSymbolLibraryReference(declaredImageName)) {
              symbolLibraryRef = parseSymbolReference(declaredImageName);
            }

            if (commands) {
              const commandArr = Array.isArray(commands) ? commands : [commands];
              detectedCommands = commandArr.map((cmd) => detectCommand(cmd));

              // Scan all commands for vocabulary (predictions) before identifying primary action
              commandArr.forEach((cmd) => {
                const id = cmd['@_ID'] || cmd.ID || cmd.id;
                if (id === 'Prediction.PredictThis') {
                  const params = cmd.Parameter || cmd.parameter;
                  const pArr = params ? (Array.isArray(params) ? params : [params]) : [];
                  let wlP: any;
                  for (const p of pArr) {
                    if (p['@_Key'] === 'wordlist' || p.Key === 'wordlist' || p.key === 'wordlist') {
                      wlP = p;
                      break;
                    }
                  }
                  if (wlP) {
                    const words = this._extractWordsFromWordList(wlP);
                    if (words.length > 0) {
                      predictionWords = words;
                    }
                  }
                }
              });

              for (const command of commandArr) {
                const commandId = command['@_ID'] || command.ID || command.id;
                const parameters = command.Parameter || command.parameter;
                const paramArr = parameters
                  ? Array.isArray(parameters)
                    ? parameters
                    : [parameters]
                  : [];

                // Helper to get raw parameter object
                const getRawParam = (key: string): any | undefined => {
                  for (const param of paramArr) {
                    if (param['@_Key'] === key || param.Key === key || param.key === key) {
                      return param;
                    }
                  }
                  return undefined;
                };

                // Helper to get parameter value
                const getParam = (key: string): string | undefined => {
                  const param = getRawParam(key);
                  if (param === undefined) return undefined;
                  const simpleValue = param['#text'] ?? param.text ?? param.value;
                  if (typeof simpleValue === 'string') return simpleValue;
                  if (typeof simpleValue === 'number') return String(simpleValue);
                  const structuredValue = this.textOf(param);
                  if (structuredValue !== undefined) return structuredValue;
                  if (typeof param === 'string') return param;
                  return undefined;
                };

                // Skip PredictThis in primary action loop as it was handled in pre-pass
                // unless we need a primary action and nothing else exists
                if (commandId === 'Prediction.PredictThis') {
                  const wlParam = getRawParam('wordlist');
                  const words = wlParam ? this._extractWordsFromWordList(wlParam) : [];
                  if (words.length > 0) {
                    predictionWords = words;
                  }

                  if (!semanticAction && words.length > 0) {
                    semanticAction = {
                      category: AACSemanticCategory.COMMUNICATION,
                      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                      text: words.slice(0, 3).join(', '),
                      platformData: {
                        grid3: { commandId, parameters: { wordlist: words } },
                      },
                      fallback: { type: 'ACTION', message: 'Predict words' },
                    };
                  }
                  continue;
                }

                switch (commandId) {
                  case 'Jump.To': {
                    const gridTarget = getParam('grid');
                    if (gridTarget) {
                      // Resolve grid name to grid ID for navigation
                      const targetGridId = gridNameToIdMap.get(gridTarget) || gridTarget;
                      navigationTarget = targetGridId;
                      // navigate action
                      semanticAction = {
                        category: AACSemanticCategory.NAVIGATION,
                        intent: AACSemanticIntent.NAVIGATE_TO,
                        targetId: targetGridId,
                        platformData: {
                          grid3: {
                            commandId,
                            parameters: { grid: gridTarget },
                          },
                        },
                        fallback: {
                          type: 'NAVIGATE',
                          targetPageId: targetGridId,
                        },
                      };
                      legacyAction = {
                        type: 'NAVIGATE',
                        targetPageId: targetGridId,
                      };
                    }
                    break;
                  }

                  case 'Jump.Back':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.NAVIGATION,
                      intent: AACSemanticIntent.GO_BACK,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Go back',
                      },
                    };
                    legacyAction = {
                      type: 'GO_BACK',
                    };
                    break;

                  case 'Jump.Home':
                  case 'Jump.SetHome':
                    // action
                    navigationTarget = tree.rootId || undefined;
                    semanticAction = {
                      category: AACSemanticCategory.NAVIGATION,
                      intent: AACSemanticIntent.GO_HOME,
                      targetId: tree.rootId || undefined,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Go home',
                      },
                    };
                    legacyAction = {
                      type: 'GO_HOME',
                    };
                    break;

                  case 'Jump.ToKeyboard': {
                    // Navigate to the set keyboard if we found one in settings
                    const keyboardGridName = (tree as any).keyboardGridName as string;
                    const keyboardPageId = gridNameToIdMap.get(keyboardGridName);
                    if (keyboardPageId) {
                      navigationTarget = keyboardPageId;
                    }
                    semanticAction = {
                      category: AACSemanticCategory.NAVIGATION,
                      intent: AACSemanticIntent.GO_HOME, // Close enough to 'navigation to keyboard'
                      targetId: keyboardPageId,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'NAVIGATE',
                        targetPageId: keyboardPageId,
                      },
                    };
                    break;
                  }

                  case 'Action.InsertTextAndSpeak': {
                    const insertText = getParam('text');
                    semanticAction = {
                      category: AACSemanticCategory.COMMUNICATION,
                      intent: AACSemanticIntent.SPEAK_IMMEDIATE,
                      text: insertText,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: { text: insertText },
                        },
                      },
                      fallback: {
                        type: 'SPEAK',
                        message: insertText,
                      },
                    };
                    break;
                  }

                  case 'Prediction.PredictThis': {
                    const wlParam = getRawParam('wordlist');
                    const words = wlParam ? this._extractWordsFromWordList(wlParam) : [];
                    if (words.length > 0) {
                      predictionWords = words;
                      if (!semanticAction) {
                        semanticAction = {
                          category: AACSemanticCategory.COMMUNICATION,
                          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                          text: words.slice(0, 3).join(', '), // Provide first few as preview
                          platformData: {
                            grid3: {
                              commandId,
                              parameters: { wordlist: words },
                            },
                          },
                          fallback: {
                            type: 'ACTION',
                            message: 'Predict words',
                          },
                        };
                      }
                    }
                    // Continue to check other commands (e.g. Action.InsertText)
                    continue;
                  }

                  case 'Action.Speak': {
                    // speak
                    const speakUnit = getParam('unit');
                    const moveCaret = getParam('movecaret');
                    semanticAction = {
                      category: AACSemanticCategory.COMMUNICATION,
                      intent: AACSemanticIntent.SPEAK_TEXT,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {
                            unit: speakUnit,
                            movecaret: moveCaret,
                          },
                        },
                      },
                      fallback: {
                        type: 'SPEAK',
                        message: 'Speak text',
                      },
                    };
                    legacyAction = {
                      type: 'SPEAK',
                      unit: speakUnit,
                      moveCaret: moveCaret ? parseInt(String(moveCaret)) : undefined,
                    };
                    break;
                  }

                  case 'Action.InsertText': {
                    // speak
                    const insertText = getParam('text');
                    semanticAction = {
                      category: AACSemanticCategory.COMMUNICATION,
                      intent: AACSemanticIntent.INSERT_TEXT,
                      text: insertText,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: { text: insertText },
                        },
                      },
                      fallback: {
                        type: 'SPEAK',
                        message: insertText,
                      },
                    };
                    legacyAction = {
                      type: 'INSERT_TEXT',
                      text: insertText,
                    };
                    break;
                  }

                  case 'Action.DeleteWord':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.TEXT_EDITING,
                      intent: AACSemanticIntent.DELETE_WORD,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Delete word',
                      },
                    };
                    legacyAction = {
                      type: 'DELETE_WORD',
                    };
                    break;

                  case 'Action.DeleteLetter':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.TEXT_EDITING,
                      intent: AACSemanticIntent.DELETE_CHARACTER,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Delete character',
                      },
                    };
                    legacyAction = {
                      type: 'DELETE_CHARACTER',
                    };
                    break;

                  case 'Action.Clear':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.TEXT_EDITING,
                      intent: AACSemanticIntent.CLEAR_TEXT,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Clear text',
                      },
                    };
                    legacyAction = {
                      type: 'CLEAR_TEXT',
                    };
                    break;

                  case 'Action.Letter': {
                    // action
                    const letter = getParam('letter');
                    semanticAction = {
                      category: AACSemanticCategory.TEXT_EDITING,
                      intent: AACSemanticIntent.INSERT_TEXT,
                      text: letter,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: { letter },
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: letter,
                      },
                    };
                    legacyAction = {
                      type: 'INSERT_LETTER',
                      letter,
                    };
                    break;
                  }

                  case 'Settings.RestAll':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.CUSTOM,
                      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {
                            indicatorenabled: getParam('indicatorenabled'),
                            action: getParam('action'),
                          },
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Settings action',
                      },
                    };
                    legacyAction = {
                      type: 'SETTINGS',
                      indicatorEnabled: getParam('indicatorenabled') === '1',
                      settingsAction: getParam('action'),
                    };
                    break;

                  case 'AutoContent.Activate':
                    // action
                    semanticAction = {
                      category: AACSemanticCategory.CUSTOM,
                      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {
                            autocontenttype: getParam('autocontenttype'),
                          },
                        },
                      },
                      fallback: {
                        type: 'ACTION',
                        message: 'Auto content',
                      },
                    };
                    legacyAction = {
                      type: 'AUTO_CONTENT',
                      autoContentType: getParam('autocontenttype'),
                    };
                    break;

                  default:
                    // Unknown command - preserve as generic action
                    if (commandId) {
                      // action
                      const allParams = Object.fromEntries(
                        paramArr.map((p) => [p.Key || p.key, p['#text']])
                      );
                      semanticAction = {
                        category: AACSemanticCategory.CUSTOM,
                        intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                        platformData: {
                          grid3: {
                            commandId,
                            parameters: allParams,
                          },
                        },
                        fallback: {
                          type: 'ACTION',
                          message: 'Unknown command',
                        },
                      };
                      legacyAction = {
                        type: 'SPEAK',
                        parameters: { commandId, ...allParams },
                      };
                    }
                    break;
                }

                // Use first recognized command
                if (semanticAction || legacyAction) break;
              }
            }

            // Create default semantic action if none was created from commands
            if (!semanticAction) {
              semanticAction = {
                category: AACSemanticCategory.COMMUNICATION,
                intent: AACSemanticIntent.SPEAK_TEXT,
                text: String(message),
                fallback: {
                  type: 'SPEAK',
                  message: String(message),
                },
              };
            }

            // Get style information from cell attributes and Content.Style
            let cellStyleId = cell['@_StyleID'] || cell['@_styleid'];

            // Grid3 format: check Content.Style.BasedOnStyle
            if (!cellStyleId && content.Style?.BasedOnStyle) {
              cellStyleId = content.Style.BasedOnStyle;
            }

            const cellStyle = this.getStyleById(
              styles,
              cellStyleId ? String(cellStyleId) : undefined
            );

            // Also check for inline style overrides
            const inlineStyle: any = {};
            if (cell['@_BackColour']) inlineStyle.backgroundColor = cell['@_BackColour'];
            if (cell['@_FontColour']) inlineStyle.fontColor = cell['@_FontColour'];
            if (cell['@_BorderColour']) inlineStyle.borderColor = cell['@_BorderColour'];

            // Grid3 inline styles from Content.Style
            if (content.Style) {
              if (content.Style.BackColour) inlineStyle.backgroundColor = content.Style.BackColour;
              if (content.Style.FontColour) inlineStyle.fontColor = content.Style.FontColour;
              if (content.Style.BorderColour) inlineStyle.borderColor = content.Style.BorderColour;
              if (content.Style.FontName) inlineStyle.fontFamily = content.Style.FontName;
              if (content.Style.FontSize)
                inlineStyle.fontSize = parseInt(String(content.Style.FontSize));
            }

            // Extract grammar tags from commands (Smart Grammar)
            const grammar: Record<string, string> = {};
            detectedCommands.forEach((cmd) => {
              if (cmd.parameters.pos) grammar.pos = cmd.parameters.pos;
              if (cmd.parameters.person) grammar.person = cmd.parameters.person;
              if (cmd.parameters.number) grammar.number = cmd.parameters.number;
              if (cmd.parameters.feature) grammar.feature = cmd.parameters.feature;
            });
            const isSmartGrammarCell = Object.keys(grammar).length > 0;

            const button = new AACButton({
              id: `${gridId}_btn_${idx}`,
              label: String(label),
              message: String(message),
              targetPageId: navigationTarget ? String(navigationTarget) : undefined,
              semanticAction: semanticAction,
              semantic_id: cell.semantic_id || cell.SemanticId || undefined, // Extract semantic_id if present
              image: declaredImageName,
              resolvedImageEntry: resolvedImageEntry,
              x: cellX,
              y: cellY,
              columnSpan: colSpan,
              rowSpan: rowSpan,
              scanBlock: scanBlock, // Add scan block number for block scanning metrics
              contentType:
                pluginMetadata.cellType === Grid3CellType.Regular
                  ? 'Normal'
                  : pluginMetadata.cellType === Grid3CellType.Workspace
                    ? 'Workspace'
                    : pluginMetadata.cellType === Grid3CellType.LiveCell
                      ? 'LiveCell'
                      : 'AutoContent',
              contentSubType:
                pluginMetadata.subType ||
                pluginMetadata.liveCellType ||
                pluginMetadata.autoContentType,
              symbolLibrary: symbolLibraryRef?.library || undefined,
              symbolPath: symbolLibraryRef?.path || undefined,
              visibility: cellVisibility,
              style: {
                ...cellStyle,
                ...inlineStyle, // Inline styles override referenced styles
              },
              // Store predictions directly on button for easy access
              predictions: predictionWords?.length
                ? [...predictionWords]
                : gridPredictionWords.length > 0
                  ? [...gridPredictionWords]
                  : undefined,
              parameters: {
                pluginMetadata: pluginMetadata, // Store full plugin metadata for future use
                grid3Commands: detectedCommands, // Store detected command metadata
                symbolLibraryRef: symbolLibraryRef, // Store full symbol reference
                grammar: isSmartGrammarCell ? grammar : undefined,
                isSmartGrammarCell: isSmartGrammarCell,
                predictions: predictionWords?.length
                  ? [...predictionWords]
                  : gridPredictionWords.length > 0
                    ? [...gridPredictionWords]
                    : undefined,
                predictionSlot:
                  pluginMetadata.cellType === Grid3CellType.AutoContent &&
                  pluginMetadata.autoContentType === 'Prediction'
                    ? predictionCellCounter
                    : undefined,
                // Store page name for Grid3 image lookup
                gridPageName: gridName,
                // Store WordList "more" button flag
                isMoreButton: isMoreButton || undefined,
                wordListItemIndex:
                  pluginMetadata.cellType === Grid3CellType.AutoContent &&
                  pluginMetadata.autoContentType === 'WordList' &&
                  !isMoreButton
                    ? wordListCellIndex - 1
                    : undefined,
                // Store binary image data for conversion to other formats
                ...(imageData ? { imageData, image_id: resolvedImageEntry } : {}),
              },
            });

            // Add button to page
            page.addButton(button);

            // Place button in grid layout (handle colspan/rowspan)
            for (let r = cellY; r < cellY + rowSpan && r < maxRows; r++) {
              for (let c = cellX; c < cellX + colSpan && c < maxCols; c++) {
                if (gridLayout[r] && gridLayout[r][c] === null) {
                  gridLayout[r][c] = button;
                }
              }
            }
          });

          // Set the page's grid layout
          page.grid = gridLayout;

          // Generate clone_id for each button in the grid
          const semanticIds: string[] = [];
          const cloneIds: string[] = [];

          gridLayout.forEach((row, rowIndex) => {
            row.forEach((btn, colIndex) => {
              if (btn) {
                // Generate clone_id based on position and label
                btn.clone_id = generateCloneId(maxRows, maxCols, rowIndex, colIndex, btn.label);
                cloneIds.push(btn.clone_id);

                // Track semantic_id if present
                if (btn.semantic_id) {
                  semanticIds.push(btn.semantic_id);
                }
              }
            });
          });

          // Track IDs on the page
          if (semanticIds.length > 0) {
            page.semantic_ids = semanticIds;
          }
          if (cloneIds.length > 0) {
            page.clone_ids = cloneIds;
          }
        }

        tree.addPage(page);
      }
    }

    // After all pages are loaded, set parentId for navigation targets
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach((btn: AACButton) => {
        if (btn.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO && btn.targetPageId) {
          const targetPage = tree.getPage(btn.targetPageId);
          if (targetPage) {
            targetPage.parentId = page.id;
          }
        }
      });
    }

    // Read settings.xml to get the StartGrid (home page)
    try {
      const settingsEntry = entries.find((e) => e.entryName.endsWith('settings.xml'));
      if (settingsEntry) {
        const settingsXml = decodeText(await readEntryBuffer(settingsEntry));
        const settingsData = parser.parse(settingsXml);
        const gsName =
          settingsData?.GridSetSettings?.Name ||
          settingsData?.gridSetSettings?.name ||
          settingsData?.GridsetSettings?.Name;
        if (gsName) metadata.name = gsName;

        const gsDesc =
          settingsData?.GridSetSettings?.Description ||
          settingsData?.gridSetSettings?.description ||
          settingsData?.GridsetSettings?.Description;
        if (gsDesc) metadata.description = gsDesc;

        const gsLang =
          settingsData?.GridSetSettings?.PrimaryLanguage ||
          settingsData?.gridSetSettings?.primaryLanguage ||
          settingsData?.GridsetSettings?.PrimaryLanguage;
        if (gsLang && typeof gsLang === 'string') {
          metadata.locale = gsLang;
          metadata.languages = [gsLang];
        }

        const gsAuthor =
          settingsData?.GridSetSettings?.Author ||
          settingsData?.gridSetSettings?.author ||
          settingsData?.GridsetSettings?.Author;
        if (gsAuthor) metadata.author = gsAuthor;

        const docUrl =
          settingsData?.GridSetSettings?.DocumentationUrl ||
          settingsData?.gridSetSettings?.documentationUrl ||
          settingsData?.GridsetSettings?.DocumentationUrl;
        if (docUrl) {
          metadata.homepageUrl = docUrl;
          metadata.documentationUrl = docUrl;
        }

        const docSlug =
          settingsData?.GridSetSettings?.DocumentationSlug ||
          settingsData?.gridSetSettings?.documentationSlug ||
          settingsData?.GridsetSettings?.DocumentationSlug;
        if (docSlug) metadata.documentationSlug = docSlug;

        const thumbnail =
          settingsData?.GridSetSettings?.Thumbnail ||
          settingsData?.gridSetSettings?.thumbnail ||
          settingsData?.GridsetSettings?.Thumbnail;
        if (thumbnail) metadata.thumbnail = thumbnail;

        const thumbBg =
          settingsData?.GridSetSettings?.ThumbnailBackground ||
          settingsData?.gridSetSettings?.thumbnailBackground ||
          settingsData?.GridsetSettings?.ThumbnailBackground;
        if (thumbBg) metadata.thumbnailBackground = thumbBg;

        const picSearchKeys =
          settingsData?.GridSetSettings?.PictureSearch?.PictureSearchKeys?.PictureSearchKey ||
          settingsData?.gridSetSettings?.pictureSearch?.pictureSearchKeys?.pictureSearchKey ||
          settingsData?.GridsetSettings?.PictureSearch?.PictureSearchKeys?.PictureSearchKey;
        if (picSearchKeys) {
          metadata.pictureSearchKeys = Array.isArray(picSearchKeys)
            ? picSearchKeys
            : [picSearchKeys];
        }

        const appearance =
          settingsData?.GridSetSettings?.Appearance ||
          settingsData?.gridSetSettings?.appearance ||
          settingsData?.GridsetSettings?.Appearance;
        if (appearance) {
          metadata.appearance = {
            textAtTop:
              appearance.TextAtTop === '1' ||
              appearance.textAtTop === '1' ||
              appearance.TextAtTop === 1,
            computerControlCellSize: appearance.ComputerControlCellSize
              ? parseFloat(String(appearance.ComputerControlCellSize))
              : undefined,
          };
        }

        const startGridName =
          settingsData?.GridSetSettings?.StartGrid ||
          settingsData?.gridSetSettings?.startGrid ||
          settingsData?.GridsetSettings?.StartGrid;

        if (startGridName && typeof startGridName === 'string') {
          // Resolve the grid name to grid ID
          const homeGridId = gridNameToIdMap.get(startGridName);
          if (homeGridId) {
            metadata.defaultHomePageId = homeGridId;
            // Also set tree.rootId so BoardViewer knows which page to show first
            tree.rootId = homeGridId;
          }
        }

        const keyboardGridName =
          settingsData?.GridSetSettings?.KeyboardGrid ||
          settingsData?.gridSetSettings?.keyboardGrid ||
          settingsData?.GridsetSettings?.KeyboardGrid;
        if (keyboardGridName && typeof keyboardGridName === 'string') {
          metadata.defaultKeyboardPageId = gridNameToIdMap.get(keyboardGridName);
        }
      }
    } catch (e) {
      // If settings.xml parsing fails, tree.rootId will default to first page
    }

    // Set metadata on tree
    tree.metadata = metadata;

    return tree;
  }

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string,
    _targetLocale?: string
  ): Promise<Uint8Array> {
    // Load the tree, apply translations, and save to new file
    const tree = await this.loadIntoTree(filePathOrBuffer);

    // Apply translations to all text content
    Object.values(tree.pages).forEach((page) => {
      // Translate page names
      if (page.name && translations.has(page.name)) {
        const tPage = translations.get(page.name);
        if (tPage) page.name = tPage;
      }

      // Translate button labels and messages, preserving symbol positions
      page.buttons.forEach((button) => {
        // Translate label
        if (button.label && translations.has(button.label)) {
          const tLabel = translations.get(button.label);
          if (tLabel) button.label = tLabel;
        }

        // Translate message with symbol preservation
        if (button.message && translations.has(button.message)) {
          const originalMessage = button.message;
          const translatedText = translations.get(originalMessage);

          if (translatedText) {
            // Extract symbols from the button (from richText or image fields)
            const symbols = extractSymbolsFromButton(button);

            if (symbols && symbols.length > 0) {
              // Use symbol-aware translation to preserve symbol positions
              const result = translateWithSymbols(originalMessage, translatedText, symbols);

              // Update the message
              button.message = result.text;

              // Update the rich text structure if it exists
              if (button.semanticAction?.richText) {
                button.semanticAction.richText.text = result.text;
                button.semanticAction.richText.symbols = result.richTextSymbols;
              } else if (result.richTextSymbols.length > 0) {
                // Create rich text structure if it doesn't exist but we have symbols
                if (!button.semanticAction) {
                  button.semanticAction = {
                    category: AACSemanticCategory.COMMUNICATION,
                    intent: AACSemanticIntent.SPEAK_TEXT,
                    text: result.text,
                  };
                }
                button.semanticAction.richText = {
                  text: result.text,
                  symbols: result.richTextSymbols,
                };
              }
            } else {
              // No symbols to preserve, simple translation
              button.message = translatedText;
            }
          }
        }
      });
    });

    // Save the translated tree and return its content
    await this.saveFromTree(tree, outputPath);
    return readBinaryFromInput(outputPath);
  }

  /**
   * Extract symbol information from a gridset for LLM-based translation.
   * Returns a structured format showing which buttons have symbols and their context.
   *
   * This method uses shared translation utilities that work across all AAC formats.
   *
   * @param filePathOrBuffer - Path to gridset file or buffer
   * @returns Array of symbol information for LLM processing
   */
  async extractSymbolsForLLM(filePathOrBuffer: string | Buffer): Promise<ButtonForTranslation[]> {
    const tree = await this.loadIntoTree(filePathOrBuffer);

    // Collect all buttons from all pages
    const allButtons: any[] = [];
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        // Add page context to each button
        (button as any).pageId = page.id;
        (button as any).pageName = page.name || page.id;
        allButtons.push(button);
      });
    });

    // Use shared utility to extract buttons with translation context
    return extractAllButtonsForTranslation(allButtons, (button) => ({
      pageId: button.pageId,
      pageName: button.pageName,
    }));
  }

  /**
   * Apply LLM translations with symbol information.
   * The LLM should provide translations with symbol attachments in the correct positions.
   *
   * This method uses shared translation utilities that work across all AAC formats.
   *
   * @param filePathOrBuffer - Path to gridset file or buffer
   * @param llmTranslations - Array of LLM translations with symbol info
   * @param outputPath - Where to save the translated gridset
   * @param options - Translation options (e.g., allowPartial for testing)
   * @returns Buffer of the translated gridset
   */
  async processLLMTranslations(
    filePathOrBuffer: string | Buffer,
    llmTranslations: LLMLTranslationResult[],
    outputPath: string,
    options?: { allowPartial?: boolean }
  ): Promise<Uint8Array> {
    const tree = await this.loadIntoTree(filePathOrBuffer);

    // Validate translations using shared utility
    const buttonIds = Object.values(tree.pages).flatMap((page) => page.buttons.map((b) => b.id));
    validateTranslationResults(llmTranslations, buttonIds, options);

    // Create a map for quick lookup
    const translationMap = new Map(llmTranslations.map((t) => [t.buttonId, t]));

    // Apply translations
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        const translation = translationMap.get(button.id);
        if (!translation) return;

        // Apply label translation
        if (translation.translatedLabel) {
          button.label = translation.translatedLabel;
        }

        // Apply message translation
        if (translation.translatedMessage) {
          button.message = translation.translatedMessage;

          // Update rich text if symbols provided
          if (translation.symbols && translation.symbols.length > 0) {
            if (!button.semanticAction) {
              button.semanticAction = {
                category: AACSemanticCategory.COMMUNICATION,
                intent: AACSemanticIntent.SPEAK_TEXT,
                text: translation.translatedMessage,
              };
            }

            button.semanticAction.richText = {
              text: translation.translatedMessage,
              symbols: translation.symbols,
            };
          }
        }
      });
    });

    // Save and return
    await this.saveFromTree(tree, outputPath);
    return readBinaryFromInput(outputPath);
  }

  async saveFromTree(tree: AACTree, outputPath: string): Promise<void> {
    const useNodeZip = isNodeRuntime();
    let addText: (entryPath: string, content: string) => void;
    let addBinary: (entryPath: string, content: Uint8Array) => void;
    let finalizeZip: () => Promise<Uint8Array>;

    if (useNodeZip) {
      const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
      const zip = new AdmZip();
      addText = (entryPath: string, content: string) => {
        zip.addFile(entryPath, Buffer.from(content, 'utf8'));
      };
      addBinary = (entryPath: string, content: Uint8Array) => {
        zip.addFile(entryPath, Buffer.from(content));
      };
      finalizeZip = () => Promise.resolve(zip.toBuffer());
    } else {
      const module = await import('jszip');
      const JSZip = module.default || module;
      const zip = new JSZip();
      addText = (entryPath: string, content: string) => {
        zip.file(entryPath, content, { binary: false });
      };
      addBinary = (entryPath: string, content: Uint8Array) => {
        zip.file(entryPath, content);
      };
      finalizeZip = async () => zip.generateAsync({ type: 'uint8array' });
    }

    if (Object.keys(tree.pages).length === 0) {
      // Create empty zip for empty tree
      const zipBuffer = await finalizeZip();
      writeBinaryToPath(outputPath, zipBuffer);
      return;
    }

    // Collect all unique styles from pages and buttons
    const uniqueStyles = new Map<string, { id: string; style: AACStyle }>();
    let styleIdCounter = 1;

    // Track images that need to be written to the ZIP
    // Maps button ID to image data for buttons with images
    const buttonImages = new Map<
      string,
      { imageData: Buffer; ext: string; pageName: string; x: number; y: number }
    >();

    // Helper function to add style and return its ID
    const addStyle = (style: AACStyle | undefined): string => {
      if (!style) return '';
      const normalizedStyle: AACStyle = { ...style };
      const styleKey = JSON.stringify(normalizedStyle);
      const existing = uniqueStyles.get(styleKey);
      if (existing) return existing.id;

      const styleId = `Style${styleIdCounter++}`;
      uniqueStyles.set(styleKey, { id: styleId, style: normalizedStyle });
      return styleId;
    };

    // Collect styles from all pages and buttons
    Object.values(tree.pages).forEach((page) => {
      addStyle(page.style);
      page.buttons.forEach((button) => {
        addStyle(button.style);
      });
    });

    // Get the home/start grid from tree.rootId, fallback to first page
    const pages = Object.values(tree.pages);
    let startGrid = '';

    if (tree.rootId) {
      const homePage = tree.getPage(tree.rootId);
      if (homePage) {
        startGrid = homePage.name || homePage.id;
      }
    }

    // Fallback to first page if no rootId or page not found
    if (!startGrid && pages.length > 0) {
      startGrid = pages[0].name || pages[0].id;
    }

    // Create Settings0/settings.xml with proper Grid3 structure
    const settingsData = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      GridSetSettings: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        Name: tree.metadata?.name || '',
        Description: tree.metadata?.description || '',
        Author: tree.metadata?.author || '',
        PrimaryLanguage: tree.metadata?.locale || 'en-US',
        StartGrid: startGrid,
        // Add other common Grid3 settings
        Thumbnail: (tree.metadata as any)?.thumbnail || '',
        ThumbnailBackground: (tree.metadata as any)?.thumbnailBackground || '',
        DocumentationUrl: tree.metadata?.homepageUrl || tree.metadata?.url || '',
        DocumentationSlug: (tree.metadata as any)?.documentationSlug || '',
        ScanEnabled: 'false',
        ScanTimeoutMs: '2000',
        HoverEnabled: 'false',
        HoverTimeoutMs: '1000',
        MouseclickEnabled: 'true',
        Language: tree.metadata?.locale || 'en-US',
      },
    };

    const settingsBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
    const settingsXmlContent = settingsBuilder.build(settingsData);
    addText('Settings0/settings.xml', settingsXmlContent);

    // Create Settings0/Styles/style.xml if there are styles
    if (uniqueStyles.size > 0) {
      const stylesArray = Array.from(uniqueStyles.values()).map(({ id, style }) => {
        const styleObj = {
          '@_Key': id,
          // When TileColour is present, BackColour is the surround (outer area)
          // For "None" surround, just use BackColour for the fill (no TileColour)
          BackColour: this.ensureAlphaChannel(style.backgroundColor),
          BorderColour: this.ensureAlphaChannel(style.borderColor),
          // Calculate font color based on background if not explicitly set
          FontColour: this.ensureAlphaChannel(
            style.fontColor || this.getContrastFontColor(style.backgroundColor)
          ),
          FontName: style.fontFamily || 'Arial',
          FontSize: style.fontSize?.toString() || '16',
        };
        // Don't add TileColour - just use BackColour as the fill color
        return styleObj;
      });

      const styleData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        StyleData: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          Styles: {
            Style: stylesArray,
          },
        },
      };

      const styleBuilder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: '  ',
      });
      const styleXmlContent = styleBuilder.build(styleData);
      addText('Settings0/Styles/styles.xml', styleXmlContent);
    }

    // Collect grid file paths for FileMap.xml
    const gridFilePaths: string[] = [];

    // Create a grid for each page
    Object.values(tree.pages).forEach((page) => {
      const gridData = {
        Grid: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          GridGuid: page.id,
          // Calculate grid dimensions based on actual layout
          ColumnDefinitions: this.calculateColumnDefinitions(page),
          RowDefinitions: this.calculateRowDefinitions(page, false), // No automatic workspace row injection
          AutoContentCommands: '',
          Cells:
            page.buttons.length > 0
              ? {
                  Cell: [
                    // Regular button cells
                    ...this.filterPageButtons(page.buttons).map((button, btnIndex) => {
                      const buttonStyleId = button.style ? addStyle(button.style) : '';

                      // Find button position in grid layout
                      const position = this.findButtonPosition(page, button, btnIndex);

                      // Use position directly from tree
                      const yOffset = 0;

                      // Build CaptionAndImage object
                      const captionAndImage: Record<string, unknown> = {
                        Caption: button.label || '',
                      };

                      // Add image reference if button has an image
                      // Grid3 uses coordinate-based naming: {x}-{y}-0-text-0.{ext}
                      if (button.image) {
                        // Try to determine file extension from image name or default to PNG
                        let imageExt = 'png';
                        const imageMatch = button.image.match(/\.(png|jpg|jpeg|gif|svg)$/i);
                        if (imageMatch) {
                          imageExt = imageMatch[1].toLowerCase();
                        }

                        // Extract image data from button parameters if available
                        // (AstericsGridProcessor stores it there during loadIntoTree)
                        // Also handle data URLs from OBZ conversion
                        let imageData = Buffer.alloc(0);
                        let hasImageData = false;

                        if (
                          button.parameters &&
                          button.parameters.imageData &&
                          Buffer.isBuffer(button.parameters.imageData)
                        ) {
                          imageData = button.parameters.imageData as any;
                          hasImageData = imageData.length > 0;
                        } else if (
                          button.image &&
                          typeof button.image === 'string' &&
                          button.image.startsWith('data:image')
                        ) {
                          // Convert data URL to Buffer (for OBZ → Grid3 conversion)
                          try {
                            const matches = button.image.match(/^data:image\/(\w+);base64,(.+)$/);
                            if (matches) {
                              const extension = matches[1]; // e.g., 'png', 'jpeg', 'gif'
                              const base64Data = matches[2];
                              imageData = Buffer.from(base64Data, 'base64');
                              imageExt = extension; // Override the detected extension
                              hasImageData = imageData.length > 0;
                            }
                          } catch (err) {
                            console.warn(
                              `[Grid3] Failed to convert data URL to Buffer for button ${button.id}:`,
                              err
                            );
                          }
                        }

                        // Only add image reference if we have actual image data
                        if (hasImageData) {
                          // Grid3 dynamically constructs image filenames by prepending cell coordinates
                          // The XML should only contain the suffix: -0-text-0.{ext}
                          // Grid3 automatically adds the X-Y prefix based on the Cell's position
                          captionAndImage.Image = `-0-text-0.${imageExt}`;

                          // Store image data for later writing to ZIP
                          buttonImages.set(button.id, {
                            imageData: imageData,
                            ext: imageExt,
                            pageName: page.name || page.id,
                            x: position.x,
                            y: position.y + yOffset,
                          });
                        }
                      }

                      const cellData: Record<string, unknown> = {
                        '@_X': position.x + 1, // Grid3 uses 1-based X coordinates
                        '@_Y': position.y + yOffset + 1, // Grid3 uses 1-based Y coordinates with workspace offset
                        '@_ColumnSpan': position.columnSpan,
                        '@_RowSpan': position.rowSpan,
                        Content: {
                          ContentType:
                            button.contentType === 'Normal' ? undefined : button.contentType,
                          ContentSubType: button.contentSubType,
                          Commands: this.generateCommandsFromSemanticAction(button, tree),
                          CaptionAndImage: captionAndImage,
                        },
                      };

                      // Add style reference and inline color overrides if available
                      // Some Grid3 versions need inline colors in addition to style references
                      if (buttonStyleId || button.style) {
                        const styleObj: any = {};

                        // Add style reference if we have one
                        if (buttonStyleId) {
                          styleObj.BasedOnStyle = buttonStyleId;
                        }

                        // Add inline color overrides for better Grid3 compatibility
                        if (button.style?.backgroundColor) {
                          // Use BackColour for fill (no TileColour means no surround, just the fill)
                          styleObj.BackColour = this.ensureAlphaChannel(
                            button.style.backgroundColor
                          );
                        }
                        if (button.style?.borderColor) {
                          styleObj.BorderColour = this.ensureAlphaChannel(button.style.borderColor);
                        }
                        // Always add font color inline - either from button style or calculated from background
                        const fontColor =
                          button.style?.fontColor ||
                          this.getContrastFontColor(button.style?.backgroundColor);
                        styleObj.FontColour = this.ensureAlphaChannel(fontColor);
                        if (button.style?.fontFamily) {
                          styleObj.FontName = button.style.fontFamily;
                        }
                        if (button.style?.fontSize) {
                          styleObj.FontSize = button.style.fontSize;
                        }

                        (cellData as any).Content.Style = styleObj;
                      }

                      return cellData;
                    }),
                  ],
                }
              : { Cell: [] },
        },
      };

      // Convert to XML
      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: '  ',
        suppressEmptyNode: true,
        cdataPropName: '__cdata',
      });
      const xmlContent = builder.build(gridData);

      // Add to zip in Grids folder with proper Grid3 naming
      const gridPath = `Grids/${page.name || page.id}/grid.xml`;
      gridFilePaths.push(gridPath);
      addText(gridPath, xmlContent);
    });

    // Write image files to ZIP
    buttonImages.forEach((imgData) => {
      if (imgData.imageData && imgData.imageData.length > 0) {
        // Create image path in the grid's directory
        const imagePath = `Grids/${imgData.pageName}/${imgData.x}-${imgData.y}-0-text-0.${imgData.ext}`;
        addBinary(imagePath, imgData.imageData);
      }
    });

    // Create FileMap.xml to map all grid files with their dynamic image files
    const fileMapData = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      FileMap: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        Entries: {
          Entry: gridFilePaths.map((gridPath) => {
            // Find all image files for this grid
            const gridName = gridPath.match(/Grids\/([^/]+)\/grid\.xml$/)?.[1] || '';
            const imageFiles: string[] = [];

            // Collect image filenames for buttons on this page
            // IMPORTANT: FileMap.xml requires full paths like "Grids/PageName/1-5-0-text-0.png"
            buttonImages.forEach((imgData) => {
              if (imgData.pageName === gridName && imgData.imageData.length > 0) {
                const imagePath = `Grids/${gridName}/${imgData.x}-${imgData.y}-0-text-0.${imgData.ext}`;
                imageFiles.push(imagePath);
              }
            });

            return {
              '@_StaticFile': gridPath,
              DynamicFiles:
                imageFiles.length > 0
                  ? {
                      File: imageFiles,
                    }
                  : {},
            };
          }),
        },
      },
    };

    const fileMapBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
    });
    const fileMapXmlContent = fileMapBuilder.build(fileMapData);
    addText('FileMap.xml', fileMapXmlContent);

    // Write the zip file
    const zipBuffer = await finalizeZip();
    writeBinaryToPath(outputPath, zipBuffer);
  }

  // Helper method to calculate column definitions based on page layout
  private calculateColumnDefinitions(page: AACPage): {
    ColumnDefinition: any[];
  } {
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

  // Helper method to calculate row definitions based on page layout
  private calculateRowDefinitions(
    page: AACPage,
    addWorkspaceOffset = false
  ): { RowDefinition: any[] } {
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

  // Helper method to find button position with span information
  private findButtonPosition(
    page: AACPage,
    button: AACButton,
    fallbackIndex: number
  ): {
    x: number;
    y: number;
    columnSpan: number;
    rowSpan: number;
  } {
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
    const gridCols = page.grid?.[0]?.length || Math.ceil(Math.sqrt(page.buttons.length));
    return {
      x: fallbackIndex % gridCols,
      y: Math.floor(fallbackIndex / gridCols),
      columnSpan: 1,
      rowSpan: 1,
    };
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

  /**
   * Validate Gridset file format
   * @param filePath - Path to the file to validate
   * @returns Promise with validation result
   */
  async validate(filePath: string): Promise<ValidationResult> {
    return GridsetValidator.validateFile(filePath);
  }
}

export { GridsetProcessor };
