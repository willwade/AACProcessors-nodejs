import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import AdmZip from 'adm-zip';
import { XMLBuilder } from 'fast-xml-parser';

describe('GridsetProcessor Coverage Tests', () => {
  describe('Metadata Extraction', () => {
    it('should extract metadata from settings.xml', async () => {
      const zip = new AdmZip();

      // Create settings.xml with full metadata
      const settingsData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        GridSetSettings: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          Name: 'Test Gridset',
          Description: 'Test Description',
          Author: 'Test Author',
          PrimaryLanguage: 'en-US',
          StartGrid: 'home',
          KeyboardGrid: 'keyboard',
          DocumentationUrl: 'https://example.com/docs',
          DocumentationSlug: 'test-gridset',
          Thumbnail: '[grid3x]thumbnail.wmf',
          ThumbnailBackground: '#FF0000FF',
          PictureSearch: {
            PictureSearchKeys: {
              PictureSearchKey: ['widgit', 'sstix'],
            },
          },
          Appearance: {
            TextAtTop: '1',
            ComputerControlCellSize: '0.4',
          },
        },
      };

      const settingsBuilder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true,
      });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      // Create a minimal grid
      const gridData = {
        Grid: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          GridGuid: 'home-guid',
          Name: 'home',
          ColumnDefinitions: { ColumnDefinition: [{}, {}, {}] },
          RowDefinitions: { RowDefinition: [{}, {}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                Content: {
                  CaptionAndImage: {
                    Caption: 'Test',
                  },
                },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
      });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\home\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      expect(tree.metadata).toBeDefined();
      expect(tree.metadata.format).toBe('gridset');
      expect(tree.metadata.name).toBe('Test Gridset');
      expect(tree.metadata.description).toBe('Test Description');
      expect(tree.metadata.author).toBe('Test Author');
      expect(tree.metadata.locale).toBe('en-US');
      expect(tree.metadata.homepageUrl).toBe('https://example.com/docs');
      expect(tree.metadata.documentationUrl).toBe('https://example.com/docs');
      expect(tree.metadata.documentationSlug).toBe('test-gridset');
      expect(tree.metadata.pictureSearchKeys).toEqual(['widgit', 'sstix']);
      expect(tree.metadata.appearance).toBeDefined();
      expect(tree.metadata.appearance?.textAtTop).toBe(true);
      expect(tree.metadata.appearance?.computerControlCellSize).toBe(0.4);
      expect(tree.metadata.thumbnail).toBe('[grid3x]thumbnail.wmf');
      expect(tree.metadata.thumbnailBackground).toBe('#FF0000FF');
    });

    it('should handle missing optional metadata fields', async () => {
      const zip = new AdmZip();

      // Minimal settings.xml
      const settingsData = {
        GridSetSettings: {
          Name: 'Minimal Gridset',
        },
      };

      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      // Create a minimal grid
      const gridData = {
        Grid: {
          GridGuid: 'grid-guid',
          Name: 'grid1',
          ColumnDefinitions: { ColumnDefinition: [{}, {}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: { Cell: [] },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\grid1\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      expect(tree.metadata).toBeDefined();
      expect(tree.metadata.format).toBe('gridset');
      expect(tree.metadata.name).toBe('Minimal Gridset');
      // Optional fields should be undefined
      expect(tree.metadata.description).toBeUndefined();
      expect(tree.metadata.author).toBeUndefined();
    });
  });

  describe('Grid Cell Parsing', () => {
    it('should parse cell with all attributes', async () => {
      const zip = new AdmZip();

      const gridData = {
        Grid: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          GridGuid: 'test-guid',
          Name: 'test',
          ColumnDefinitions: { ColumnDefinition: [{}, {}, {}] },
          RowDefinitions: { RowDefinition: [{}, {}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                '@_ColumnSpan': 2,
                '@_RowSpan': 2,
                '@_ScanBlock': 3,
                '@_StyleID': 'style1',
                '@_BackColour': '#FF0000FF',
                '@_FontColour': '#000000FF',
                Visibility: 'Visible',
                Content: {
                  CaptionAndImage: {
                    Caption: 'Test Button',
                    Image: 'test.png',
                  },
                  ContentType: 'Normal',
                  Style: {
                    BasedOnStyle: 'style1',
                    FontName: 'Arial',
                    FontSize: '16',
                  },
                  Commands: {
                    Command: {
                      '@_ID': 'Action.InsertText',
                      Parameter: {
                        '@_Key': 'text',
                        '#text': 'Hello',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\test\\grid.xml', Buffer.from(gridXml, 'utf8'));

      // Add minimal settings
      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      expect(tree.pages).toBeDefined();
      const pageIds = Object.keys(tree.pages);
      expect(pageIds.length).toBe(1);
      const page = tree.pages[pageIds[0]];
      expect(page.buttons.length).toBe(1);

      const button = page.buttons[0];
      expect(button).toBeDefined();
      expect(button.label).toBe('Test Button');
      expect(button.x).toBe(1); // Grid 3 XML coordinates are already 0-based
      expect(button.y).toBe(1);
      expect(button.columnSpan).toBe(2);
      expect(button.rowSpan).toBe(2);
      expect(button.scanBlock).toBe(3);
      expect(button.visibility).toBe('Visible');
      expect(button.style?.backgroundColor).toBe('#FF0000FF');
      expect(button.style?.fontColor).toBe('#000000FF');
      expect(button.style?.fontFamily).toBe('Arial');
      expect(button.style?.fontSize).toBe(16);
      expect(button.image).toBe('test.png');
    });

    it('should parse cell with prediction wordlist', async () => {
      const zip = new AdmZip();

      const gridData = {
        Grid: {
          GridGuid: 'test-guid',
          Name: 'test',
          ColumnDefinitions: { ColumnDefinition: [{}, {}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                Content: {
                  CaptionAndImage: { Caption: 'Predict' },
                  Commands: {
                    Command: {
                      '@_ID': 'Prediction.PredictThis',
                      Parameter: [
                        {
                          '@_Key': 'wordlist',
                          WordList: {
                            Items: {
                              WordListItem: [
                                { Text: 'word1' },
                                { Text: 'word2' },
                                { Text: 'word3' },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\test\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      expect(tree.pages).toBeDefined();
      const page = Object.values(tree.pages)[0];
      // Should have 1 button plus virtual buttons for predicted words
      expect(page.buttons.length).toBeGreaterThanOrEqual(1);
      const button = page.buttons[0];
      expect(button.label).toBe('Predict');
      expect(button.semanticAction).toBeDefined();
      expect(button.semanticAction?.platformData?.grid3?.parameters?.wordlist).toEqual([
        'word1',
        'word2',
        'word3',
      ]);
    });

    it('should parse navigation commands', async () => {
      const zip = new AdmZip();

      const gridData = {
        Grid: {
          GridGuid: 'home-guid',
          Name: 'home',
          ColumnDefinitions: { ColumnDefinition: [{}, {}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                Content: {
                  CaptionAndImage: { Caption: 'Go to page' },
                  Commands: {
                    Command: {
                      '@_ID': 'Jump.To',
                      Parameter: {
                        '@_Key': 'grid',
                        '#text': 'other',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\home\\grid.xml', Buffer.from(gridXml, 'utf8'));

      // Add target page
      const targetGridData = {
        Grid: {
          GridGuid: 'other-guid',
          Name: 'other',
          ColumnDefinitions: { ColumnDefinition: [{}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: { Cell: [] },
        },
      };
      const targetGridXml = gridBuilder.build(targetGridData);
      zip.addFile('Grids\\other\\grid.xml', Buffer.from(targetGridXml, 'utf8'));

      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      const homePage = tree.pages['home-guid'];
      expect(homePage).toBeDefined();
      const navButton = homePage.buttons[0];
      expect(navButton.targetPageId).toBe('other-guid');

      const otherPage = tree.pages['other-guid'];
      expect(otherPage.parentId).toBe('home-guid');
    });

    it('should handle different visibility values', async () => {
      const zip = new AdmZip();

      const gridData = {
        Grid: {
          GridGuid: 'test-guid',
          Name: 'test',
          ColumnDefinitions: { ColumnDefinition: [{}, {}, {}, {}, {}] },
          RowDefinitions: { RowDefinition: [{}, {}, {}, {}, {}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                Visibility: 'Hidden',
                Content: { CaptionAndImage: { Caption: 'Hidden' } },
              },
              {
                '@_X': 2,
                '@_Y': 1,
                Visibility: 'Disabled',
                Content: { CaptionAndImage: { Caption: 'Disabled' } },
              },
              {
                '@_X': 3,
                '@_Y': 1,
                Visibility: 'PointerAndTouchOnly',
                Content: { CaptionAndImage: { Caption: 'TouchOnly' } },
              },
              {
                '@_X': 4,
                '@_Y': 1,
                Visibility: 'TouchOnly',
                Content: { CaptionAndImage: { Caption: 'RealTouchOnly' } },
              },
              {
                '@_X': 5,
                '@_Y': 1,
                Visibility: 'PointerOnly',
                Content: { CaptionAndImage: { Caption: 'PointerOnly' } },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\test\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      const page = Object.values(tree.pages)[0];
      expect(page.buttons.length).toBe(5);

      expect(page.buttons[0].visibility).toBe('Hidden');
      expect(page.buttons[1].visibility).toBe('Disabled');
      expect(page.buttons[2].visibility).toBe('PointerAndTouchOnly');
      expect(page.buttons[3].visibility).toBe('PointerAndTouchOnly'); // TouchOnly maps to this
      expect(page.buttons[4].visibility).toBe('PointerAndTouchOnly'); // PointerOnly maps to this
    });
  });

  describe('FileMap Support', () => {
    it('should parse FileMap.xml', async () => {
      const zip = new AdmZip();

      const fileMapData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        FileMap: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          Entries: {
            Entry: [
              {
                '@_StaticFile': 'Grids\\page1\\grid.xml',
                DynamicFiles: {
                  File: ['Grids\\page1\\1-1-0-text-0.png', 'Grids\\page1\\1-2-0-text-0.png'],
                },
              },
            ],
          },
        },
      };

      const fileMapBuilder = new XMLBuilder({ ignoreAttributes: false });
      const fileMapXml = fileMapBuilder.build(fileMapData);
      zip.addFile('FileMap.xml', Buffer.from(fileMapXml, 'utf8'));

      // Add minimal grid
      const gridData = {
        Grid: {
          GridGuid: 'page1-guid',
          Name: 'page1',
          ColumnDefinitions: { ColumnDefinition: [{}, {}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: { Cell: [] },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\page1\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      // Should not throw - FileMap should be parsed
      expect(tree).toBeDefined();
      expect(tree.pages).toBeDefined();
    });
  });

  describe('Styles Support', () => {
    it('should parse styles.xml', async () => {
      const zip = new AdmZip();

      const stylesData = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        StyleData: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          Styles: {
            Style: [
              {
                '@_Key': 'style1',
                BackColour: '#FF0000FF',
                BorderColour: '#000000FF',
                FontColour: '#FFFFFFFF',
                FontName: 'Arial',
                FontSize: '16',
              },
              {
                '@_Key': 'style2',
                BackColour: '#00FF00FF',
                FontColour: '#000000FF',
              },
            ],
          },
        },
      };

      const stylesBuilder = new XMLBuilder({ ignoreAttributes: false });
      const stylesXml = stylesBuilder.build(stylesData);
      zip.addFile('Settings0/Styles/styles.xml', Buffer.from(stylesXml, 'utf8'));

      // Add grid with styled cell
      const gridData = {
        Grid: {
          GridGuid: 'test-guid',
          Name: 'test',
          ColumnDefinitions: { ColumnDefinition: [{}] },
          RowDefinitions: { RowDefinition: [{}] },
          Cells: {
            Cell: [
              {
                '@_X': 1,
                '@_Y': 1,
                '@_StyleID': 'style1',
                Content: { CaptionAndImage: { Caption: 'Styled' } },
              },
            ],
          },
        },
      };

      const gridBuilder = new XMLBuilder({ ignoreAttributes: false });
      const gridXml = gridBuilder.build(gridData);
      zip.addFile('Grids\\test\\grid.xml', Buffer.from(gridXml, 'utf8'));

      const settingsData = { GridSetSettings: { Name: 'Test' } };
      const settingsBuilder = new XMLBuilder({ ignoreAttributes: false });
      const settingsXml = settingsBuilder.build(settingsData);
      zip.addFile('Settings0/settings.xml', Buffer.from(settingsXml, 'utf8'));

      const buffer = zip.toBuffer();

      const processor = new GridsetProcessor();
      const tree = await processor.loadIntoTree(buffer);

      const page = Object.values(tree.pages)[0];
      const button = page.buttons[0];
      expect(button.style?.backgroundColor).toBe('#FF0000FF');
      expect(button.style?.borderColor).toBe('#000000FF');
      expect(button.style?.fontColor).toBe('#FFFFFFFF');
      expect(button.style?.fontFamily).toBe('Arial');
      expect(button.style?.fontSize).toBe(16);
    });
  });
});
