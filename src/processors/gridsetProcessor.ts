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
} from '../core/treeStructure';
import { AACStyle } from '../types/aac';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { resolveGrid3CellImage } from './gridset/resolver';
import {
  extractAllButtonsForTranslation,
  validateTranslationResults,
  type ButtonForTranslation,
  type LLMLTranslationResult,
} from '../utilities/translation/translationProcessor';
import { getZipEntriesWithPassword, resolveGridsetPassword } from './gridset/password';
import crypto from 'crypto';
import zlib from 'zlib';
import { GridsetValidator } from '../validation/gridsetValidator';
import { ValidationResult } from '../validation/validationTypes';
// New imports for enhanced Grid 3 support
import { detectPluginCellType, Grid3CellType } from './gridset/pluginTypes';
import { detectCommand } from './gridset/commands';
import { type SymbolReference, parseSymbolReference } from './gridset/symbols';
import { isSymbolLibraryReference } from './gridset/resolver';
import { generateCloneId } from '../utilities/analytics/utils/idGenerator';
import { translateWithSymbols, extractSymbolsFromButton } from './gridset/symbolAlignment';

class GridsetProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }

  /**
   * Decrypt and inflate a Grid3 encrypted payload (DesktopContentEncrypter).
   * Uses AES-256-CBC with key/IV derived from the password padded with spaces
   * and then Deflate decompression.
   */
  private decryptGridsetEntry(buffer: Buffer, password?: string): Buffer {
    const pwd = (password || 'Chocolate').padEnd(32, ' ');
    const key = Buffer.from(pwd.slice(0, 32), 'utf8');
    const iv = Buffer.from(pwd.slice(0, 16), 'utf8');

    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
      try {
        return zlib.inflateSync(decrypted);
      } catch {
        // If data isn't deflated, return raw decrypted bytes
        return decrypted;
      }
    } catch {
      return buffer;
    }
  }

  // Determine password to use when opening encrypted gridset archives (.gridsetx)
  private getGridsetPassword(source?: string | Buffer): string | undefined {
    return resolveGridsetPassword(this.options, source);
  }

  // Helper function to ensure color has alpha channel (Grid3 format)
  private ensureAlphaChannel(color: string | undefined): string {
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
      if ('#text' in val) return String(val['#text']);

      // Handle Grid3 structured format <p><s><r>text</r></s></p>
      // Can start at p, s, or r level
      const parts: string[] = [];
      const processS = (s: any): void => {
        if (!s) return;
        if (s.r !== undefined) {
          const rElements = Array.isArray(s.r) ? s.r : [s.r];
          for (const r of rElements) {
            if (typeof r === 'object' && r !== null && '#text' in r) {
              parts.push(String(r['#text']));
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

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const tree = this.loadIntoTree(filePathOrBuffer);
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

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const tree = new AACTree();

    let zip: AdmZip;
    try {
      zip = new AdmZip(filePathOrBuffer);
    } catch (error: any) {
      throw new Error(`Invalid ZIP file format: ${error.message}`);
    }
    const password = this.getGridsetPassword(filePathOrBuffer);
    const entries = getZipEntriesWithPassword(zip, password);
    const parser = new XMLParser({ ignoreAttributes: false });
    const isEncryptedArchive =
      typeof filePathOrBuffer === 'string' && filePathOrBuffer.toLowerCase().endsWith('.gridsetx');
    const encryptedContentPassword = this.getGridsetPassword(filePathOrBuffer);
    const readEntryBuffer = (entry: AdmZip.IZipEntry): Buffer => {
      const raw = entry.getData();
      if (!isEncryptedArchive) return raw;
      return this.decryptGridsetEntry(raw, encryptedContentPassword);
    };

    // Parse FileMap.xml if present to index dynamic files per grid
    const fileMapIndex = new Map<string, string[]>();
    try {
      const fmEntry = entries.find((e) => e.entryName.endsWith('FileMap.xml'));
      if (fmEntry) {
        const fmXml = readEntryBuffer(fmEntry).toString('utf8');
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
        const styleXmlContent = readEntryBuffer(styleEntry).toString('utf8');
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
    // console.log('Gridset zip entries:', entries.map(e => e.entryName));

    // First pass: collect all grid names and IDs for navigation resolution
    const gridNameToIdMap = new Map<string, string>();
    const gridIdToNameMap = new Map<string, string>();

    entries.forEach((entry) => {
      if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {
        try {
          const xmlContent = readEntryBuffer(entry).toString('utf8');
          const data = parser.parse(xmlContent);
          const grid = data.Grid || data.grid;
          if (!grid) return;

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
    });

    // Second pass: process each grid file in the gridset
    entries.forEach((entry) => {
      // Only process files named grid.xml under Grids/ (any subdir)
      if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {
        let xmlContent: string;
        try {
          xmlContent = readEntryBuffer(entry).toString('utf8');
        } catch (e) {
          // Skip unreadable files
          return;
        }
        let data: any;
        try {
          data = parser.parse(xmlContent);
        } catch (error: any) {
          // Skip malformed XML but log the specific error
          console.warn(`Malformed XML in ${entry.entryName}: ${error.message}`);
          return;
        }

        // Grid3 XML: <Grid> root
        const grid = data.Grid || data.grid;
        if (!grid) {
          return;
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
          return;
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

          const pagePredictedWords = new Set<string>();

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
                    words.forEach((w) => pagePredictedWords.add(w));
                  }
                }
              });
            });
          }

          cellArr.forEach((cell: any, idx: number) => {
            if (!cell || !cell.Content) return;

            // Extract position information from cell attributes
            // Grid3 uses 1-based coordinates, convert to 0-based for internal use
            const cellX = Math.max(0, parseInt(String(cell['@_X'] || '1'), 10) - 1);
            const cellY = Math.max(0, parseInt(String(cell['@_Y'] || '1'), 10) - 1);
            const colSpan = parseInt(String(cell['@_ColumnSpan'] || '1'), 10);
            const rowSpan = parseInt(String(cell['@_RowSpan'] || '1'), 10);

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

            const message = label; // Use caption as message

            // Detect plugin cell type (Workspace, LiveCell, AutoContent)
            const pluginMetadata = detectPluginCellType(content);

            // Parse all command types from Grid3 and create semantic actions
            let semanticAction: AACSemanticAction | undefined;
            let legacyAction: any = null;
            // infer action type implicitly from commands; no explicit enum needed
            let navigationTarget: string | undefined;
            let detectedCommands: any[] = []; // Store detected command metadata

            const commands = content.Commands?.Command || content.commands?.command;

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
                zip,
                {
                  baseDir,
                  imageName: declaredImageName,
                  x: cellX + 1,
                  y: cellY + 1,
                  dynamicFiles,
                },
                entries
              ) || undefined;

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
                    words.forEach((w) => pagePredictedWords.add(w));
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
                  if (!semanticAction) {
                    const wlParam = getRawParam('wordlist');
                    if (wlParam) {
                      const words = this._extractWordsFromWordList(wlParam);
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
                    if (wlParam) {
                      const words = this._extractWordsFromWordList(wlParam);
                      // Add to page-wide set of predicted words
                      words.forEach((w) => pagePredictedWords.add(w));

                      // Store words in a way that analyzer can find them
                      // For now, we'll attach to semanticAction so it can be used later
                      // We only set this as the primary action if we don't have one yet
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
              parameters: {
                pluginMetadata: pluginMetadata, // Store full plugin metadata for future use
                grid3Commands: detectedCommands, // Store detected command metadata
                symbolLibraryRef: symbolLibraryRef, // Store full symbol reference
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

          // Process predicted words: Populate AutoContent slots first, then add virtual buttons at bottom
          if (pagePredictedWords.size > 0) {
            const extraWords = Array.from(pagePredictedWords).filter((w) => w.trim().length > 0);
            if (extraWords.length > 0) {
              let wordIdx = 0;

              // Step 1: Fill dedicated AutoContent prediction slots (e.g. at the top)
              page.buttons.forEach((btn) => {
                if (
                  btn.contentType === 'AutoContent' &&
                  btn.contentSubType === 'Prediction' &&
                  wordIdx < extraWords.length
                ) {
                  const word = extraWords[wordIdx++];
                  btn.label = word;
                  btn.message = word;
                  btn.semanticAction = {
                    category: AACSemanticCategory.COMMUNICATION,
                    intent: AACSemanticIntent.INSERT_TEXT,
                    text: word,
                    fallback: { type: 'SPEAK', message: word },
                  };
                }
              });

              // Step 2: Add remaining words as virtual buttons at the bottom
              if (wordIdx < extraWords.length) {
                const remainingWords = extraWords.slice(wordIdx);
                const extraRowsCount = Math.ceil(remainingWords.length / maxCols);

                for (let r = 0; r < extraRowsCount; r++) {
                  const row: (AACButton | null)[] = new Array(maxCols).fill(null);
                  for (let c = 0; c < maxCols; c++) {
                    const idx = r * maxCols + c;
                    if (idx < remainingWords.length) {
                      const word = remainingWords[idx];
                      const vBtn = new AACButton({
                        id: `${gridId}_vpredict_${wordIdx + idx}`,
                        label: word,
                        message: word,
                        x: c,
                        y: maxRows + r,
                        semanticAction: {
                          category: AACSemanticCategory.COMMUNICATION,
                          intent: AACSemanticIntent.INSERT_TEXT,
                          text: word,
                          fallback: { type: 'SPEAK', message: word },
                        },
                      });
                      row[c] = vBtn;
                      page.addButton(vBtn);
                    }
                  }
                  gridLayout.push(row);
                }
              }
            }
          }

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
    });

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
        const settingsXml = readEntryBuffer(settingsEntry).toString('utf8');
        const settingsData = parser.parse(settingsXml);
        const startGridName =
          settingsData?.GridSetSettings?.StartGrid ||
          settingsData?.gridSetSettings?.startGrid ||
          settingsData?.GridsetSettings?.StartGrid;

        if (startGridName && typeof startGridName === 'string') {
          // Resolve the grid name to grid ID
          const homeGridId = gridNameToIdMap.get(startGridName);
          if (homeGridId) {
            tree.rootId = homeGridId;
          }
        }

        const keyboardGridName =
          settingsData?.GridSetSettings?.KeyboardGrid ||
          settingsData?.gridSetSettings?.keyboardGrid;
        if (keyboardGridName && typeof keyboardGridName === 'string') {
          (tree as any).keyboardGridName = keyboardGridName;
        }
      }
    } catch (e) {
      // If settings.xml parsing fails, tree.rootId will default to first page
    }

    return tree;
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    // Load the tree, apply translations, and save to new file
    const tree = this.loadIntoTree(filePathOrBuffer);

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
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
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
  extractSymbolsForLLM(filePathOrBuffer: string | Buffer): ButtonForTranslation[] {
    const tree = this.loadIntoTree(filePathOrBuffer);

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
  processLLMTranslations(
    filePathOrBuffer: string | Buffer,
    llmTranslations: LLMLTranslationResult[],
    outputPath: string,
    options?: { allowPartial?: boolean }
  ): Buffer {
    const tree = this.loadIntoTree(filePathOrBuffer);

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
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    const zip = new AdmZip();

    if (Object.keys(tree.pages).length === 0) {
      // Create empty zip for empty tree
      zip.writeZip(outputPath);
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
        StartGrid: startGrid,
        // Add other common Grid3 settings
        ScanEnabled: 'false',
        ScanTimeoutMs: '2000',
        HoverEnabled: 'false',
        HoverTimeoutMs: '1000',
        MouseclickEnabled: 'true',
        Language: 'en-US',
      },
    };

    const settingsBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
    const settingsXmlContent = settingsBuilder.build(settingsData);
    zip.addFile('Settings0/settings.xml', Buffer.from(settingsXmlContent, 'utf8'));

    // Create Settings0/Styles/style.xml if there are styles
    if (uniqueStyles.size > 0) {
      const stylesArray = Array.from(uniqueStyles.values()).map(({ id, style }) => {
        const styleObj = {
          '@_Key': id,
          // When TileColour is present, BackColour is the surround (outer area)
          // For "None" surround, just use BackColour for the fill (no TileColour)
          BackColour: this.ensureAlphaChannel(style.backgroundColor),
          BorderColour: this.ensureAlphaChannel(style.borderColor),
          FontColour: this.ensureAlphaChannel(style.fontColor),
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
      zip.addFile('Settings0/Styles/styles.xml', Buffer.from(styleXmlContent, 'utf8'));
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

                        // Grid3 dynamically constructs image filenames by prepending cell coordinates
                        // The XML should only contain the suffix: -0-text-0.{ext}
                        // Grid3 automatically adds the X-Y prefix based on the Cell's position
                        captionAndImage.Image = `-0-text-0.${imageExt}`;

                        // Extract image data from button parameters if available
                        // (AstericsGridProcessor stores it there during loadIntoTree)
                        let imageData = Buffer.alloc(0);
                        if (
                          button.parameters &&
                          button.parameters.imageData &&
                          Buffer.isBuffer(button.parameters.imageData)
                        ) {
                          imageData = button.parameters.imageData as any;
                        }

                        // Store image data for later writing to ZIP
                        buttonImages.set(button.id, {
                          imageData: imageData,
                          ext: imageExt,
                          pageName: page.name || page.id,
                          x: position.x,
                          y: position.y + yOffset,
                        });
                      }

                      const cellData: Record<string, unknown> = {
                        '@_X': position.x, // Grid3 uses 0-based X coordinates (defaults to 0 when omitted)
                        '@_Y': position.y + yOffset, // Grid3 uses 0-based Y coordinates with workspace offset
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
                        if (button.style?.fontColor) {
                          styleObj.FontColour = this.ensureAlphaChannel(button.style.fontColor);
                        }
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
      const gridPath = `Grids\\${page.name || page.id}\\grid.xml`;
      gridFilePaths.push(gridPath);
      zip.addFile(gridPath, Buffer.from(xmlContent, 'utf8'));
    });

    // Write image files to ZIP
    buttonImages.forEach((imgData) => {
      if (imgData.imageData && imgData.imageData.length > 0) {
        // Create image path in the grid's directory
        const imagePath = `Grids\\${imgData.pageName}\\${imgData.x}-${imgData.y}-0-text-0.${imgData.ext}`;
        zip.addFile(imagePath, imgData.imageData);
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
            const gridName = gridPath.match(/Grids\\([^\\]+)\\grid\.xml$/)?.[1] || '';
            const imageFiles: string[] = [];

            // Collect image filenames for buttons on this page
            // IMPORTANT: FileMap.xml requires full paths like "Grids\PageName\1-5-0-text-0.png"
            buttonImages.forEach((imgData) => {
              if (imgData.pageName === gridName && imgData.imageData.length > 0) {
                const imagePath = `Grids\\${gridName}\\${imgData.x}-${imgData.y}-0-text-0.${imgData.ext}`;
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
    zip.addFile('FileMap.xml', Buffer.from(fileMapXmlContent, 'utf8'));

    // Write the zip file
    zip.writeZip(outputPath);
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
