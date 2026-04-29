/**
 * Gridset Save Mutations Module
 *
 * Handles saving AACTree mutations back to Gridset files.
 * This module extracts the save logic from gridsetProcessor for better modularity.
 */

import { AACTree, AACPage } from '../../core/treeStructure';
import type { AACButton } from '../../types/aac';
import { formatGrid3XmlComplete } from './xmlFormatter';

export class GridsetSaveHandler {
  private AdmZip: any;
  private XMLParser: any;
  private XMLBuilder: any;

  constructor() {
    // Dynamic imports for browser compatibility
  }

  /**
   * Show deprecation warning for legacy save path
   */
  static warnLegacySave(): void {
    const key = 'gridset_legacy_save_warned';
    if (!(global as any)[key]) {
      console.warn(
        'saveModifiedTree: detected button changes without recorded mutations. ' +
          'This will continue to work in 0.x but is deprecated. ' +
          'Use page.addButton / page.addWordListItem to make changes explicit.'
      );
      (global as any)[key] = true;
    }
  }

  /**
   * Save using mutation-based logic
   * Fixes bugs A, B, C by processing explicit mutations
   */
  static saveWithMutations(
    tree: AACTree,
    originalZip: any,
    outputZip: any,
    parser: any,
    gridBuilder: any,
    createBasicGridXml: (page: AACPage) => string
  ): Promise<void> {
    for (const page of Object.values(tree.pages)) {
      // Skip pages with no mutations
      if (page.pendingMutations.length === 0) {
        continue;
      }

      const gridPath = `Grids/${page.name}/grid.xml`;

      // Load or create grid.xml
      const originalEntry = originalZip.getEntry(gridPath);
      let originalGrid: any;

      if (originalEntry) {
        const originalContent = originalEntry.getData().toString('utf-8');
        originalGrid = parser.parse(originalContent);
        if (!originalGrid.Grid) {
          originalGrid = null;
        }
      }

      if (!originalGrid || !originalGrid.Grid) {
        const basicGrid = createBasicGridXml(page);
        const buffer = Buffer.from(basicGrid, 'utf8');
        outputZip.addFile(gridPath, buffer);
        continue;
      }

      // Index original cells by position
      const cellsByPosition = new Map<string, any>();
      const cellArray = Array.isArray(originalGrid.Grid.Cells?.Cell)
        ? originalGrid.Grid.Cells.Cell
        : originalGrid.Grid.Cells?.Cell
          ? [originalGrid.Grid.Cells.Cell]
          : [];

      for (const cell of cellArray) {
        const x = cell['@_X'] !== undefined ? parseInt(String(cell['@_X']), 10) : undefined;
        const y = parseInt(String(cell['@_Y'] || cell['@_Row'] || '0'), 10);
        if (x !== undefined) {
          cellsByPosition.set(`${x},${y}`, cell);
        }
      }

      // Process mutations in order
      for (const mutation of page.pendingMutations) {
        switch (mutation.type) {
          case 'addButton': {
            const button = mutation.button;
            const x = button.x ?? 0;
            const y = button.y ?? 0;
            const cell = cellsByPosition.get(`${x},${y}`);

            if (cell && cell.Content) {
              GridsetSaveHandler.applyButtonToCell(cell, button);
            } else {
              // Bug C fix: warn instead of silently dropping
              console.warn(
                `[Gridset] Cannot add button at (${x},${y}) - cell does not exist. ` +
                  `Use addWordListItem for dynamic content.`
              );
            }
            break;
          }

          case 'removeButton': {
            const button = page.buttons.find((b) => b.id === mutation.buttonId);
            if (button) {
              const x = button.x ?? 0;
              const y = button.y ?? 0;
              const cell = cellsByPosition.get(`${x},${y}`);
              if (cell && cell.Content) {
                cell.Content.Visibility = 'Hidden';
              }
            }
            break;
          }

          case 'updateButton': {
            const button = page.buttons.find((b) => b.id === mutation.buttonId);
            if (button) {
              const x = button.x ?? 0;
              const y = button.y ?? 0;
              const cell = cellsByPosition.get(`${x},${y}`);
              if (cell && cell.Content) {
                GridsetSaveHandler.applyButtonToCell(cell, button, mutation.patch);
              }
            }
            break;
          }

          case 'addWordListItem': {
            GridsetSaveHandler.addWordListItemToGrid(originalGrid.Grid, mutation.item);
            break;
          }

          case 'removeWordListItem': {
            GridsetSaveHandler.removeWordListItemFromGrid(originalGrid.Grid, mutation.match);
            break;
          }

          case 'clearWordList': {
            if (originalGrid.Grid.WordList && originalGrid.Grid.WordList.Items) {
              originalGrid.Grid.WordList.Items.WordListItem = [];
            }
            break;
          }
        }
      }

      // Build and write the updated grid XML
      let builtXml = gridBuilder.build(originalGrid) as string;
      builtXml = formatGrid3XmlComplete(builtXml);
      outputZip.addFile(gridPath, Buffer.from(builtXml, 'utf8'));
    }
  }

