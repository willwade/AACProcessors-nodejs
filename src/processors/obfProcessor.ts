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
import { generateCloneId } from '../utilities/analytics/utils/idGenerator';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { ObfValidator } from '../validation/obfValidator';
import { ValidationResult } from '../validation/validationTypes';
import {
  extractAllButtonsForTranslation,
  validateTranslationResults,
  type ButtonForTranslation,
  type LLMLTranslationResult,
} from '../utilities/translation/translationProcessor';

const OBF_FORMAT_VERSION = 'open-board-0.1';

interface ObfButton {
  id: string;
  label?: string;
  vocalization?: string;
  load_board?: {
    path: string;
  };
  box_id?: number;
  background_color?: string;
  border_color?: string;
  semantic_id?: string; // Optional semantic identifier for motor planning
  hidden?: boolean; // OBF uses boolean hidden field
}

/**
 * Map OBF hidden value to AAC standard visibility
 * OBF: true = hidden, false/undefined = visible
 * Maps to: 'Hidden' | 'Visible' | undefined
 */
function mapObfVisibility(hidden: boolean | undefined): 'Hidden' | 'Visible' | undefined {
  if (hidden === undefined) {
    return undefined; // Default to visible
  }
  return hidden ? 'Hidden' : 'Visible';
}

interface ObfGrid {
  rows: number;
  columns: number;
  order?: Array<Array<string | number | null>>;
}

interface ObfBoard {
  format?: string;
  id: string;
  locale?: string;
  name: string;
  description_html?: string;
  buttons: ObfButton[];
  grid?: ObfGrid;
  images?: any[];
  sounds?: any[];
}

class ObfProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }
  private processBoard(boardData: ObfBoard, _boardPath: string): AACPage {
    const sourceButtons = boardData.buttons || [];
    const buttons: AACButton[] = sourceButtons.map((btn: ObfButton): AACButton => {
      const semanticAction: AACSemanticAction = btn.load_board
        ? {
            category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
            targetId: btn.load_board.path,
            fallback: {
              type: 'NAVIGATE',
              targetPageId: btn.load_board.path,
            },
          }
        : {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: String(btn?.vocalization || btn?.label || ''),
            fallback: {
              type: 'SPEAK',
              message: String(btn?.vocalization || btn?.label || ''),
            },
          };

      return new AACButton({
        id: String(btn?.id || ''),
        label: String(btn?.label || ''),
        message: String(btn?.vocalization || btn?.label || ''),
        visibility: mapObfVisibility(btn.hidden),
        style: {
          backgroundColor: btn.background_color,
          borderColor: btn.border_color,
        },
        semanticAction,
        targetPageId: btn.load_board?.path,
        semantic_id: btn.semantic_id, // Extract semantic_id if present
      });
    });

    const buttonMap = new Map(buttons.map((btn) => [btn.id, btn]));

    const page = new AACPage({
      id: String(boardData?.id || ''),
      name: String(boardData?.name || ''),
      grid: [],
      buttons,
      parentId: null,
      locale: boardData.locale,
      descriptionHtml: boardData.description_html,
      images: boardData.images,
      sounds: boardData.sounds,
    });

    // Process grid layout if available
    if (boardData.grid) {
      const rows =
        typeof boardData.grid.rows === 'number'
          ? boardData.grid.rows
          : boardData.grid.order?.length || 0;
      const cols =
        typeof boardData.grid.columns === 'number'
          ? boardData.grid.columns
          : boardData.grid.order
            ? boardData.grid.order.reduce(
                (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
                0
              )
            : 0;

      if (rows > 0 && cols > 0) {
        const grid: Array<Array<AACButton | null>> = Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => null)
        );

        if (Array.isArray(boardData.grid.order) && boardData.grid.order.length) {
          boardData.grid.order.forEach((orderRow, rowIndex) => {
            if (!Array.isArray(orderRow)) return;
            orderRow.forEach((cellId, colIndex) => {
              if (cellId === null || cellId === undefined) return;
              if (rowIndex >= rows || colIndex >= cols) return;
              const aacBtn = buttonMap.get(String(cellId));
              if (aacBtn) {
                grid[rowIndex][colIndex] = aacBtn;
              }
            });
          });
        } else {
          for (const btn of sourceButtons) {
            if (typeof btn.box_id === 'number') {
              const row = Math.floor(btn.box_id / cols);
              const col = btn.box_id % cols;
              if (row < rows && col < cols) {
                const aacBtn = buttonMap.get(String(btn.id));
                if (aacBtn) {
                  grid[row][col] = aacBtn;
                }
              }
            }
          }
        }

        page.grid = grid;

        // Generate clone_id for buttons in the grid
        const semanticIds: string[] = [];
        const cloneIds: string[] = [];

        grid.forEach((row, rowIndex) => {
          row.forEach((btn, colIndex) => {
            if (btn) {
              // Generate clone_id based on position and label
              btn.clone_id = generateCloneId(rows, cols, rowIndex, colIndex, btn.label);
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
    }

    return page;
  }

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const tree = this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      if (page.name) texts.push(page.name);
      page.buttons.forEach((btn) => {
        if (typeof btn.label === 'string') texts.push(btn.label);
        if (typeof btn.message === 'string' && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    return texts;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    // Detailed logging for debugging input
    console.log('[OBF] loadIntoTree called with:', {
      type: typeof filePathOrBuffer,
      isBuffer: Buffer.isBuffer(filePathOrBuffer),
      value:
        typeof filePathOrBuffer === 'string'
          ? filePathOrBuffer
          : '[Buffer of length ' + filePathOrBuffer.length + ']',
    });
    const tree = new AACTree();

    // Helper: try to parse JSON OBF
    function tryParseObfJson(data: string | Buffer): ObfBoard | null {
      try {
        const str = typeof data === 'string' ? data : data.toString('utf8');

        // Check for empty or whitespace-only content
        if (!str.trim()) {
          return null;
        }

        const obj = JSON.parse(str);
        if (obj && typeof obj === 'object' && 'id' in obj && 'buttons' in obj) {
          // Validate buttons is an array
          if (!Array.isArray(obj.buttons)) {
            throw new Error('Invalid OBF: buttons must be an array');
          }
          return obj as ObfBoard;
        }
      } catch (error: any) {
        // Log parsing errors for debugging but don't throw
      }
      return null;
    }

    // If input is a string path and ends with .obf, treat as JSON
    if (typeof filePathOrBuffer === 'string' && filePathOrBuffer.endsWith('.obf')) {
      try {
        const content = fs.readFileSync(filePathOrBuffer, 'utf8');
        const boardData = tryParseObfJson(content);
        if (boardData) {
          console.log('[OBF] Detected .obf file, parsed as JSON');
          const page = this.processBoard(boardData, filePathOrBuffer);
          tree.addPage(page);
          return tree;
        } else {
          throw new Error('Invalid OBF JSON content');
        }
      } catch (err) {
        console.error('[OBF] Error reading .obf file:', err);
        throw err;
      }
    }

    // If input is a buffer or string that parses as OBF JSON
    const asJson = tryParseObfJson(filePathOrBuffer);
    if (asJson) {
      console.log('[OBF] Detected buffer/string as OBF JSON');
      const page = this.processBoard(asJson, '[bufferOrString]');
      tree.addPage(page);
      return tree;
    }

    // Otherwise, try as ZIP (.obz). Detect likely zip signature first; throw if neither JSON nor ZIP
    function isLikelyZip(input: string | Buffer): boolean {
      if (typeof input === 'string') return input.endsWith('.zip') || input.endsWith('.obz');
      if (Buffer.isBuffer(input) && input.length >= 2) {
        return input[0] === 0x50 && input[1] === 0x4b; // 'PK'
      }
      return false;
    }

    if (!isLikelyZip(filePathOrBuffer)) {
      throw new Error('Invalid OBF content: not JSON and not ZIP');
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(filePathOrBuffer);
    } catch (err) {
      console.error('[OBF] Error instantiating AdmZip with input:', err);
      throw err;
    }
    console.log('[OBF] Detected zip archive, extracting .obf files');
    zip.getEntries().forEach((entry) => {
      if (entry.entryName.endsWith('.obf')) {
        const content = entry.getData().toString('utf8');
        const boardData = tryParseObfJson(content);
        if (boardData) {
          const page = this.processBoard(boardData, entry.entryName);
          tree.addPage(page);
        } else {
          console.warn('[OBF] Skipped entry (not valid OBF JSON):', entry.entryName);
        }
      }
    });
    return tree;
  }

  private buildGridMetadata(page: AACPage): {
    rows: number;
    columns: number;
    order: (string | null)[][];
    buttonPositions: Map<string, number>;
  } {
    const buttonPositions = new Map<string, number>();
    const totalRows = Array.isArray(page.grid) ? page.grid.length : 0;
    const totalColumns =
      totalRows > 0
        ? page.grid.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
        : 0;

    if (totalRows === 0 || totalColumns === 0) {
      if (!page.buttons.length) {
        return { rows: 0, columns: 0, order: [], buttonPositions };
      }
      const fallbackRow: string[] = page.buttons.map((button, index) => {
        const id = String(button.id ?? '');
        buttonPositions.set(id, index);
        return id;
      });
      return {
        rows: 1,
        columns: fallbackRow.length,
        order: [fallbackRow],
        buttonPositions,
      };
    }

    const order: (string | null)[][] = [];

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const sourceRow = page.grid[rowIndex] || [];
      const orderRow: (string | null)[] = [];
      for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
        const cell = sourceRow[colIndex] || null;
        if (cell) {
          const id = String(cell.id ?? '');
          orderRow.push(id);
          buttonPositions.set(id, rowIndex * totalColumns + colIndex);
        } else {
          orderRow.push(null);
        }
      }
      order.push(orderRow);
    }

    return { rows: totalRows, columns: totalColumns, order, buttonPositions };
  }

  private createObfBoardFromPage(page: AACPage, fallbackName: string): ObfBoard {
    const { rows, columns, order, buttonPositions } = this.buildGridMetadata(page);
    const boardName = page.name || fallbackName;

    return {
      format: OBF_FORMAT_VERSION,
      id: page.id,
      locale: page.locale || 'en',
      name: boardName,
      description_html: page.descriptionHtml || boardName,
      grid: {
        rows,
        columns,
        order,
      },
      buttons: page.buttons.map((button) => ({
        id: button.id,
        label: button.label,
        vocalization: button.message || button.label,
        load_board:
          button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO && button.targetPageId
            ? {
                path: button.targetPageId,
              }
            : undefined,
        background_color: button.style?.backgroundColor,
        border_color: button.style?.borderColor,
        box_id: buttonPositions.get(String(button.id ?? '')),
      })),
      images: Array.isArray(page.images) ? page.images : [],
      sounds: Array.isArray(page.sounds) ? page.sounds : [],
    };
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
        const translatedName = translations.get(page.name);
        if (translatedName !== undefined) {
          page.name = translatedName;
        }
      }

      // Translate button labels and messages
      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          const translatedLabel = translations.get(button.label);
          if (translatedLabel !== undefined) {
            button.label = translatedLabel;
          }
        }
        if (button.message && translations.has(button.message)) {
          const translatedMessage = translations.get(button.message);
          if (translatedMessage !== undefined) {
            button.message = translatedMessage;
          }
        }
      });
    });

    // Save the translated tree and return its content
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    if (outputPath.endsWith('.obf')) {
      // Save as single OBF JSON file
      const rootPage = tree.rootId ? tree.getPage(tree.rootId) : Object.values(tree.pages)[0];
      if (!rootPage) {
        throw new Error('No pages to save');
      }

      const obfBoard = this.createObfBoardFromPage(rootPage, 'Exported Board');
      fs.writeFileSync(outputPath, JSON.stringify(obfBoard, null, 2));
    } else {
      // Save as OBZ (zip with multiple OBF files)
      const zip = new AdmZip();

      Object.values(tree.pages).forEach((page) => {
        const obfBoard = this.createObfBoardFromPage(page, 'Board');
        const obfContent = JSON.stringify(obfBoard, null, 2);
        zip.addFile(`${page.id}.obf`, Buffer.from(obfContent, 'utf8'));
      });

      zip.writeZip(outputPath);
    }
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }

  /**
   * Validate OBF/OBZ file format
   * @param filePath - Path to the file to validate
   * @returns Promise with validation result
   */
  async validate(filePath: string): Promise<ValidationResult> {
    return ObfValidator.validateFile(filePath);
  }

  /**
   * Extract symbol information from an OBF/OBZ file for LLM-based translation.
   * Returns a structured format showing which buttons have symbols and their context.
   *
   * This method uses shared translation utilities that work across all AAC formats.
   *
   * @param filePathOrBuffer - Path to OBF/OBZ file or buffer
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
   * @param filePathOrBuffer - Path to OBF/OBZ file or buffer
   * @param llmTranslations - Array of LLM translations with symbol info
   * @param outputPath - Where to save the translated OBF/OBZ file
   * @param options - Translation options (e.g., allowPartial for testing)
   * @returns Buffer of the translated OBF/OBZ file
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

        // Apply message translation (vocalization in OBF)
        if (translation.translatedMessage) {
          button.message = translation.translatedMessage;

          // Update semantic action if symbols provided
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
}

export { ObfProcessor };
