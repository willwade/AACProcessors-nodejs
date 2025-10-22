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
import plist from 'plist';
import fs from 'fs';
import path from 'path';

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
  constructor(options?: ProcessorOptions) {
    super(options);
  }
  // Helper function to parse Apple Panels Rect format "{{x, y}, {width, height}}"
  private parseRect(
    rectString: string
  ): { x: number; y: number; width: number; height: number } | null {
    if (!rectString) return null;

    // Parse format like "{{0, 0}, {100, 25}}"
    const match = rectString.match(/\{\{(\d+),\s*(\d+)\},\s*\{(\d+),\s*(\d+)\}\}/);
    if (!match) return null;

    return {
      x: parseInt(match[1], 10),
      y: parseInt(match[2], 10),
      width: parseInt(match[3], 10),
      height: parseInt(match[4], 10),
    };
  }

  // Convert pixel coordinates to grid coordinates (assuming 25px grid cells)
  private pixelToGrid(
    pixelX: number,
    pixelY: number,
    cellSize: number = 25
  ): { gridX: number; gridY: number } {
    return {
      gridX: Math.floor(pixelX / cellSize),
      gridY: Math.floor(pixelY / cellSize),
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
    let content: string;

    if (Buffer.isBuffer(filePathOrBuffer)) {
      content = filePathOrBuffer.toString('utf8');
    } else if (typeof filePathOrBuffer === 'string') {
      // Check if it's a .ascconfig folder or a direct .plist file
      if (filePathOrBuffer.endsWith('.ascconfig')) {
        // Read from proper Apple Panels structure: *.ascconfig/Contents/Resources/PanelDefinitions.plist
        const panelDefsPath = `${filePathOrBuffer}/Contents/Resources/PanelDefinitions.plist`;
        if (fs.existsSync(panelDefsPath)) {
          content = fs.readFileSync(panelDefsPath, 'utf8');
        } else {
          throw new Error(`Apple Panels file not found: ${panelDefsPath}`);
        }
      } else {
        // Fallback: treat as direct .plist file
        content = fs.readFileSync(filePathOrBuffer, 'utf8');
      }
    } else {
      throw new Error('Invalid input: expected string path or Buffer');
    }

    const parsedData = plist.parse(content);

    // Handle both old format (panels array) and new Apple Panels format (Panels dict)
    let panelsData: any[] = [];
    if (Array.isArray((parsedData as any).panels)) {
      // Old format
      panelsData = (parsedData as any).panels;
    } else if ((parsedData as any).Panels) {
      // Apple Panels format: convert Panels dict to array
      const panelsDict = (parsedData as any).Panels;
      panelsData = Object.keys(panelsDict).map((panelId) => {
        const panel = panelsDict[panelId];
        return {
          id: (panel.ID || panelId).replace(/^USER\./, ''), // Strip USER. prefix to maintain original IDs
          name: panel.Name || 'Panel',
          buttons: (panel.PanelObjects || [])
            .filter((obj: any) => obj.PanelObjectType === 'Button')
            .map((btn: any) => {
              const firstAction =
                Array.isArray(btn.Actions) && btn.Actions.length > 0 ? btn.Actions[0] : undefined;
              const isCharSequence =
                firstAction &&
                (firstAction.ActionType === 'ActionPressKeyCharSequence' ||
                  firstAction.ActionType === 'ActionSendKeys');
              const charString = isCharSequence
                ? (firstAction.ActionParam?.CharString ?? undefined)
                : undefined;
              const targetPanel =
                firstAction && firstAction.ActionType === 'ActionOpenPanel'
                  ? firstAction.ActionParam?.PanelID?.replace(/^USER\./, '')
                  : undefined;
              return {
                label: btn.DisplayText || 'Button',
                message: charString || btn.DisplayText || 'Button',
                DisplayColor: btn.DisplayColor,
                DisplayImageWeight: btn.DisplayImageWeight,
                FontSize: btn.FontSize,
                Rect: btn.Rect,
                targetPanel,
              };
            }),
        };
      });
    }

    const data = { panels: panelsData } as ApplePanelsDocument;
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
        // Create semantic action from Apple Panels button
        let semanticAction: AACSemanticAction | undefined;

        if (btn.targetPanel) {
          semanticAction = {
            category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
            targetId: btn.targetPanel,
            platformData: {
              applePanels: {
                actionType: 'ActionOpenPanel',
                parameters: { PanelID: `USER.${btn.targetPanel}` },
              },
            },
            fallback: {
              type: 'NAVIGATE',
              targetPageId: btn.targetPanel,
            },
          };
        } else {
          semanticAction = {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: btn.message || btn.label,
            platformData: {
              applePanels: {
                actionType: 'ActionPressKeyCharSequence',
                parameters: {
                  CharString: btn.message || btn.label || '',
                  isStickyKey: false,
                },
              },
            },
            fallback: {
              type: 'SPEAK',
              message: btn.message || btn.label,
            },
          };
        }

        const button = new AACButton({
          id: `${panel.id}_btn_${idx}`,
          label: btn.label,
          message: btn.message || btn.label,
          targetPageId: btn.targetPanel,
          semanticAction: semanticAction,
          style: {
            backgroundColor: btn.DisplayColor,
            fontSize: btn.FontSize,
            fontWeight: btn.DisplayImageWeight === 'bold' ? 'bold' : 'normal',
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

        if (button.semanticAction) {
          const intentStr = String(button.semanticAction.intent);
          if (intentStr === 'SPEAK_TEXT' || intentStr === 'INSERT_TEXT') {
            const updatedText = button.message || button.label || '';
            button.semanticAction.text = updatedText;
            if (button.semanticAction.fallback) {
              button.semanticAction.fallback.message = updatedText;
            }
            const platformParams =
              button.semanticAction.platformData?.applePanels?.parameters;
            if (platformParams && typeof platformParams === 'object') {
              if ('CharString' in platformParams) {
                platformParams.CharString = updatedText;
              }
              if ('PanelID' in platformParams && button.targetPageId) {
                platformParams.PanelID = `USER.${button.targetPageId}`;
              }
            }
          }
        }
      });
    });

    // Save the translated tree to the requested location and return its content
    this.saveFromTree(tree, outputPath);

    if (outputPath.endsWith('.plist')) {
      return fs.readFileSync(outputPath);
    }
    // In bundle mode, return the PanelDefinitions.plist content
    const configPath = outputPath.endsWith('.ascconfig') ? outputPath : `${outputPath}.ascconfig`;
    const panelDefsPath = path.join(configPath, 'Contents', 'Resources', 'PanelDefinitions.plist');
    return fs.readFileSync(panelDefsPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    // Support two output modes:
    // 1) Single-file .plist (PanelDefinitions.plist content written directly)
    // 2) Apple Panels bundle folder (*.ascconfig) with Contents/Resources structure
    const isSinglePlist = outputPath.endsWith('.plist');

    // Prepare folder structure only when exporting as bundle
    let configPath = '';
    let contentsPath = '';
    let resourcesPath = '';
    if (!isSinglePlist) {
      configPath = outputPath.endsWith('.ascconfig') ? outputPath : `${outputPath}.ascconfig`;
      contentsPath = path.join(configPath, 'Contents');
      resourcesPath = path.join(contentsPath, 'Resources');

      if (!fs.existsSync(configPath)) fs.mkdirSync(configPath, { recursive: true });
      if (!fs.existsSync(contentsPath)) fs.mkdirSync(contentsPath, { recursive: true });
      if (!fs.existsSync(resourcesPath)) fs.mkdirSync(resourcesPath, { recursive: true });

      // Create Info.plist (bundle mode only)
      const infoPlist = {
        ASCConfigurationDisplayName: 'AAC Processors Export',
        ASCConfigurationIdentifier: `com.aacprocessors.${Date.now()}`,
        ASCConfigurationProductSupportType: 'VirtualKeyboard',
        ASCConfigurationVersion: '7.1',
        CFBundleDevelopmentRegion: 'en',
        CFBundleIdentifier: 'com.aacprocessors.panel.export',
        CFBundleName: 'AAC Processors Panels',
        CFBundleShortVersionString: '1.0',
        CFBundleVersion: '1',
        NSHumanReadableCopyright: 'Generated by AAC Processors',
      };
      const infoPlistContent = plist.build(infoPlist);
      fs.writeFileSync(path.join(contentsPath, 'Info.plist'), infoPlistContent);

      // Create AssetIndex.plist (empty)
      const assetIndexContent = plist.build({});
      fs.writeFileSync(path.join(resourcesPath, 'AssetIndex.plist'), assetIndexContent);
    }

    // Build PanelDefinitions content from tree
    const panelsDict: any = {};

    Object.values(tree.pages).forEach((page, pageIndex) => {
      const panelId = `USER.${page.id}`;

      // Detect actual grid dimensions from the source data
      let gridCols = 4; // Default fallback
      let gridRows = Math.ceil(page.buttons.length / gridCols);

      if (page.grid && page.grid.length > 0) {
        // Use actual grid dimensions from source
        gridRows = page.grid.length;
        gridCols = page.grid[0] ? page.grid[0].length : 4;

        // Find the actual used area to avoid empty space
        let maxUsedX = 0,
          maxUsedY = 0;
        for (let y = 0; y < page.grid.length; y++) {
          for (let x = 0; x < page.grid[y].length; x++) {
            if (page.grid[y][x]) {
              maxUsedX = Math.max(maxUsedX, x);
              maxUsedY = Math.max(maxUsedY, y);
            }
          }
        }
        // Use the actual used dimensions if they're reasonable
        if (maxUsedX > 0 && maxUsedY > 0) {
          gridCols = maxUsedX + 1;
          gridRows = maxUsedY + 1;
        }
      } else {
        // Intelligent auto-layout: try to make a reasonable grid
        const buttonCount = page.buttons.length;
        if (buttonCount <= 6) {
          gridCols = Math.min(buttonCount, 3); // 1-3 columns for small sets
        } else if (buttonCount <= 12) {
          gridCols = 4; // 4 columns for medium sets
        } else if (buttonCount <= 24) {
          gridCols = 6; // 6 columns for larger sets
        } else {
          gridCols = 8; // 8 columns for very large sets
        }
        gridRows = Math.ceil(buttonCount / gridCols);
      }

      const panelObjects = page.buttons.map((button, buttonIndex) => {
        // Find button position in grid layout and convert to Rect format
        let rect: string;

        if (page.grid && page.grid.length > 0) {
          // Search for button in actual grid layout
          let found = false;
          for (let y = 0; y < page.grid.length && !found; y++) {
            for (let x = 0; x < page.grid[y].length && !found; x++) {
              const gridButton = page.grid[y][x];
              if (gridButton && gridButton.id === button.id) {
                // Convert grid coordinates to pixel coordinates
                const pixelX = x * 105; // 105px per column (100px button + 5px spacing)
                const pixelY = y * 30; // 30px per row (25px button + 5px spacing)
                rect = `{{${pixelX}, ${pixelY}}, {100, 25}}`;
                found = true;
              }
            }
          }

          if (!found) {
            // Button not found in grid, use auto-layout
            const autoX = (buttonIndex % gridCols) * 105;
            const autoY = Math.floor(buttonIndex / gridCols) * 30;
            rect = `{{${autoX}, ${autoY}}, {100, 25}}`;
          }
        } else {
          // Use auto-layout with detected grid dimensions
          const autoX = (buttonIndex % gridCols) * 105;
          const autoY = Math.floor(buttonIndex / gridCols) * 30;
          rect = `{{${autoX}, ${autoY}}, {100, 25}}`;
        }

        const buttonObj: any = {
          ButtonType: 0,
          DisplayText: button.label || 'Button',
          FontSize: button.style?.fontSize || 12,
          ID: `Button.${button.id}`,
          PanelObjectType: 'Button',
          Rect: rect!,
        };

        if (button.style?.backgroundColor) {
          buttonObj.DisplayColor = button.style.backgroundColor;
        }

        if (button.style?.fontWeight === 'bold') {
          buttonObj.DisplayImageWeight = 'FontWeightBold';
        } else {
          buttonObj.DisplayImageWeight = 'FontWeightRegular';
        }

        // Add actions - prefer semantic action if available
        buttonObj.Actions = [this.createApplePanelsAction(button)];

        return buttonObj;
      });

      panelsDict[panelId] = {
        DisplayOrder: pageIndex + 1,
        GlidingLensSize: 5,
        HasTransientPosition: false,
        HideHome: false,
        HideMinimize: false,
        HidePanelAdjustments: false,
        HideSwitchDock: false,
        HideSwitchDockContextualButtons: false,
        HideTitlebar: false,
        ID: panelId,
        Name: page.name || 'Panel',
        PanelObjects: panelObjects,
        ProductSupportType: 'All',
        Rect: '{{15, 75}, {425, 55}}',
        ScanStyle: 0,
        ShowPanelLocationString: 'CustomPanelList',
        UsesPinnedResizing: false,
      };
    });

    const panelDefinitions = {
      Panels: panelsDict,
      ToolbarOrdering: {
        ToolbarIdentifiersAfterBasePanel: [],
        ToolbarIdentifiersPriorToBasePanel: [],
      },
    };

    const panelDefsContent = plist.build(panelDefinitions);

    if (isSinglePlist) {
      // Write single PanelDefinitions.plist file directly
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, panelDefsContent);
    } else {
      // Write into bundle structure
      fs.writeFileSync(path.join(resourcesPath, 'PanelDefinitions.plist'), panelDefsContent);
    }
  }

  private createApplePanelsAction(button: AACButton): any {
    // Use semantic action if available
    if (button.semanticAction?.platformData?.applePanels) {
      const applePanelsData = button.semanticAction.platformData.applePanels;
      return {
        ActionParam: applePanelsData.parameters,
        ActionRecordedOffset: 0.0,
        ActionType: applePanelsData.actionType,
        ID: `Action.${button.id}`,
      };
    }

    // Handle semantic actions without Apple Panels specific data
    if (button.semanticAction) {
      const intentStr = String(button.semanticAction.intent);
      switch (intentStr) {
        case 'NAVIGATE_TO':
          return {
            ActionParam: {
              PanelID: `USER.${button.semanticAction.targetId || button.targetPageId || ''}`,
            },
            ActionRecordedOffset: 0.0,
            ActionType: 'ActionOpenPanel',
            ID: `Action.${button.id}`,
          };

        case 'SPEAK_TEXT':
        case 'INSERT_TEXT':
          return {
            ActionParam: {
              CharString: button.semanticAction.text || button.message || button.label || '',
              isStickyKey: false,
            },
            ActionRecordedOffset: 0.0,
            ActionType: 'ActionPressKeyCharSequence',
            ID: `Action.${button.id}`,
          };

        case 'SEND_KEYS':
          return {
            ActionParam: {
              CharString: button.semanticAction.text || '',
              isStickyKey: false,
            },
            ActionRecordedOffset: 0.0,
            ActionType: 'ActionSendKeys',
            ID: `Action.${button.id}`,
          };

        default:
          // Fallback to speech for unknown semantic actions
          return {
            ActionParam: {
              CharString:
                button.semanticAction.fallback?.message || button.message || button.label || '',
              isStickyKey: false,
            },
            ActionRecordedOffset: 0.0,
            ActionType: 'ActionPressKeyCharSequence',
            ID: `Action.${button.id}`,
          };
      }
    }

    // Default SPEAK action if no semantic action
    return {
      ActionParam: {
        CharString: button.message || button.label || '',
        isStickyKey: false,
      },
      ActionRecordedOffset: 0.0,
      ActionType: 'ActionPressKeyCharSequence',
      ID: `Action.${button.id}`,
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
}

export { ApplePanelsProcessor };
