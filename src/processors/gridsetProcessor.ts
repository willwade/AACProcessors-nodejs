import { BaseProcessor, ProcessorOptions } from "../core/baseProcessor";
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
} from "../core/treeStructure";
import AdmZip from "adm-zip";
import fs from "fs";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

interface GridsetButton {
  label: string;
  message?: string;
  navigationTarget?: string;
}

interface _GridsetGrid {
  id: string;
  name: string;
  buttons: GridsetButton[];
}

class GridsetProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }
  // Helper function to generate Grid3 commands from semantic actions
  private generateCommandsFromSemanticAction(
    button: AACButton,
    tree?: AACTree,
  ): any {
    const semanticAction = button.semanticAction;

    if (!semanticAction) {
      // Default to insert text action
      return {
        Command: {
          "@_ID": "Action.InsertText",
          Parameter: {
            "@_Key": "text",
            "#text": button.message || button.label || "",
          },
        },
      };
    }

    // Use platform-specific Grid3 data if available
    if (semanticAction.platformData?.grid3) {
      const grid3Data = semanticAction.platformData.grid3;
      const params = Object.entries(grid3Data.parameters || {}).map(
        ([key, value]) => ({
          "@_Key": key,
          "#text": String(value),
        }),
      );

      return {
        Command: {
          "@_ID": grid3Data.commandId,
          ...(params.length > 0 ? { Parameter: params } : {}),
        },
      };
    }

    // Convert semantic actions to Grid3 commands
    switch (semanticAction.intent) {
      case AACSemanticIntent.NAVIGATE_TO:
        // For Grid3, we need to use the grid name, not the ID
        let targetGridName = semanticAction.targetId || "";
        if (tree && semanticAction.targetId) {
          const targetPage = tree.getPage(semanticAction.targetId);
          if (targetPage) {
            targetGridName = targetPage.name || targetPage.id;
          }
        }
        return {
          Command: {
            "@_ID": "Jump.To",
            Parameter: {
              "@_Key": "grid",
              "#text": targetGridName,
            },
          },
        };

      case AACSemanticIntent.GO_BACK:
        return {
          Command: {
            "@_ID": "Jump.Back",
          },
        };

      case AACSemanticIntent.GO_HOME:
        return {
          Command: {
            "@_ID": "Jump.Home",
          },
        };

      case AACSemanticIntent.DELETE_WORD:
        return {
          Command: {
            "@_ID": "Action.DeleteWord",
          },
        };

      case AACSemanticIntent.DELETE_CHARACTER:
        return {
          Command: {
            "@_ID": "Action.DeleteLetter",
          },
        };

      case AACSemanticIntent.CLEAR_TEXT:
        return {
          Command: {
            "@_ID": "Action.Clear",
          },
        };

      case AACSemanticIntent.SPEAK_TEXT:
      case AACSemanticIntent.SPEAK_IMMEDIATE:
        return {
          Command: {
            "@_ID": "Action.Speak",
          },
        };

      case AACSemanticIntent.INSERT_TEXT:
        return {
          Command: {
            "@_ID": "Action.InsertText",
            Parameter: {
              "@_Key": "text",
              "#text":
                semanticAction.text || button.message || button.label || "",
            },
          },
        };

      case AACSemanticIntent.DELETE_WORD:
        return {
          Command: {
            "@_ID": "Action.DeleteWord",
          },
        };

      case AACSemanticIntent.CLEAR_TEXT:
        return {
          Command: {
            "@_ID": "Action.Clear",
          },
        };

      default:
        // Fallback to insert text
        return {
          Command: {
            "@_ID": "Action.InsertText",
            Parameter: {
              "@_Key": "text",
              "#text":
                semanticAction.text || button.message || button.label || "",
            },
          },
        };
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
      fontSize: grid3Style.FontSize ? parseInt(grid3Style.FontSize) : undefined,
    };
  }

  // Helper function to get style by ID or return default
  private getStyleById(styles: Map<string, any>, styleId?: string): any {
    if (!styleId || !styles.has(styleId)) {
      return {};
    }
    return this.convertGrid3StyleToAACStyle(styles.get(styleId));
  }
  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);
    const tree = this.loadIntoTree(buffer);
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

  loadIntoTree(filePathOrBuffer: Buffer): AACTree {
    const tree = new AACTree();

    let zip: AdmZip;
    try {
      zip = new AdmZip(filePathOrBuffer);
    } catch (error: any) {
      throw new Error(`Invalid ZIP file format: ${error.message}`);
    }

    const parser = new XMLParser({ ignoreAttributes: false });

    // First, load styles from Settings0/Styles/styles.xml (Grid3 format)
    const styles = new Map<string, any>();
    const styleEntry = zip
      .getEntries()
      .find(
        (entry) =>
          entry.entryName.endsWith("styles.xml") ||
          entry.entryName.endsWith("style.xml"),
      );
    if (styleEntry) {
      try {
        const styleXmlContent = styleEntry.getData().toString("utf8");
        const styleData = parser.parse(styleXmlContent);
        // Parse styles and store them in the map
        // Grid3 uses StyleData.Styles.Style with Key attribute
        if (styleData.StyleData?.Styles?.Style) {
          const styleArray = Array.isArray(styleData.StyleData.Styles.Style)
            ? styleData.StyleData.Styles.Style
            : [styleData.StyleData.Styles.Style];
          styleArray.forEach((style: any) => {
            if (style["@_Key"]) {
              styles.set(style["@_Key"], style);
            }
          });
        }
        // Also handle legacy format with @_ID
        else if (styleData.Styles?.Style) {
          const styleArray = Array.isArray(styleData.Styles.Style)
            ? styleData.Styles.Style
            : [styleData.Styles.Style];
          styleArray.forEach((style: any) => {
            if (style["@_ID"]) {
              styles.set(style["@_ID"], style);
            }
          });
        }
      } catch (e) {
        console.warn("Failed to parse styles.xml:", e);
      }
    }

    // Debug: log all entry names
    // console.log('Gridset zip entries:', zip.getEntries().map(e => e.entryName));

    // First pass: collect all grid names and IDs for navigation resolution
    const gridNameToIdMap = new Map<string, string>();
    const gridIdToNameMap = new Map<string, string>();

    zip.getEntries().forEach((entry) => {
      if (
        entry.entryName.startsWith("Grids/") &&
        entry.entryName.endsWith("grid.xml")
      ) {
        try {
          const xmlContent = entry.getData().toString("utf8");
          const data = parser.parse(xmlContent);
          const grid = data.Grid || data.grid;
          if (!grid) return;

          function extractText(val: any): string | undefined {
            if (!val) return undefined;
            if (typeof val === "string") return val;
            if (typeof val === "object" && "#text" in val) return val["#text"];
            return undefined;
          }

          const gridId = extractText(grid.GridGuid || grid.gridGuid || grid.id);
          let gridName =
            extractText(grid.Name) ||
            extractText(grid.name) ||
            extractText(grid["@_Name"]);
          if (!gridName) {
            const match = entry.entryName.match(/^Grids\/([^/]+)\//);
            if (match) gridName = match[1];
          }

          if (gridId && gridName) {
            gridNameToIdMap.set(gridName, gridId);
            gridIdToNameMap.set(gridId, gridName);
          }
        } catch (e) {
          // Skip errors in first pass
        }
      }
    });

    // Second pass: process each grid file in the gridset
    zip.getEntries().forEach((entry) => {
      // Only process files named grid.xml under Grids/ (any subdir)
      if (
        entry.entryName.startsWith("Grids/") &&
        entry.entryName.endsWith("grid.xml")
      ) {
        let xmlContent: string;
        try {
          xmlContent = entry.getData().toString("utf8");
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
        function extractText(val: any): string | undefined {
          if (!val) return undefined;
          if (typeof val === "string") return val;
          if (typeof val === "object" && "#text" in val) return val["#text"];
          return undefined;
        }
        const gridId = extractText(grid.GridGuid || grid.gridGuid || grid.id);
        let gridName =
          extractText(grid.Name) ||
          extractText(grid.name) ||
          extractText(grid["@_Name"]);
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
        const maxCols = Array.isArray(columnDefs)
          ? columnDefs.length
          : columnDefs
            ? 1
            : 5;
        const maxRows = Array.isArray(rowDefs)
          ? rowDefs.length
          : rowDefs
            ? 1
            : 4;

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

          cellArr.forEach((cell: any, idx: number) => {
            if (!cell || !cell.Content) return;

            // Extract position information from cell attributes
            // Grid3 uses 1-based coordinates, convert to 0-based for internal use
            const cellX = Math.max(0, parseInt(cell["@_X"] || "1", 10) - 1);
            const cellY = Math.max(0, parseInt(cell["@_Y"] || "1", 10) - 1);
            const colSpan = parseInt(cell["@_ColumnSpan"] || "1", 10);
            const rowSpan = parseInt(cell["@_RowSpan"] || "1", 10);

            // Extract label from CaptionAndImage/Caption
            const content = cell.Content;
            const captionAndImage =
              content.CaptionAndImage || content.captionAndImage;
            let label =
              captionAndImage?.Caption || captionAndImage?.caption || "";

            // If no caption, try other sources or create a placeholder
            if (!label) {
              // For cells without captions (like AutoContent cells), create a meaningful label
              if (content.ContentType === "AutoContent") {
                label = `AutoContent_${idx}`;
              } else {
                return; // Skip cells without labels
              }
            }

            const message = label; // Use caption as message

            // Parse all command types from Grid3 and create semantic actions
            let semanticAction: AACSemanticAction | undefined;
            let legacyAction: any = null;
            let buttonType: "SPEAK" | "NAVIGATE" | "ACTION" = "SPEAK";
            let navigationTarget: string | undefined;

            const commands =
              content.Commands?.Command || content.commands?.command;
            if (commands) {
              const commandArr = Array.isArray(commands)
                ? commands
                : [commands];

              for (const command of commandArr) {
                const commandId = command["@_ID"] || command.ID || command.id;
                const parameters = command.Parameter || command.parameter;

                const paramArr = parameters
                  ? Array.isArray(parameters)
                    ? parameters
                    : [parameters]
                  : [];

                // Helper to get parameter value
                const getParam = (key: string) => {
                  if (!parameters) return undefined;
                  for (const param of paramArr) {
                    if (
                      param["@_Key"] === key ||
                      param.Key === key ||
                      param.key === key
                    ) {
                      return param["#text"] || param.text || param;
                    }
                  }
                  return undefined;
                };

                switch (commandId) {
                  case "Jump.To":
                    const gridTarget = getParam("grid");
                    if (gridTarget) {
                      // Resolve grid name to grid ID for navigation
                      const targetGridId =
                        gridNameToIdMap.get(gridTarget) || gridTarget;
                      navigationTarget = targetGridId;
                      buttonType = "NAVIGATE";
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
                          type: "NAVIGATE",
                          targetPageId: targetGridId,
                        },
                      };
                      legacyAction = {
                        type: "NAVIGATE",
                        targetPageId: targetGridId,
                      };
                    }
                    break;

                  case "Jump.Back":
                    buttonType = "ACTION";
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
                        type: "ACTION",
                        message: "Go back",
                      },
                    };
                    legacyAction = {
                      type: "GO_BACK",
                    };
                    break;

                  case "Jump.Home":
                    buttonType = "ACTION";
                    semanticAction = {
                      category: AACSemanticCategory.NAVIGATION,
                      intent: AACSemanticIntent.GO_HOME,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {},
                        },
                      },
                      fallback: {
                        type: "ACTION",
                        message: "Go home",
                      },
                    };
                    legacyAction = {
                      type: "GO_HOME",
                    };
                    break;

                  case "Action.Speak":
                    buttonType = "SPEAK";
                    const speakUnit = getParam("unit");
                    const moveCaret = getParam("movecaret");
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
                        type: "SPEAK",
                        message: "Speak text",
                      },
                    };
                    legacyAction = {
                      type: "SPEAK",
                      unit: speakUnit,
                      moveCaret: moveCaret ? parseInt(moveCaret) : undefined,
                    };
                    break;

                  case "Action.InsertText":
                    buttonType = "SPEAK"; // InsertText is primarily communication
                    const insertText = getParam("text");
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
                        type: "SPEAK",
                        message: insertText,
                      },
                    };
                    legacyAction = {
                      type: "INSERT_TEXT",
                      text: insertText,
                    };
                    break;

                  case "Action.DeleteWord":
                    buttonType = "ACTION";
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
                        type: "ACTION",
                        message: "Delete word",
                      },
                    };
                    legacyAction = {
                      type: "DELETE_WORD",
                    };
                    break;

                  case "Action.DeleteLetter":
                    buttonType = "ACTION";
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
                        type: "ACTION",
                        message: "Delete character",
                      },
                    };
                    legacyAction = {
                      type: "DELETE_CHARACTER",
                    };
                    break;

                  case "Action.Clear":
                    buttonType = "ACTION";
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
                        type: "ACTION",
                        message: "Clear text",
                      },
                    };
                    legacyAction = {
                      type: "CLEAR_TEXT",
                    };
                    break;

                  case "Action.Clear":
                    buttonType = "ACTION";
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
                        type: "ACTION",
                        message: "Clear text",
                      },
                    };
                    legacyAction = {
                      type: "CLEAR",
                    };
                    break;

                  case "Action.Letter":
                    buttonType = "ACTION";
                    const letter = getParam("letter");
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
                        type: "ACTION",
                        message: letter,
                      },
                    };
                    legacyAction = {
                      type: "INSERT_LETTER",
                      letter,
                    };
                    break;

                  case "Settings.RestAll":
                    buttonType = "ACTION";
                    semanticAction = {
                      category: AACSemanticCategory.CUSTOM,
                      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {
                            indicatorenabled: getParam("indicatorenabled"),
                            action: getParam("action"),
                          },
                        },
                      },
                      fallback: {
                        type: "ACTION",
                        message: "Settings action",
                      },
                    };
                    legacyAction = {
                      type: "SETTINGS",
                      indicatorEnabled: getParam("indicatorenabled") === "1",
                      settingsAction: getParam("action"),
                    };
                    break;

                  case "AutoContent.Activate":
                    buttonType = "ACTION";
                    semanticAction = {
                      category: AACSemanticCategory.CUSTOM,
                      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
                      platformData: {
                        grid3: {
                          commandId,
                          parameters: {
                            autocontenttype: getParam("autocontenttype"),
                          },
                        },
                      },
                      fallback: {
                        type: "ACTION",
                        message: "Auto content",
                      },
                    };
                    legacyAction = {
                      type: "AUTO_CONTENT",
                      autoContentType: getParam("autocontenttype"),
                    };
                    break;

                  default:
                    // Unknown command - preserve as generic action
                    if (commandId) {
                      buttonType = "ACTION";
                      const allParams = Object.fromEntries(
                        paramArr.map((p) => [p.Key || p.key, p["#text"]]),
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
                          type: "ACTION",
                          message: "Unknown command",
                        },
                      };
                      legacyAction = {
                        type: "SPEAK",
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
                  type: "SPEAK",
                  message: String(message),
                },
              };
            }

            // Get style information from cell attributes and Content.Style
            let cellStyleId = cell["@_StyleID"] || cell["@_styleid"];

            // Grid3 format: check Content.Style.BasedOnStyle
            if (!cellStyleId && content.Style?.BasedOnStyle) {
              cellStyleId = content.Style.BasedOnStyle;
            }

            const cellStyle = this.getStyleById(styles, cellStyleId);

            // Also check for inline style overrides
            const inlineStyle: any = {};
            if (cell["@_BackColour"])
              inlineStyle.backgroundColor = cell["@_BackColour"];
            if (cell["@_FontColour"])
              inlineStyle.fontColor = cell["@_FontColour"];
            if (cell["@_BorderColour"])
              inlineStyle.borderColor = cell["@_BorderColour"];

            // Grid3 inline styles from Content.Style
            if (content.Style) {
              if (content.Style.BackColour)
                inlineStyle.backgroundColor = content.Style.BackColour;
              if (content.Style.FontColour)
                inlineStyle.fontColor = content.Style.FontColour;
              if (content.Style.BorderColour)
                inlineStyle.borderColor = content.Style.BorderColour;
              if (content.Style.FontName)
                inlineStyle.fontFamily = content.Style.FontName;
              if (content.Style.FontSize)
                inlineStyle.fontSize = parseInt(content.Style.FontSize);
            }

            const button = new AACButton({
              id: `${gridId}_btn_${idx}`,
              label: String(label),
              message: String(message),
              targetPageId: navigationTarget
                ? String(navigationTarget)
                : undefined,
              semanticAction: semanticAction,
              style: {
                ...cellStyle,
                ...inlineStyle, // Inline styles override referenced styles
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

          // Set the page's grid layout
          page.grid = gridLayout;
        }

        tree.addPage(page);
      }
    });

    // After all pages are loaded, set parentId for navigation targets
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach((btn: AACButton) => {
        if (
          btn.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO &&
          btn.targetPageId
        ) {
          const targetPage = tree.getPage(btn.targetPageId);
          if (targetPage) {
            targetPage.parentId = page.id;
          }
        }
      });
    }

    return tree;
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string,
  ): Buffer {
    // Load the tree, apply translations, and save to new file
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);
    const tree = this.loadIntoTree(buffer);

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
    const zip = new AdmZip();

    if (Object.keys(tree.pages).length === 0) {
      // Create empty zip for empty tree
      zip.writeZip(outputPath);
      return;
    }

    // Collect all unique styles from pages and buttons
    const uniqueStyles = new Map<string, any>();
    let styleIdCounter = 1;

    // Helper function to add style and return its ID
    const addStyle = (style: any): string => {
      if (!style || Object.keys(style).length === 0) return "";

      const styleKey = JSON.stringify(style);
      if (!uniqueStyles.has(styleKey)) {
        const styleId = `Style${styleIdCounter++}`;
        uniqueStyles.set(styleKey, { id: styleId, style });
        return styleId;
      }
      return uniqueStyles.get(styleKey)!.id;
    };

    // Collect styles from all pages and buttons
    Object.values(tree.pages).forEach((page) => {
      if (page.style) addStyle(page.style);
      page.buttons.forEach((button) => {
        if (button.style) addStyle(button.style);
      });
    });

    // Get the first page as the home/start grid
    const pages = Object.values(tree.pages);
    const startGrid = pages.length > 0 ? pages[0].name || pages[0].id : "";

    // Create Settings0/settings.xml with proper Grid3 structure
    const settingsData = {
      "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
      GridSetSettings: {
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        StartGrid: startGrid,
        // Add other common Grid3 settings
        ScanEnabled: "false",
        ScanTimeoutMs: "2000",
        HoverEnabled: "false",
        HoverTimeoutMs: "1000",
        MouseclickEnabled: "true",
        Language: "en-US",
      },
    };

    const settingsBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: "  ",
    });
    const settingsXmlContent = settingsBuilder.build(settingsData);
    zip.addFile(
      "Settings0/settings.xml",
      Buffer.from(settingsXmlContent, "utf8"),
    );

    // Create Settings0/Styles/style.xml if there are styles
    if (uniqueStyles.size > 0) {
      const stylesArray = Array.from(uniqueStyles.values()).map(
        ({ id, style }) => ({
          "@_Key": id,
          BackColour: style.backgroundColor || "#FFFFFFFF",
          TileColour: style.backgroundColor || "#FFFFFFFF",
          BorderColour: style.borderColor || "#000000FF",
          FontColour: style.fontColor || "#000000FF",
          FontName: style.fontFamily || "Arial",
          FontSize: style.fontSize?.toString() || "16",
        }),
      );

      const styleData = {
        "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
        StyleData: {
          "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          Styles: {
            Style: stylesArray,
          },
        },
      };

      const styleBuilder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: "  ",
      });
      const styleXmlContent = styleBuilder.build(styleData);
      zip.addFile(
        "Settings0/Styles/style.xml",
        Buffer.from(styleXmlContent, "utf8"),
      );
    }

    // Collect grid file paths for FileMap.xml
    const gridFilePaths: string[] = [];

    // Create a grid for each page
    Object.values(tree.pages).forEach((page, index) => {
      const gridData = {
        "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
        Grid: {
          "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          GridGuid: page.id,
          Name: page.name || `Grid ${index + 1}`,
          BackgroundColour: page.style?.backgroundColor || "#E2EDF8FF",
          // Calculate grid dimensions based on actual layout
          ColumnDefinitions: this.calculateColumnDefinitions(page),
          RowDefinitions: this.calculateRowDefinitions(page),
          Cells:
            page.buttons.length > 0
              ? {
                  Cell: this.filterPageButtons(page.buttons).map(
                    (button, btnIndex) => {
                      const buttonStyleId = button.style
                        ? addStyle(button.style)
                        : "";

                      // Find button position in grid layout
                      const position = this.findButtonPosition(
                        page,
                        button,
                        btnIndex,
                      );

                      const cellData: any = {
                        "@_X": position.x,
                        "@_Y": position.y,
                        "@_ColumnSpan": position.columnSpan,
                        "@_RowSpan": position.rowSpan,
                        Content: {
                          Commands: this.generateCommandsFromSemanticAction(
                            button,
                            tree,
                          ),
                          CaptionAndImage: {
                            Caption: button.label || "",
                          },
                        },
                      };

                      // Add style reference if available
                      if (buttonStyleId) {
                        cellData.Content.Style = {
                          BasedOnStyle: buttonStyleId,
                        };
                      }

                      return cellData;
                    },
                  ),
                }
              : { Cell: [] },
        },
      };

      // Convert to XML
      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: "  ",
      });
      const xmlContent = builder.build(gridData);

      // Add to zip in Grids folder with proper Grid3 naming
      const gridPath = `Grids\\${page.name || page.id}\\grid.xml`;
      gridFilePaths.push(gridPath);
      zip.addFile(gridPath, Buffer.from(xmlContent, "utf8"));
    });

    // Create FileMap.xml to map all grid files
    const fileMapData = {
      "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
      FileMap: {
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        Entries: {
          Entry: gridFilePaths.map((gridPath) => ({
            "@_StaticFile": gridPath,
            DynamicFiles: {
              // Empty for now - could be extended for dynamic content
            },
          })),
        },
      },
    };

    const fileMapBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: "  ",
    });
    const fileMapXmlContent = fileMapBuilder.build(fileMapData);
    zip.addFile("FileMap.xml", Buffer.from(fileMapXmlContent, "utf8"));

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
  private calculateRowDefinitions(page: AACPage): { RowDefinition: any[] } {
    let maxRows = 4; // Default minimum

    if (page.grid && page.grid.length > 0) {
      maxRows = Math.max(maxRows, page.grid.length);
    } else {
      // Fallback: estimate from button count
      const estimatedCols = Math.ceil(Math.sqrt(page.buttons.length));
      maxRows = Math.max(4, Math.ceil(page.buttons.length / estimatedCols));
    }

    return {
      RowDefinition: Array(maxRows).fill({}),
    };
  }

  // Helper method to find button position with span information
  private findButtonPosition(
    page: AACPage,
    button: AACButton,
    fallbackIndex: number,
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
          if (page.grid[y][x] && page.grid[y][x]!.id === button.id) {
            // Calculate span by checking how far the same button extends
            let columnSpan = 1;
            let rowSpan = 1;

            // Check column span (rightward)
            while (
              x + columnSpan < page.grid[y].length &&
              page.grid[y][x + columnSpan] &&
              page.grid[y][x + columnSpan]!.id === button.id
            ) {
              columnSpan++;
            }

            // Check row span (downward)
            while (
              y + rowSpan < page.grid.length &&
              page.grid[y + rowSpan][x] &&
              page.grid[y + rowSpan][x]!.id === button.id
            ) {
              rowSpan++;
            }

            return { x, y, columnSpan, rowSpan };
          }
        }
      }
    }

    // Fallback positioning
    const gridCols =
      page.grid?.[0]?.length || Math.ceil(Math.sqrt(page.buttons.length));
    return {
      x: fallbackIndex % gridCols,
      y: Math.floor(fallbackIndex / gridCols),
      columnSpan: 1,
      rowSpan: 1,
    };
  }
}

export { GridsetProcessor };
