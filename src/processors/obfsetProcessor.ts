/**
 * OBF Set Processor - Handles JSON-formatted .obfset files
 * These are pre-extracted board sets in JSON array format
 */

import { AACTree } from '../core/treeStructure';
import {
  AACPage,
  AACButton,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
} from '../core/treeStructure';
import { BaseProcessor, ProcessorOptions } from '../core/baseProcessor';
import { ProcessorInput } from '../utils/io';

interface ObfsetButton {
  id: string;
  label: string;
  load_board?: {
    id: string;
    add_to_sentence?: boolean;
    temporary_home?: boolean;
  };
  clone_id?: string;
  semantic_id?: string;
  [key: string]: any;
}

interface ObfsetBoard {
  format: string;
  id: string;
  buttons?: ObfsetButton[];
  grid?: { rows: number; columns: number; order?: string[][] };
  name?: string;
  [key: string]: any;
}

export class ObfsetProcessor extends BaseProcessor {
  readonly capabilities = {
    wordList: 'none' as const,
    preservesAssetsOnSave: false,
    newCellCreation: 'allowed' as const,
  };

  constructor(options: ProcessorOptions = {}) {
    super(options);
  }

  /**
   * Extract all text content
   */
  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const tree = await this.loadIntoTree(filePathOrBuffer);
    const texts = new Set<string>();

    Object.values(tree.pages).forEach((page) => {
      if (page.name) texts.add(page.name);
      page.buttons.forEach((button) => {
        if (button.label) texts.add(button.label);
      });
    });

    return Array.from(texts);
  }

  /**
   * Load an .obfset file (JSON array of boards)
   */
  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const { readTextFromInput } = this.options.fileAdapter;
    const tree = new AACTree();
    tree.metadata.format = 'obfset';
    const content = await readTextFromInput(filePathOrBuffer);

    const boards: ObfsetBoard[] = JSON.parse(content);

    // Track board ID mappings
    const boardMap = new Map<string, AACPage>();

    // First pass: create all boards
    boards.forEach((boardData) => {
      const rows = boardData.grid?.rows || 4;
      const cols = boardData.grid?.columns || 6;
      const name = boardData.name || boardData.id || `Board ${boardData.id}`;

      const page = new AACPage({
        id: boardData.id,
        name,
        grid: { columns: cols, rows: rows },
        buttons: [],
      });

      tree.addPage(page);
      boardMap.set(boardData.id, page);
    });

    // Second pass: process buttons and establish parent relationships
    boards.forEach((boardData) => {
      const page = boardMap.get(boardData.id);
      if (!page) return;

      const rows = boardData.grid?.rows || 4;
      const cols = boardData.grid?.columns || 6;

      // Initialize grid with nulls
      page.grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

      // Create button map by ID
      const buttonMap = new Map<string, any>();
      const buttons = boardData.buttons || [];

      buttons.forEach((btnData) => {
        buttonMap.set(btnData.id, btnData);
      });

      // Process grid order to place buttons in correct positions
      const gridOrder = boardData.grid?.order || [];
      const semanticIds: string[] = [];
      const cloneIds: string[] = [];

      gridOrder.forEach((row: string[], rowIndex: number) => {
        row.forEach((buttonId: string, colIndex: number) => {
          const btnData = buttonMap.get(buttonId);

          if (btnData) {
            // Create semantic action
            let semanticAction: AACSemanticAction | undefined;
            if (btnData.load_board?.id) {
              // Navigation button
              semanticAction = {
                category: AACSemanticCategory.NAVIGATION,
                intent: AACSemanticIntent.NAVIGATE_TO,
                targetId: btnData.load_board.id,
                fallback: {
                  type: 'NAVIGATE',
                  targetPageId: btnData.load_board.id,
                  add_to_sentence: btnData.load_board.add_to_sentence,
                  temporary_home: btnData.load_board.temporary_home,
                },
                platformData: {
                  grid3: {
                    commandId: 'GO_TO_BOARD',
                    parameters: {
                      add_to_sentence: btnData.load_board.add_to_sentence,
                      temporary_home: btnData.load_board.temporary_home,
                    },
                  },
                },
              };
            } else {
              // Speaking button
              semanticAction = {
                category: AACSemanticCategory.COMMUNICATION,
                intent: AACSemanticIntent.SPEAK_TEXT,
                text: btnData.label || '',
                fallback: { type: 'SPEAK', message: btnData.label || '' },
              };
            }

            const button = new AACButton({
              id: btnData.id,
              label: btnData.label || '',
              message: btnData.label || '',
              targetPageId: btnData.load_board?.id,
              semanticAction,
              semantic_id: btnData.semantic_id,
              clone_id: btnData.clone_id,
            });

            // Add to grid at the correct position
            if (rowIndex < rows && colIndex < cols) {
              page.grid[rowIndex][colIndex] = button;
            }

            page.buttons.push(button);

            // Track IDs
            if (btnData.semantic_id) {
              semanticIds.push(String(btnData.semantic_id));
            }
            if (btnData.clone_id) {
              cloneIds.push(String(btnData.clone_id));
            }

            // Establish parent relationship if this button links to another board
            if (btnData.load_board?.id) {
              const targetPage = boardMap.get(String(btnData.load_board.id));
              if (targetPage) {
                targetPage.parentId = page.id;
              }
            }
          }
        });
      });

      // Store IDs on page
      page.semantic_ids = semanticIds;
      page.clone_ids = cloneIds;
    });

    // Set root board (first board or one with no parent)
    const rootBoard = Array.from(boardMap.values()).find((p) => !p.parentId);
    if (rootBoard) {
      tree.rootId = rootBoard.id;
    }

    return tree;
  }

  /**
   * Process texts (not supported for .obfset currently)
   */
  async processTexts(
    _filePathOrBuffer: ProcessorInput,
    _translations: Map<string, string>,
    _outputPath: string
  ): Promise<Uint8Array> {
    await Promise.resolve();
    throw new Error('processTexts is not supported for .obfset currently');
  }

  /**
   * Save tree structure back to file
   */
  async saveFromTree(_tree: AACTree, _outputPath: string): Promise<void> {
    await Promise.resolve();
    throw new Error('saveFromTree is not supported for .obfset currently');
  }

  supportsExtension(extension: string): boolean {
    return extension === '.obfset';
  }
}
