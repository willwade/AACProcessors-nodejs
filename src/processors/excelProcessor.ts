import fs from 'fs';
import path from 'path';
import { ProcessorInput } from '../utils/io';
import * as ExcelJS from 'exceljs';
import {
  BaseProcessor,
  ExtractStringsResult,
  TranslatedString,
  SourceString,
} from '../core/baseProcessor';
import { AACTree, AACPage, AACButton, AACSemanticIntent } from '../core/treeStructure';
import { AACStyle } from '../types/aac';

/**
 * Excel Processor for converting AAC grids to Excel format
 * Converts AAC tree structures to Excel workbooks with each page as a worksheet
 * Supports visual styling, navigation links, and vocabulary analysis workflows
 */
export class ExcelProcessor extends BaseProcessor {
  private static readonly NAVIGATION_BUTTONS = ['Home', 'Message Bar', 'Delete', 'Back', 'Clear'];

  /**
   * Extract all text content from an Excel file
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @returns Array of all text content found in the Excel file
   */
  async extractTexts(_filePathOrBuffer: ProcessorInput): Promise<string[]> {
    await Promise.resolve();
    console.warn('ExcelProcessor.extractTexts is not implemented yet.');
    return [];
  }

  /**
   * Load Excel file into AACTree structure
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @returns AACTree representation of the Excel file
   */
  async loadIntoTree(_filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    await Promise.resolve();
    console.warn('ExcelProcessor.loadIntoTree is not implemented yet.');
    const tree = new AACTree();
    tree.metadata.format = 'excel';
    return tree;
  }

  /**
   * Process texts in Excel file (apply translations)
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @param translations - Map of original text to translated text
   * @param outputPath - Path where translated Excel file should be saved
   * @returns Buffer containing the translated Excel file
   */
  async processTexts(
    _filePathOrBuffer: ProcessorInput,
    _translations: Map<string, string>,
    outputPath: string
  ): Promise<Uint8Array> {
    await Promise.resolve();
    console.warn('ExcelProcessor.processTexts is not implemented yet.');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return Buffer.alloc(0);
  }

  /**
   * Convert an AAC page to an Excel worksheet
   * @param workbook - Excel workbook to add worksheet to
   * @param page - AAC page to convert
   * @param tree - Full AAC tree for navigation context
   * @param usedNames - Set of already used worksheet names to avoid duplicates
   */
  private convertPageToWorksheet(
    workbook: ExcelJS.Workbook,
    page: AACPage,
    tree: AACTree,
    usedNames: Set<string> = new Set()
  ): void {
    // Create worksheet with page name (sanitized for Excel and unique)
    const worksheetName = this.getUniqueWorksheetName(page.name || page.id, usedNames);
    const worksheet = workbook.addWorksheet(worksheetName);

    // Determine grid dimensions
    const { rows, cols } = this.calculateGridDimensions(page);

    // Add navigation row if enabled (optional feature)
    let startRow = 1;
    if (this.shouldAddNavigationRow()) {
      this.addNavigationRow(worksheet, page, tree);
      startRow = 2; // Start content after navigation row
    }

    // Convert grid layout if available
    if (page.grid && page.grid.length > 0) {
      this.convertGridLayout(worksheet, page.grid, startRow);
    } else {
      // Convert button list to grid layout
      this.convertButtonsToGrid(worksheet, page.buttons, rows, cols, startRow);
    }

    // Apply worksheet formatting
    this.formatWorksheet(worksheet, rows, cols, startRow);
  }

  /**
   * Calculate optimal grid dimensions for buttons
   * @param page - AAC page to analyze
   * @returns Object with rows and cols dimensions
   */
  private calculateGridDimensions(page: AACPage): {
    rows: number;
    cols: number;
  } {
    // If grid is defined, use its dimensions
    if (page.grid && page.grid.length > 0) {
      return {
        rows: page.grid.length,
        cols: page.grid[0]?.length || 0,
      };
    }

    // Calculate optimal grid for button list
    const buttonCount = page.buttons.length;
    if (buttonCount === 0) {
      return { rows: 1, cols: 1 };
    }

    // Try to create a roughly square grid
    const cols = Math.ceil(Math.sqrt(buttonCount));
    const rows = Math.ceil(buttonCount / cols);

    return { rows, cols };
  }

