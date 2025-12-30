import {
  AACButton,
  AACPage,
  AACTree,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
} from "../core/treeStructure";
import path from "path";

export interface ScreenshotCell {
  text: string;
  row: number;
  col: number;
  isCategory?: boolean;
  isNavigation?: boolean;
  isEmpty?: boolean;
  imageUrl?: string;
}

export interface ScreenshotGrid {
  rows: number;
  cols: number;
  cells: ScreenshotCell[];
  categories: string[];
  metadata?: {
    timestamp?: string;
    battery?: string;
    date?: string;
  };
}

export interface ScreenshotPage {
  filename: string;
  grid: ScreenshotGrid;
  extractedAt: Date;
  pageName?: string;
  parentPath?: string;
  pageTitle?: string;
}

export interface PageHierarchy {
  [pageId: string]: {
    page: ScreenshotPage;
    children: string[];
    parent?: string;
  };
}

export interface ScreenshotConversionOptions {
  includeEmptyCells: boolean;
  generateIds: boolean;
  targetPlatform?: "grid3" | "asterics" | "snap" | "touchchat";
  language: string;
  fallbackCategory: string;
  filenameDelimiter?: string; // Default: '->' for "Home->Fragen"
}

export class ScreenshotConverter {
  private static defaultOptions: ScreenshotConversionOptions = {
    includeEmptyCells: false,
    generateIds: true,
    targetPlatform: "grid3",
    language: "en",
    fallbackCategory: "General",
    filenameDelimiter: "->",
  };

  /**
   * Parse filename to extract page hierarchy and names
   * Examples:
   * - "Home.png" → pageName: "Home", parentPath: ""
   * - "Home->Fragen.png" → pageName: "Fragen", parentPath: "Home"
   * - "Home->Settings->Profile.jpg" → pageName: "Profile", parentPath: "Home->Settings"
   */
  static parseFilename(
    filename: string,
    delimiter: string = "->",
  ): {
    pageName: string;
    parentPath: string;
  } {
    const baseName = path.parse(filename).name;
    const parts = baseName.split(delimiter).map((part) => part.trim());

    return {
      pageName: parts[parts.length - 1] || baseName,
      parentPath: parts.slice(0, -1).join(delimiter),
    };
  }

  /**
   * Build page hierarchy from an array of screenshots
   */
  static buildPageHierarchy(screenshots: ScreenshotPage[]): PageHierarchy {
    const hierarchy: PageHierarchy = {};
    const delimiter = this.defaultOptions.filenameDelimiter || "->";

    // First pass: parse all filenames
    screenshots.forEach((screenshot, index) => {
      const { pageName, parentPath } = this.parseFilename(
        screenshot.filename,
        delimiter,
      );

      screenshot.pageName = pageName;
      screenshot.parentPath = parentPath;

      const pageId = `page_${index}`;
      hierarchy[pageId] = {
        page: screenshot,
        children: [],
        parent: undefined,
      };
    });

    // Second pass: establish parent-child relationships
    Object.entries(hierarchy).forEach(([pageId, entry]) => {
      const parentPath = entry.page.parentPath;
      if (parentPath) {
        // Find parent by matching the full path
        const parent = Object.values(hierarchy).find(
          (h) => h.page.pageName === parentPath.split(delimiter).pop(),
        );
        if (parent) {
          entry.parent = Object.keys(hierarchy).find(
            (key) => hierarchy[key] === parent,
          );
          parent.children.push(pageId);
        }
      }
    });

    return hierarchy;
  }

