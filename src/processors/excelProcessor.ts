import fs from "fs";
import * as ExcelJS from "exceljs";
import { BaseProcessor } from "../core/baseProcessor";
import { AACTree, AACPage, AACButton } from "../core/treeStructure";
import { AACSemanticIntent } from "../core/treeStructure";

/**
 * Excel Processor for converting AAC grids to Excel format
 * Converts AAC tree structures to Excel workbooks with each page as a worksheet
 * Supports visual styling, navigation links, and vocabulary analysis workflows
 */
export class ExcelProcessor extends BaseProcessor {
  private static readonly NAVIGATION_BUTTONS = [
    "Home",
    "Message Bar",
    "Delete",
    "Back",
    "Clear",
  ];

  /**
   * Extract all text content from an Excel file
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @returns Array of all text content found in the Excel file
   */
  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const texts: string[] = [];

    try {
      const workbook = new ExcelJS.Workbook();

      if (Buffer.isBuffer(filePathOrBuffer)) {
        // For buffer input, we need to read it differently
        // This is a placeholder - actual implementation would need to handle buffer reading
        throw new Error("Buffer input not yet implemented for Excel files");
      } else {
        // Read from file path
        if (!fs.existsSync(filePathOrBuffer)) {
          return texts;
        }

        // Note: ExcelJS readFile is async, but we need sync for this interface
        // This is a limitation that would need to be addressed in a real implementation
        throw new Error("Synchronous Excel reading not yet implemented");
      }
    } catch (error) {
      console.warn(`Failed to extract texts from Excel file: ${error}`);
      return texts;
    }
  }

  /**
   * Load Excel file into AACTree structure
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @returns AACTree representation of the Excel file
   */
  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const tree = new AACTree();

    try {
      // For now, return empty tree as Excel -> AAC conversion is not the primary use case
      // This would be implemented if bidirectional conversion is needed
      console.warn(
        "Excel to AAC conversion not implemented - returning empty tree",
      );
      return tree;
    } catch (error) {
      console.warn(`Failed to load Excel file into tree: ${error}`);
      return tree;
    }
  }

  /**
   * Process texts in Excel file (apply translations)
   * @param filePathOrBuffer - Path to Excel file or Buffer containing Excel data
   * @param translations - Map of original text to translated text
   * @param outputPath - Path where translated Excel file should be saved
   * @returns Buffer containing the translated Excel file
   */
  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string,
  ): Buffer {
    try {
      // Load the Excel file, apply translations, and save
      // This would involve reading the Excel file, finding text cells,
      // applying translations, and saving to outputPath
      throw new Error("Excel text processing not yet implemented");
    } catch (error) {
      console.warn(`Failed to process Excel texts: ${error}`);
      // Return empty buffer as fallback
      return Buffer.alloc(0);
    }
  }

  /**
   * Convert an AAC page to an Excel worksheet
   * @param workbook - Excel workbook to add worksheet to
   * @param page - AAC page to convert
   * @param tree - Full AAC tree for navigation context
   */
  private async convertPageToWorksheet(
    workbook: ExcelJS.Workbook,
    page: AACPage,
    tree: AACTree,
  ): Promise<void> {
    // Create worksheet with page name (sanitized for Excel)
    const worksheetName = this.sanitizeWorksheetName(page.name || page.id);
    const worksheet = workbook.addWorksheet(worksheetName);

    // Determine grid dimensions
    const { rows, cols } = this.calculateGridDimensions(page);

    // Add navigation row if enabled (optional feature)
    let startRow = 1;
    if (this.shouldAddNavigationRow()) {
      await this.addNavigationRow(worksheet, page, tree);
      startRow = 2; // Start content after navigation row
    }

    // Convert grid layout if available
    if (page.grid && page.grid.length > 0) {
      await this.convertGridLayout(worksheet, page.grid, startRow);
    } else {
      // Convert button list to grid layout
      await this.convertButtonsToGrid(
        worksheet,
        page.buttons,
        rows,
        cols,
        startRow,
      );
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
  private async convertGridLayout(
    worksheet: ExcelJS.Worksheet,
    grid: Array<Array<AACButton | null>>,
    startRow: number,
  ): Promise<void> {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const button = grid[row][col];
        if (button) {
          const excelRow = startRow + row;
          const excelCol = col + 1; // Excel columns are 1-based
          await this.setButtonCell(worksheet, button, excelRow, excelCol);
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
  private async convertButtonsToGrid(
    worksheet: ExcelJS.Worksheet,
    buttons: AACButton[],
    rows: number,
    cols: number,
    startRow: number,
  ): Promise<void> {
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      if (row < rows) {
        const excelRow = startRow + row;
        const excelCol = col + 1; // Excel columns are 1-based
        await this.setButtonCell(worksheet, button, excelRow, excelCol);
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
  private async setButtonCell(
    worksheet: ExcelJS.Worksheet,
    button: AACButton,
    row: number,
    col: number,
  ): Promise<void> {
    const cell = worksheet.getCell(row, col);

    // Set cell value to button label
    cell.value = button.label || "";

    // Add button message as cell comment if different from label
    if (button.message && button.message !== button.label) {
      cell.note = button.message;
    }

    // Apply button styling
    if (button.style) {
      this.applyCellStyling(cell, button.style);
    }

    // Add navigation link if this is a navigation button
    if (
      button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO &&
      button.targetPageId
    ) {
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
  private applyCellStyling(cell: ExcelJS.Cell, style: any): void {
    const fill: any = {};
    const font: any = {};
    const border: any = {};

    // Background color
    if (style.backgroundColor) {
      fill.type = "pattern";
      fill.pattern = "solid";
      fill.fgColor = { argb: this.convertColorToArgb(style.backgroundColor) };
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
    if (style.fontWeight === "bold") {
      font.bold = true;
    }

    // Font style
    if (style.fontStyle === "italic") {
      font.italic = true;
    }

    // Text underline
    if (style.textUnderline) {
      font.underline = true;
    }

    // Border
    if (style.borderColor || style.borderWidth) {
      const borderStyle = style.borderWidth > 1 ? "thick" : "thin";
      const borderColor = style.borderColor
        ? { argb: this.convertColorToArgb(style.borderColor) }
        : { argb: "FF000000" }; // Default black

      border.top = { style: borderStyle, color: borderColor };
      border.left = { style: borderStyle, color: borderColor };
      border.bottom = { style: borderStyle, color: borderColor };
      border.right = { style: borderStyle, color: borderColor };
    }

    // Apply styling to cell
    if (Object.keys(fill).length > 0) {
      cell.fill = fill;
    }
    if (Object.keys(font).length > 0) {
      cell.font = font;
    }
    if (Object.keys(border).length > 0) {
      cell.border = border;
    }

    // Center align text
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  }

  /**
   * Convert color string to ARGB format for Excel
   * @param color - Color string (hex, rgb, etc.)
   * @returns ARGB color string
   */
  private convertColorToArgb(color: string): string {
    if (!color) return "FFFFFFFF"; // Default white

    // Remove any whitespace
    color = color.trim();

    // If already in hex format
    if (color.startsWith("#")) {
      const hex = color.substring(1);
      if (hex.length === 6) {
        return "FF" + hex.toUpperCase(); // Add alpha channel
      } else if (hex.length === 8) {
        return hex.toUpperCase(); // Already has alpha
      }
    }

    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
      return "FF" + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
    }

    // Handle rgba() format
    const rgbaMatch = color.match(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
    );
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
      const a = Math.round(parseFloat(rgbaMatch[4]) * 255)
        .toString(16)
        .padStart(2, "0");
      return (
        a.toUpperCase() + r.toUpperCase() + g.toUpperCase() + b.toUpperCase()
      );
    }

    // Default fallback
    return "FFFFFFFF";
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
      text: cell.value?.toString() || "",
      hyperlink: `#'${sanitizedTargetName}'!A1`,
    };
  }

  /**
   * Set appropriate cell size for button representation
   * @param worksheet - Excel worksheet
   * @param row - Row number
   * @param col - Column number
   */
  private setCellSize(
    worksheet: ExcelJS.Worksheet,
    row: number,
    col: number,
  ): void {
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
  private async addNavigationRow(
    worksheet: ExcelJS.Worksheet,
    page: AACPage,
    tree: AACTree,
  ): Promise<void> {
    const navButtons = ExcelProcessor.NAVIGATION_BUTTONS;

    for (let i = 0; i < navButtons.length; i++) {
      const cell = worksheet.getCell(1, i + 1);
      cell.value = navButtons[i];

      // Style navigation buttons differently
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" }, // Light gray background
      };

      cell.font = {
        bold: true,
        color: { argb: "FF000000" }, // Black text
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      // Add navigation functionality for specific buttons
      if (navButtons[i] === "Home" && tree.rootId) {
        this.addNavigationLink(cell, tree.rootId);
      } else if (navButtons[i] === "Back" && page.parentId) {
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
    startRow: number,
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
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
    }
  }

  /**
   * Sanitize worksheet name for Excel compatibility
   * @param name - Original name
   * @returns Sanitized name safe for Excel worksheet
   */
  private sanitizeWorksheetName(name: string): string {
    if (!name) return "Sheet1";

    // Excel worksheet name restrictions:
    // - Max 31 characters
    // - Cannot contain: \ / ? * [ ] :
    // - Cannot be empty
    let sanitized = name.replace(/[\\\/\?\*\[\]:]/g, "_").substring(0, 31);

    if (sanitized.length === 0) {
      sanitized = "Sheet1";
    }

    return sanitized;
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
  saveFromTree(tree: AACTree, outputPath: string): void {
    // For now, we'll use a simpler approach and document that Excel operations are async
    // In a real implementation, this would need proper async handling
    this.saveFromTreeAsync(tree, outputPath).catch((error) => {
      console.error("Failed to save Excel file:", error);
      // Write a simple error file instead of throwing
      fs.writeFileSync(
        outputPath.replace(".xlsx", "_error.txt"),
        `Error saving Excel file: ${error.message}`,
      );
    });
  }

  /**
   * Async version of saveFromTree for internal use
   */
  private async saveFromTreeAsync(
    tree: AACTree,
    outputPath: string,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = "AACProcessors";
    workbook.lastModifiedBy = "AACProcessors";
    workbook.created = new Date();
    workbook.modified = new Date();

    // If no pages, create a default empty worksheet
    if (Object.keys(tree.pages).length === 0) {
      const worksheet = workbook.addWorksheet("Empty");
      worksheet.getCell("A1").value = "No AAC pages found";
      await workbook.xlsx.writeFile(outputPath);
      return;
    }

    // Convert each AAC page to an Excel worksheet
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      await this.convertPageToWorksheet(workbook, page, tree);
    }

    // Save the workbook
    await workbook.xlsx.writeFile(outputPath);
  }
}
