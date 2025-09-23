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
// Removed unused import: FileProcessor
import AdmZip from 'adm-zip';
import fs from 'fs';
// Removed unused import: path

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
}

interface ObfBoard {
  id: string;
  name: string;
  buttons: ObfButton[];
  grid?: {
    rows: number;
    columns: number;
  };
}

class ObfProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }
  private processBoard(boardData: ObfBoard, _boardPath: string): AACPage {
    const buttons: AACButton[] = (boardData.buttons || []).map((btn: ObfButton): AACButton => {
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
        style: {
          backgroundColor: btn.background_color,
          borderColor: btn.border_color,
        },
        semanticAction,
        targetPageId: btn.load_board?.path,
      });
    });

    const page = new AACPage({
      id: String(boardData?.id || ''),
      name: String(boardData?.name || ''),
      grid: [],
      buttons,
      parentId: null,
    });

    // Process grid layout if available
    if (boardData.grid) {
      const rows = boardData.grid.rows;
      const cols = boardData.grid.columns;
      const grid: Array<Array<AACButton | null>> = Array(rows)
        .fill(null)
        .map(() => Array(cols).fill(null));

      for (const btn of boardData.buttons) {
        if (typeof btn.box_id === 'number') {
          const row = Math.floor(btn.box_id / cols);
          const col = btn.box_id % cols;
          if (row < rows && col < cols) {
            const aacBtn = buttons.find((b) => b.id === btn.id);
            if (aacBtn) {
              grid[row][col] = aacBtn;
            }
          }
        }
      }

      page.grid = grid;
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
          return obj as ObfBoard;
        }
      } catch (error: any) {
        // Log parsing errors for debugging but don't throw
        console.warn(`Failed to parse OBF JSON: ${error.message}`);
      }
      return null;
    }

    // If input is a string path and ends with .obf, treat as JSON
    if (typeof filePathOrBuffer === 'string' && filePathOrBuffer.endsWith('.obf')) {
      const fs = require('fs');
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
        page.name = translations.get(page.name)!;
      }

      // Translate button labels and messages
      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          button.label = translations.get(button.label)!;
        }
        if (button.message && translations.has(button.message)) {
          button.message = translations.get(button.message)!;
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

      const obfBoard: ObfBoard = {
        id: rootPage.id,
        name: rootPage.name || 'Exported Board',
        buttons: rootPage.buttons.map((button) => ({
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
        })),
      };

      fs.writeFileSync(outputPath, JSON.stringify(obfBoard, null, 2));
    } else {
      // Save as OBZ (zip with multiple OBF files)
      const zip = new AdmZip();

      Object.values(tree.pages).forEach((page) => {
        const obfBoard: ObfBoard = {
          id: page.id,
          name: page.name || 'Board',
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
          })),
        };

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
}

export { ObfProcessor };