  static parseOCRText(ocrResult: string): ScreenshotGrid {
    const lines = ocrResult.split("\n").filter((line) => line.trim());
    const cells: ScreenshotCell[] = [];
    const categories = new Set<string>();

    // Skip header metadata
    const contentStart = lines.findIndex(
      (line) => line.includes("ich möchte") && !line.includes("ich möchte	ich"),
    );

    if (contentStart === -1) {
      // Try another approach if the first pattern doesn't match
      const gridStart = lines.findIndex(
        (line) => line.includes("ich möchte") && line.split(/\s+/).length > 2,
      );
      if (gridStart === -1)
        return { rows: 6, cols: 11, cells: [], categories: [] };
    }

    // Find the line with the grid content (usually has tab-separated values)
    const gridLineIndex = lines.findIndex(
      (line) =>
        line.includes("ich möchte") &&
        line.includes("\t") &&
        line.split(/\s+/).length > 5,
    );

    let rows = 6;
    let cols = 11;

    // If we found a properly formatted grid line
    if (gridLineIndex !== -1) {
      const gridLine = lines[gridLineIndex];
      // Split by tabs to get individual cell values
      const tokens = gridLine
        .split("\t")
        .map((t) => t.trim())
        .filter((t) => t);
      cols = Math.max(tokens.length, cols);

      // Create first row from the main grid line
      tokens.forEach((token, col) => {
        const isCategory = this.isCategoryToken(token);
        const isNavigation = this.isNavigationToken(token);
        const isEmpty = !token || token === "..." || token === "";

        if (isCategory) categories.add(token);

        if (!isEmpty) {
          cells.push({
            text: token,
            row: 0,
            col,
            isCategory,
            isNavigation,
            isEmpty,
          });
        }
      });

      // Process subsequent lines
      let currentRow = 1;
      for (let i = gridLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip lines that look like headers or metadata
        if (
          line.match(/^\d+:\d+/) ||
          line.match(/[A-Z][a-z]{2},\s+\d+/) ||
          line.includes("%")
        )
          continue;

        // Skip duplicate "ich möchte" at start
        if (line === "ich möchte" && currentRow === 1) {
          currentRow = 0;
          continue;
        }

        const tokens = line
          .split("\t")
          .map((t) => t.trim())
          .filter((t) => t);

        tokens.forEach((token, col) => {
          const isCategory = this.isCategoryToken(token);
          const isNavigation = this.isNavigationToken(token);
          const isEmpty = !token || token === "..." || token === "";

          if (isCategory) categories.add(token);

          if (!isEmpty) {
            cells.push({
              text: token,
              row: currentRow,
              col,
              isCategory,
              isNavigation,
              isEmpty,
            });
          }
        });

        currentRow++;
        if (currentRow >= rows) break;
      }
    } else {
      // Fallback: simple whitespace parsing for unstructured OCR
      let currentRow = 0;
      lines.forEach((line, _lineIndex) => {
        if (!line.trim()) return;

        // Skip metadata
        if (
          line.includes("%") ||
          line.match(/\d+:\d+/) ||
          line.match(/[A-Z][a-z]{2},\s+\d+/)
        )
          return;

        const tokens = line.trim().split(/\s+/);
        tokens.forEach((token, tokenIndex) => {
          if (tokenIndex >= cols) return; // Skip if beyond expected columns

          const isCategory = this.isCategoryToken(token);
          const isNavigation = this.isNavigationToken(token);
          const isEmpty = !token || token.trim() === "" || token === "...";

          if (isCategory) categories.add(token);

          if (!isEmpty) {
            cells.push({
              text: token,
              row: currentRow,
              col: tokenIndex,
              isCategory,
              isNavigation,
              isEmpty,
            });
          }
        });

        currentRow++;
      });
    }

    // Auto-detect actual grid dimensions
    if (cells.length > 0) {
      rows = Math.max(...cells.map((c) => c.row)) + 1;
      cols = Math.max(...cells.map((c) => c.col)) + 1;
    }

    return {
      rows,
      cols,
      cells,
      categories: Array.from(categories),
    };
  }

  private static isCategoryToken(token: string): boolean {
    const knownCategories = [
      // English categories
      "Questions",
      "Meetings",
      "Praise",
      "Complaints",
      "Phrases",
      "Conversations",
      "Verbs",
      "People",
      "Messages",
      "Properties",
      "Feelings",
      "Actions",
      "Activities",
      "Food",
      "Drink",
      "Colors",
      "Shapes",
      "Settings",
      "Home",
      "Back",
      "Next",
      "Menu",
      // German categories
      "Fragen",
      "Treffen",
      "Lob",
      "Beschwerde",
      "Sprüche",
      "Gespräche",
      "Verben",
      "Leute",
      "Mitteilungen",
      "Eigenschaften",
      "Gefühle",
      "Spielen",
      "Multimedia",
      "Essen",
      "Trinken",
      "Farben/Formen",
    ];

    // Check for known categories
    if (knownCategories.includes(token)) {
      return true;
    }

    // Check for common category patterns
    const categoryPatterns = [
      /.*Questions?$/,
      /.*Category.*/,
      /.*Menu.*/,
      /.*Settings?$/,
      /.*Options?$/,
      /谈话/i, // Chinese
      /質問/i, // Japanese
      /preguntas/i, // Spanish
    ];

    return categoryPatterns.some((pattern) => pattern.test(token));
  }

  private static isNavigationToken(token: string): boolean {
    const navTokens = [
      // English
      "Home",
      "Back",
      "Next",
      "Previous",
      "Menu",
      "Settings",
      "Exit",
      "Close",
      "OK",
      "Cancel",
      "Yes",
      "No",
      "Help",
      "Search",
      // German
      "Home",
      "Zurück",
      "Weiter",
      "Menü",
      "Einstellungen",
      "Beenden",
      "Schließen",
      "Hilfe",
      "Suche",
      // Navigation indicators
      "←",
      "→",
      "↑",
      "↓",
      "◀",
      "▶",
      "▲",
      "▼",
    ];

    return (
      navTokens.includes(token) ||
      token === "←" ||
      token === "→" ||
      token === "↑" ||
      token === "↓"
    );
  }

