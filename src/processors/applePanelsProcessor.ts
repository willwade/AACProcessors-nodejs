import { BaseProcessor } from "../core/baseProcessor";
import { AACTree, AACPage, AACButton } from "../core/treeStructure";
// Removed unused import: FileProcessor
import plist from "plist";
import fs from "fs";

interface ApplePanelsButton {
  label: string;
  message?: string;
  targetPanel?: string;
  DisplayColor?: string;
  DisplayImageWeight?: string;
  FontSize?: number;
  Rect?: string; // Position and size in format "{{x, y}, {width, height}}"
}

interface ApplePanelsPanel {
  id: string;
  name: string;
  buttons: ApplePanelsButton[];
}

interface ApplePanelsDocument {
  panels: ApplePanelsPanel[];
}

class ApplePanelsProcessor extends BaseProcessor {
  // Helper function to parse Apple Panels Rect format "{{x, y}, {width, height}}"
  private parseRect(rectString: string): { x: number; y: number; width: number; height: number } | null {
    if (!rectString) return null;

    // Parse format like "{{0, 0}, {100, 25}}"
    const match = rectString.match(/\{\{(\d+),\s*(\d+)\},\s*\{(\d+),\s*(\d+)\}\}/);
    if (!match) return null;

    return {
      x: parseInt(match[1], 10),
      y: parseInt(match[2], 10),
      width: parseInt(match[3], 10),
      height: parseInt(match[4], 10)
    };
  }

  // Convert pixel coordinates to grid coordinates (assuming 25px grid cells)
  private pixelToGrid(pixelX: number, pixelY: number, cellSize: number = 25): { gridX: number; gridY: number } {
    return {
      gridX: Math.floor(pixelX / cellSize),
      gridY: Math.floor(pixelY / cellSize)
    };
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
    const content =
      typeof filePathOrBuffer === "string"
        ? fs.readFileSync(filePathOrBuffer, "utf8")
        : filePathOrBuffer.toString("utf8");

    const parsedData = plist.parse(content);
    const data = {
      panels: Array.isArray((parsedData as any).panels)
        ? (parsedData as any).panels
        : [],
    } as ApplePanelsDocument;
    const tree = new AACTree();

    data.panels.forEach((panel) => {
      const page = new AACPage({
        id: panel.id,
        name: panel.name,
        grid: [],
        buttons: [],
        parentId: null,
      });

      // Create a 2D grid to track button positions
      const gridLayout: (AACButton | null)[][] = [];
      const maxRows = 20; // Reasonable default for Apple Panels
      const maxCols = 20;
      for (let r = 0; r < maxRows; r++) {
        gridLayout[r] = new Array(maxCols).fill(null);
      }

      panel.buttons.forEach((btn, idx) => {
        const button = new AACButton({
          id: `${panel.id}_btn_${idx}`,
          label: btn.label,
          message: btn.message || btn.label,
          type: btn.targetPanel ? "NAVIGATE" : "SPEAK",
          targetPageId: btn.targetPanel,
          action: btn.targetPanel
            ? {
                type: "NAVIGATE",
                targetPageId: btn.targetPanel,
              }
            : null,
          style: {
            backgroundColor: btn.DisplayColor,
            fontSize: btn.FontSize,
            fontWeight: btn.DisplayImageWeight === "bold" ? "bold" : "normal",
          },
        });
        page.addButton(button);

        // Place button in grid layout using Rect position data
        if (btn.Rect) {
          const rect = this.parseRect(btn.Rect);
          if (rect) {
            const gridPos = this.pixelToGrid(rect.x, rect.y);
            const gridWidth = Math.max(1, Math.ceil(rect.width / 25));
            const gridHeight = Math.max(1, Math.ceil(rect.height / 25));

            // Place button in grid (handle width/height span)
            for (let r = gridPos.gridY; r < gridPos.gridY + gridHeight && r < maxRows; r++) {
              for (let c = gridPos.gridX; c < gridPos.gridX + gridWidth && c < maxCols; c++) {
                if (gridLayout[r] && gridLayout[r][c] === null) {
                  gridLayout[r][c] = button;
                }
              }
            }
          }
        }
      });

      // Set the page's grid layout
      page.grid = gridLayout;
      tree.addPage(page);
    });

    return tree;
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string,
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

    // Save the translated tree to a temporary file and return its content
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    const panels: ApplePanelsPanel[] = Object.values(tree.pages).map(
      (page) => ({
        id: page.id,
        name: page.name || "Panel",
        buttons: page.buttons.map((button, index) => {
          const buttonData: any = {
            label: button.label,
            message: button.message || button.label,
          };

          if (button.type === "NAVIGATE" && button.targetPageId) {
            buttonData.targetPanel = button.targetPageId;
          }

          if (button.style?.backgroundColor) {
            buttonData.DisplayColor = button.style.backgroundColor;
          }

          if (button.style?.fontWeight === "bold") {
            buttonData.DisplayImageWeight = "bold";
          }

          if (button.style?.fontSize) {
            buttonData.FontSize = button.style.fontSize;
          }

          // Find button position in grid layout and convert to Rect format
          let rect = `{{${index * 105}, {0}}, {100, 25}}`; // Default fallback

          if (page.grid && page.grid.length > 0) {
            // Search for button in grid layout
            for (let y = 0; y < page.grid.length; y++) {
              for (let x = 0; x < page.grid[y].length; x++) {
                const gridButton = page.grid[y][x];
                if (gridButton && gridButton.id === button.id) {
                  // Convert grid coordinates to pixel coordinates
                  const pixelX = x * 25;
                  const pixelY = y * 25;
                  rect = `{{${pixelX}, ${pixelY}}, {100, 25}}`;
                  break;
                }
              }
            }
          }

          buttonData.Rect = rect;
          return buttonData;
        }),
      }),
    );

    const document = { panels } as any;
    const plistContent = plist.build(document);
    fs.writeFileSync(outputPath, plistContent);
  }
}

export { ApplePanelsProcessor };