  /**
   * Convert grid layout to Excel cells
   * @param worksheet - Excel worksheet
   * @param grid - 2D array of AAC buttons
   * @param startRow - Starting row number
   */
  private convertGridLayout(
    worksheet: ExcelJS.Worksheet,
    grid: Array<Array<AACButton | null>>,
    startRow: number
  ): void {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const button = grid[row][col];
        if (button) {
          const excelRow = startRow + row;
          const excelCol = col + 1; // Excel columns are 1-based
          this.setButtonCell(worksheet, button, excelRow, excelCol);
        }
      }
    }
  }

  /**
   * Convert button list to grid layout in Excel
   * @param worksheet - Excel worksheet
   * @param buttons - Array of AAC buttons
   * @param rows - Number of rows in grid
   * @param cols - Number of columns in grid
   * @param startRow - Starting row number
   */
  private convertButtonsToGrid(
    worksheet: ExcelJS.Worksheet,
    buttons: AACButton[],
    rows: number,
    cols: number,
    startRow: number
  ): void {
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      if (row < rows) {
        const excelRow = startRow + row;
        const excelCol = col + 1; // Excel columns are 1-based
        this.setButtonCell(worksheet, button, excelRow, excelCol);
      }
    }
  }

  /**
   * Set button data and formatting for an Excel cell
   * @param worksheet - Excel worksheet
   * @param button - AAC button to represent
   * @param row - Excel row number
   * @param col - Excel column number
   */
  private setButtonCell(
    worksheet: ExcelJS.Worksheet,
    button: AACButton,
    row: number,
    col: number
  ): void {
    const cell = worksheet.getCell(row, col);

    // Set cell value to button label
    cell.value = button.label || '';

    // Add button message as cell comment if different from label
    if (button.message && button.message !== button.label) {
      cell.note = button.message;
    }

    // Apply button styling
    if (button.style) {
      this.applyCellStyling(cell, button.style);
    }

    // Add navigation link if this is a navigation button
    if (button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO && button.targetPageId) {
      this.addNavigationLink(cell, button.targetPageId);
    }

    // Set cell size for better visibility
    this.setCellSize(worksheet, row, col);
  }

  /**
   * Apply AAC button styling to Excel cell
   * @param cell - Excel cell to style
   * @param style - AAC style object
   */
  private applyCellStyling(cell: ExcelJS.Cell, style: AACStyle): void {
    let fill: ExcelJS.FillPattern | undefined;
    const font: Partial<ExcelJS.Font> = {};
    let border: Partial<ExcelJS.Borders> | undefined;

    // Background color
    if (style.backgroundColor) {
      fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: this.convertColorToArgb(style.backgroundColor) },
      };
    }

    // Font color
    if (style.fontColor) {
      font.color = { argb: this.convertColorToArgb(style.fontColor) };
    }

    // Font size
    if (style.fontSize) {
      font.size = style.fontSize;
    }

    // Font family
    if (style.fontFamily) {
      font.name = style.fontFamily;
    }

    // Font weight
    if (style.fontWeight === 'bold') {
      font.bold = true;
    }

    // Font style
    if (style.fontStyle === 'italic') {
      font.italic = true;
    }

    // Text underline
    if (style.textUnderline) {
      font.underline = true;
    }

    // Border
    if (style.borderColor || typeof style.borderWidth === 'number') {
      const borderWidth = style.borderWidth ?? 1;
      const borderStyle = borderWidth > 1 ? 'thick' : 'thin';
      const borderColor = style.borderColor
        ? { argb: this.convertColorToArgb(style.borderColor) }
        : { argb: 'FF000000' }; // Default black

      border = {
        top: { style: borderStyle, color: borderColor },
        left: { style: borderStyle, color: borderColor },
        bottom: { style: borderStyle, color: borderColor },
        right: { style: borderStyle, color: borderColor },
      };
    }

    // Apply styling to cell
    if (fill) {
      cell.fill = fill;
    }
    if (Object.keys(font).length > 0) {
      cell.font = font;
    }
    if (border) {
      cell.border = border;
    }

    // Center align text
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
  }

  /**
   * Convert color string to ARGB format for Excel
   * @param color - Color string (hex, rgb, etc.)
   * @returns ARGB color string
   */
  private convertColorToArgb(color?: string): string {
    if (!color) return 'FFFFFFFF'; // Default white

    // Remove any whitespace
    color = color.trim();

    // If already in hex format
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      if (hex.length === 6) {
        return 'FF' + hex.toUpperCase(); // Add alpha channel
      } else if (hex.length === 8) {
        return hex.toUpperCase(); // Already has alpha
      }
    }

    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return 'FF' + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
    }

    // Handle rgba() format
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
      const a = Math.round(parseFloat(rgbaMatch[4]) * 255)
        .toString(16)
        .padStart(2, '0');
      return a.toUpperCase() + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
    }

    // Default fallback
    return 'FFFFFFFF';
  }

  /**
   * Add navigation link to cell for worksheet navigation
   * @param cell - Excel cell to add link to
   * @param targetPageId - Target page ID to link to
   */
  private addNavigationLink(cell: ExcelJS.Cell, targetPageId: string): void {
    // Create internal link to another worksheet
    const sanitizedTargetName = this.sanitizeWorksheetName(targetPageId);
    cell.value = {
      text: cell.value?.toString() || '',
      hyperlink: `#'${sanitizedTargetName}'!A1`,
    };
  }

  /**
   * Set appropriate cell size for button representation
   * @param worksheet - Excel worksheet
   * @param row - Row number
   * @param col - Column number
   */
  private setCellSize(worksheet: ExcelJS.Worksheet, row: number, col: number): void {
    // Set column width (approximately 15 characters wide)
    const column = worksheet.getColumn(col);
    if (!column.width || column.width < 15) {
      column.width = 15;
    }

    // Set row height (approximately 30 points high)
    const worksheetRow = worksheet.getRow(row);
    if (!worksheetRow.height || worksheetRow.height < 30) {
      worksheetRow.height = 30;
    }
  }

  /**
   * Add navigation row with standard AAC navigation buttons
   * @param worksheet - Excel worksheet
   * @param page - Current AAC page
   * @param tree - Full AAC tree for navigation context
   */
  private addNavigationRow(worksheet: ExcelJS.Worksheet, page: AACPage, tree: AACTree): void {
    const navButtons = ExcelProcessor.NAVIGATION_BUTTONS;

    for (let i = 0; i < navButtons.length; i++) {
      const cell = worksheet.getCell(1, i + 1);
      cell.value = navButtons[i];

      // Style navigation buttons differently
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }, // Light gray background
      };

      cell.font = {
        bold: true,
        color: { argb: 'FF000000' }, // Black text
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };

      // Add navigation functionality for specific buttons
      if (navButtons[i] === 'Home' && tree.rootId) {
        this.addNavigationLink(cell, tree.rootId);
      } else if (navButtons[i] === 'Back' && page.parentId) {
        this.addNavigationLink(cell, page.parentId);
      }
    }
  }

  /**
   * Apply general formatting to the worksheet
   * @param worksheet - Excel worksheet
   * @param rows - Number of content rows
   * @param cols - Number of content columns
   * @param startRow - Starting row for content
   */
  private formatWorksheet(
    worksheet: ExcelJS.Worksheet,
    rows: number,
    cols: number,
    startRow: number
  ): void {
    // Set default column widths
    for (let col = 1; col <= cols; col++) {
      const column = worksheet.getColumn(col);
      if (!column.width) {
        column.width = 15;
      }
    }

    // Set default row heights
    for (let row = startRow; row < startRow + rows; row++) {
      const worksheetRow = worksheet.getRow(row);
      if (!worksheetRow.height) {
        worksheetRow.height = 30;
      }
    }

    // Freeze navigation row if present
    if (startRow > 1) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }

  /**
   * Sanitize worksheet name for Excel compatibility
   * @param name - Original name
   * @returns Sanitized name safe for Excel worksheet
   */
  private sanitizeWorksheetName(name: string): string {
    // Excel worksheet name restrictions:
    // - Max 31 characters
    // - Cannot contain: \ / ? * [ ] :
    // - Cannot be empty
    let cleaned = (name || '').replace(/[\\/?*:]/g, '_');
    cleaned = cleaned.replace(/\[/g, '_').replace(/\]/g, '_');
    cleaned = cleaned.substring(0, 31);

    if (cleaned.length === 0) {
      return 'Sheet1';
    }

    return cleaned;
  }

  /**
   * Get a unique worksheet name by appending a number if needed
   * @param name - Original name
   * @param usedNames - Set of already used names (case-insensitive)
   * @returns Unique worksheet name
   */
  private getUniqueWorksheetName(name: string, usedNames: Set<string>): string {
    const baseName = this.sanitizeWorksheetName(name);
    const normalize = (value: string): string => value.toLowerCase();
    let uniqueName = baseName;
    let counter = 1;

    // Keep trying with incrementing numbers until we find a unique name
    // Names are already normalized to lowercase by sanitization
    while (usedNames.has(normalize(uniqueName))) {
      // Calculate how much space we need for the counter suffix
      const suffix = ` (${counter})`;
      const maxBaseLength = 31 - suffix.length;

      // Truncate base name if needed to make room for suffix
      const truncatedBase = baseName.substring(0, maxBaseLength);
      uniqueName = truncatedBase + suffix;
      counter++;

      // Safety check to prevent infinite loop
      if (counter > 1000) {
        uniqueName = `Sheet${Date.now()}`;
        break;
      }
    }

    // Add the unique name to the set (already normalized to lowercase)
    usedNames.add(normalize(uniqueName));

    return uniqueName;
  }

  /**
   * Check if navigation row should be added (configurable feature)
   * @returns True if navigation row should be added
   */
  private shouldAddNavigationRow(): boolean {
    // This could be made configurable via processor options
    // For now, default to true as specified in requirements
    return true;
  }

  /**
   * Override saveFromTree to handle async nature of Excel operations
   * Note: This method is async but maintains the sync interface for compatibility
   */
  async saveFromTree(tree: AACTree, outputPath: string): Promise<void> {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      await this.saveFromTreeAsync(tree, outputPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to save Excel file:', message);
      try {
        const fallbackPath = outputPath.replace(/\.xlsx$/i, '_error.txt');
        fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
        fs.writeFileSync(fallbackPath, `Error saving Excel file: ${message}`);
      } catch (writeError) {
        console.error('Failed to write Excel error file:', writeError);
      }
    }
  }

  /**
   * Async version of saveFromTree for internal use
   */
  private async saveFromTreeAsync(tree: AACTree, outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const metadata = tree.metadata;

    // Set workbook properties from tree metadata
    workbook.creator = metadata?.author || 'AACProcessors';
    workbook.lastModifiedBy = 'AACProcessors';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = metadata?.name || '';
    workbook.subject = metadata?.description || '';

    // If no pages, create a default empty worksheet
    if (Object.keys(tree.pages).length === 0) {
      const worksheet = workbook.addWorksheet('Empty');
      worksheet.getCell('A1').value = 'No AAC pages found';
      await workbook.xlsx.writeFile(outputPath);
      return;
    }

    // Track used worksheet names to handle duplicates
    const usedNames = new Set<string>();

    // Convert each AAC page to an Excel worksheet
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      this.convertPageToWorksheet(workbook, page, tree, usedNames);
    }

    // Save the workbook
    await workbook.xlsx.writeFile(outputPath);
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