  /**
   * Apply button changes to a cell
   */
  static applyButtonToCell(cell: any, button: AACButton, patch?: Partial<AACButton>): void {
    const updates = patch ? { ...button, ...patch } : button;

    const isPlaceholderLabel =
      !updates.label ||
      updates.label.startsWith('Cell_') ||
      updates.label.startsWith('AutoContent_') ||
      updates.label.startsWith('Prediction ');

    if (cell.Content.CaptionAndImage || cell.Content.captionAndImage) {
      const captionAndImage = cell.Content.CaptionAndImage || cell.Content.captionAndImage;

      if (!isPlaceholderLabel && updates.label) {
        captionAndImage.Caption = updates.label;
        if (captionAndImage['@_xsi:nil'] || captionAndImage['xsi:nil']) {
          delete captionAndImage['@_xsi:nil'];
          delete captionAndImage['xsi:nil'];
        }
      }

      if (updates.image) {
        captionAndImage.Image = updates.image;
      }
    }

    const isPlaceholderMessage =
      !updates.message ||
      updates.message.startsWith('Cell_') ||
      updates.message.startsWith('AutoContent_') ||
      updates.message.startsWith('Prediction ');

    if (
      !isPlaceholderMessage &&
      updates.message &&
      updates.message !== updates.label &&
      !cell.Content.Commands
    ) {
      cell.Content['#text'] = updates.message;
    }
  }

  /**
   * Add an item to the WordList with de-duplication (Bug A fix)
   */
  static addWordListItemToGrid(
    grid: any,
    item: { text: string; image?: string; partOfSpeech?: string }
  ): void {
    if (!grid.WordList) {
      grid.WordList = {};
    }
    if (!grid.WordList.Items) {
      grid.WordList.Items = {};
    }

    const existingItems =
      grid.WordList.Items.WordListItem || grid.WordList.Items.wordlistitem || [];
    const itemsArray = Array.isArray(existingItems) ? existingItems : [existingItems];

    // De-duplicate by text
    const existingTexts = new Set(
      itemsArray
        .map((item: { Text?: { p?: { s?: { r?: string } } } | string }) => {
          if (typeof item.Text === 'string') return item.Text;
          return item.Text?.p?.s?.r || '';
        })
        .filter(Boolean)
    );

    if (!existingTexts.has(item.text)) {
      itemsArray.push({
        Text: { p: { s: { r: item.text } } },
        Image: item.image || '',
        PartOfSpeech: item.partOfSpeech || 'Unknown',
      });
      grid.WordList.Items.WordListItem = itemsArray;
    }
  }

  /**
   * Remove items from the WordList
   */
  static removeWordListItemFromGrid(grid: any, match: string | ((item: any) => boolean)): void {
    if (!grid.WordList || !grid.WordList.Items) {
      return;
    }

    const existingItems =
      grid.WordList.Items.WordListItem || grid.WordList.Items.wordlistitem || [];
    const itemsArray = Array.isArray(existingItems) ? existingItems : [existingItems];

    let filteredItems: any[];
    if (typeof match === 'string') {
      filteredItems = itemsArray.filter((item: any) => {
        const text = item.Text?.p?.s?.r || item.Text || '';
        return text !== match;
      });
    } else {
      filteredItems = itemsArray.filter(match);
    }

    grid.WordList.Items.WordListItem = filteredItems;
  }
}
