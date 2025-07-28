import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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

    const parser = new XMLParser();

    // First, load styles from style.xml if it exists
    const styles = new Map<string, any>();
    const styleEntry = zip.getEntries().find((entry) => entry.entryName.endsWith('style.xml'));
    if (styleEntry) {
      try {
        const styleXmlContent = styleEntry.getData().toString('utf8');
        const styleData = parser.parse(styleXmlContent);
        // Parse styles and store them in the map
        if (styleData.Styles?.Style) {
          const styleArray = Array.isArray(styleData.Styles.Style)
            ? styleData.Styles.Style
            : [styleData.Styles.Style];
          styleArray.forEach((style: any) => {
            if (style['@_ID']) {
              styles.set(style['@_ID'], style);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to parse style.xml:', e);
      }
    }

    // Debug: log all entry names
    // console.log('Gridset zip entries:', zip.getEntries().map(e => e.entryName));
    // Process each grid file in the gridset
    zip.getEntries().forEach((entry) => {
      // Only process files named grid.xml under Grids/ (any subdir)
      if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {
        let xmlContent: string;
        try {
          xmlContent = entry.getData().toString('utf8');
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
          if (typeof val === 'string') return val;
          if (typeof val === 'object' && '#text' in val) return val['#text'];
          return undefined;
        }
        const gridId = extractText(grid.GridGuid || grid.gridGuid || grid.id);
        let gridName =
          extractText(grid.Name) || extractText(grid.name) || extractText(grid['@_Name']);
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

        // Process buttons: <Cells><Cell>
        const cells = grid.Cells?.Cell || grid.cells?.cell;
        if (cells) {
          // Cells may be array or single object
          const cellArr = Array.isArray(cells) ? cells : [cells];
          cellArr.forEach((cell: any, idx: number) => {
            if (!cell || !cell.Content) return;

            // Extract label from CaptionAndImage/Caption
            const content = cell.Content;
            const captionAndImage = content.CaptionAndImage || content.captionAndImage;
            let label = captionAndImage?.Caption || captionAndImage?.caption || '';

            // If no caption, try other sources or create a placeholder
            if (!label) {
              // For cells without captions (like AutoContent cells), create a meaningful label
              if (content.ContentType === 'AutoContent') {
                label = `AutoContent_${idx}`;
              } else {
                return; // Skip cells without labels
              }
            }

            const message = label; // Use caption as message

            // Check for navigation commands
            let navigationTarget: string | undefined;
            const commands = content.Commands?.Command || content.commands?.command;
            if (commands) {
              const commandArr = Array.isArray(commands) ? commands : [commands];
              for (const command of commandArr) {
                if (command.ID === 'Jump.To' || command.id === 'Jump.To') {
                  const parameters = command.Parameter || command.parameter;
                  if (parameters) {
                    const paramArr = Array.isArray(parameters) ? parameters : [parameters];
                    for (const param of paramArr) {
                      if ((param.Key === 'grid' || param.key === 'grid') && param['#text']) {
                        navigationTarget = param['#text'];
                        break;
                      }
                    }
                  }
                  break;
                }
              }
            }

            // Get style information from cell attributes
            const cellStyleId = cell['@_StyleID'] || cell['@_styleid'];
            const cellStyle = this.getStyleById(styles, cellStyleId);

            // Also check for inline style overrides
            const inlineStyle: any = {};
            if (cell['@_BackColour']) inlineStyle.backgroundColor = cell['@_BackColour'];
            if (cell['@_FontColour']) inlineStyle.fontColor = cell['@_FontColour'];
            if (cell['@_BorderColour']) inlineStyle.borderColor = cell['@_BorderColour'];

            const button = new AACButton({
              id: `${gridId}_btn_${idx}`,
              label: String(label),
              message: String(message),
              type: navigationTarget ? 'NAVIGATE' : 'SPEAK',
              targetPageId: navigationTarget ? String(navigationTarget) : undefined,
              action: navigationTarget
                ? {
                    type: 'NAVIGATE',
                    targetPageId: String(navigationTarget),
                  }
                : null,
              style: {
                ...cellStyle,
                ...inlineStyle, // Inline styles override referenced styles
              },
            });
            page.addButton(button);
          });
        }

        tree.addPage(page);
      }
    });

    // After all pages are loaded, set parentId for navigation targets
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach((btn: AACButton) => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) {
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
    outputPath: string
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
      if (!style || Object.keys(style).length === 0) return '';

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

    // Create style.xml if there are styles
    if (uniqueStyles.size > 0) {
      const stylesArray = Array.from(uniqueStyles.values()).map(({ id, style }) => ({
        '@_ID': id,
        BackColour: style.backgroundColor,
        TileColour: style.backgroundColor,
        BorderColour: style.borderColor,
        FontColour: style.fontColor,
        FontName: style.fontFamily,
        FontSize: style.fontSize?.toString(),
      }));

      const styleData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        Styles: {
          Style: stylesArray,
        },
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: '  ',
      });
      const styleXmlContent = builder.build(styleData);
      zip.addFile('style.xml', Buffer.from(styleXmlContent, 'utf8'));
    }

    // Create a grid for each page
    Object.values(tree.pages).forEach((page, index) => {
      const gridData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        Grid: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          GridGuid: page.id,
          Name: page.name || `Grid ${index + 1}`,
          BackgroundColour: page.style?.backgroundColor,
          // Add basic row/column definitions (assume 4x4 grid)
          ColumnDefinitions: {
            ColumnDefinition: Array(4).fill({}),
          },
          RowDefinitions: {
            RowDefinition: Array(4).fill({}),
          },
          Cells:
            page.buttons.length > 0
              ? {
                  Cell: page.buttons.map((button, btnIndex) => {
                    const buttonStyleId = button.style ? addStyle(button.style) : '';
                    return {
                      '@_X': btnIndex % 4, // Column position
                      '@_Y': Math.floor(btnIndex / 4), // Row position
                      '@_StyleID': buttonStyleId,
                      Content: {
                        Commands:
                          button.type === 'NAVIGATE' && button.targetPageId
                            ? {
                                Command: {
                                  '@_ID': 'Jump.To',
                                  Parameter: {
                                    '@_Key': 'grid',
                                    '#text': button.targetPageId,
                                  },
                                },
                              }
                            : {
                                Command: {
                                  '@_ID': 'Action.InsertText',
                                  Parameter: {
                                    '@_Key': 'text',
                                    '#text': button.message || button.label || '',
                                  },
                                },
                              },
                        CaptionAndImage: {
                          Caption: button.label || '',
                        },
                      },
                    };
                  }),
                }
              : { Cell: [] },
        },
      };

      // Convert to XML
      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: '  ',
      });
      const xmlContent = builder.build(gridData);

      // Add to zip in Grids folder
      const gridPath = `Grids/Grid_${page.id}/grid.xml`;
      zip.addFile(gridPath, Buffer.from(xmlContent, 'utf8'));
    });

    // Write the zip file
    zip.writeZip(outputPath);
  }
}

export { GridsetProcessor };