  static convertToAACPage(
    screenshotPage: ScreenshotPage,
    pageHierarchy?: PageHierarchy,
    options?: Partial<ScreenshotConversionOptions>,
  ): AACPage {
    const opts: ScreenshotConversionOptions = {
      ...this.defaultOptions,
      ...options,
    };
    const buttons: AACButton[] = [];

    // Convert cells to AAC buttons
    screenshotPage.grid.cells.forEach((cell) => {
      if (cell.isEmpty && !opts.includeEmptyCells) return;

      const button = new AACButton({
        id: `cell_${cell.row}_${cell.col}`,
        label: cell.text,
        message: cell.text,
        style: {
          backgroundColor: cell.isCategory
            ? "#4CAF50"
            : cell.isNavigation
              ? "#2196F3"
              : "#FFFFFF",
          fontColor:
            cell.isCategory || cell.isNavigation ? "#FFFFFF" : "#000000",
          borderColor: "#CCCCCC",
          borderWidth: 1,
        },
        semanticAction: this.createSemanticAction(
          cell,
          screenshotPage,
          pageHierarchy,
          opts,
        ),
        x: cell.col,
        y: cell.row,
      });

      buttons.push(button);
    });

    return new AACPage({
      id: screenshotPage.pageName || "screenshot_page",
      name:
        screenshotPage.pageTitle ||
        screenshotPage.pageName ||
        "Screenshot Page",
      buttons,
      grid: {
        columns: screenshotPage.grid.cols,
        rows: screenshotPage.grid.rows,
      },
      style: {
        backgroundColor: "#F5F5F5",
      },
      parentId: null,
    });
  }

  private static createSemanticAction(
    cell: ScreenshotCell,
    screenshotPage: ScreenshotPage,
    pageHierarchy?: PageHierarchy,
    options?: ScreenshotConversionOptions,
  ): AACSemanticAction | undefined {
    if (cell.isEmpty) return undefined;

    const _opts: ScreenshotConversionOptions = {
      ...this.defaultOptions,
      ...options,
    };

    if (cell.isCategory) {
      // Try to find target page in hierarchy based on category name
      let targetId = `category_${cell.text.toLowerCase().replace(/\s+/g, "_")}`;

      if (pageHierarchy) {
        // Look for a page that matches this category
        const matchingPage = Object.values(pageHierarchy).find(
          (h) => h.page.pageName?.toLowerCase() === cell.text.toLowerCase(),
        );
        if (matchingPage) {
          targetId = matchingPage.page.pageName || targetId;
        }
      }

      return {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId,
        parameters: { category: cell.text },
      };
    }

    if (cell.isNavigation) {
      const text = cell.text.toLowerCase();

      // Home navigation
      if (text === "home" || text === "⌂") {
        return {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.GO_HOME,
        };
      }

      // Back navigation
      if (
        text === "back" ||
        text === "zurück" ||
        text === "←" ||
        text === "◀"
      ) {
        return {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.GO_BACK,
        };
      }

      // Next/forward navigation
      if (
        text === "next" ||
        text === "weiter" ||
        text === "→" ||
        text === "▶"
      ) {
        // If we have hierarchy, navigate to parent
        if (pageHierarchy && screenshotPage.parentPath) {
          const parentId = Object.keys(pageHierarchy).find(
            (key) =>
              pageHierarchy[key].page.pageName ===
              screenshotPage.parentPath?.split("->").pop(),
          );
          if (parentId) {
            return {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              targetId: parentId,
            };
          }
        }

        return {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: "next_page",
          parameters: { direction: "next" },
        };
      }

      // Menu navigation
      if (text === "menu" || text === "menü") {
        return {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: "main_menu",
        };
      }
    }

    // Default to speaking the text
    return {
      category: AACSemanticCategory.COMMUNICATION,
      intent: AACSemanticIntent.SPEAK_IMMEDIATE,
      text: cell.text,
      richText: {
        text: cell.text,
      },
    };
  }

  static convertToAACTree(
    screenshotPages: ScreenshotPage[],
    options?: Partial<ScreenshotConversionOptions>,
  ): AACTree {
    const opts = { ...this.defaultOptions, ...options };
    const tree = new AACTree();

    // Build page hierarchy
    const pageHierarchy = this.buildPageHierarchy(screenshotPages);

    // Set metadata on tree
    (tree as any).version = "1.0";
    (tree as any).metadata = {
      name: "Screenshot Conversion",
      author: "AAC Processors",
      description: "Converted from screenshot images",
      language: opts.language,
    };

    // Convert each screenshot page to AAC page
    screenshotPages.forEach((screenshotPage, index) => {
      const page = this.convertToAACPage(screenshotPage, pageHierarchy, opts);

      // Ensure unique ID by using page name if available
      if (screenshotPage.pageName) {
        page.id = this.sanitizePageId(screenshotPage.pageName);
      } else {
        page.id = `screenshot_page_${index}`;
      }

      tree.addPage(page);
    });

    // Set root page to the one with no parent
    const rootPage = Object.entries(pageHierarchy).find(
      ([_, entry]) => !entry.parent,
    );
    if (rootPage) {
      const rootPageId = this.sanitizePageId(
        rootPage[1].page.pageName || "home",
      );
      if (tree.pages[rootPageId]) {
        tree.rootId = rootPageId;
      }
    }

    return tree;
  }

  private static sanitizePageId(pageName: string): string {
    return pageName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }
}
