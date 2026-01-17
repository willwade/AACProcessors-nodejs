/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import JSZip from 'jszip';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { getFs, getNodeRequire, getPath } from '../utils/io';

let cachedXml2js: typeof import('xml2js') | null = null;
function getXml2js(): typeof import('xml2js') {
  if (cachedXml2js) return cachedXml2js;
  try {
    const nodeRequire = getNodeRequire();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = nodeRequire('xml2js') as typeof import('xml2js') & {
      default?: typeof import('xml2js');
    };
    const resolved = module.default || module;
    cachedXml2js = resolved;
    return resolved;
  } catch {
    throw new Error('Validator requires Xml2js in this environment.');
  }
}

/**
 * Validator for Grid3/Smartbox Gridset files (.gridset, .gridsetx)
 */
export class GridsetValidator extends BaseValidator {
  constructor() {
    super();
  }

  /**
   * Validate a Gridset file from disk
   */
  static async validateFile(filePath: string): Promise<ValidationResult> {
    const validator = new GridsetValidator();
    const fs = getFs();
    const path = getPath();
    const content = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    return validator.validate(content, path.basename(filePath), stats.size);
  }

  /**
   * Check if content is Gridset format
   */
  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.gridset') || name.endsWith('.gridsetx')) {
      return true;
    }

    // Try to parse as XML and check for gridset structure
    try {
      const contentStr = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
      const xml2js = getXml2js()
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(contentStr as string);
      return result && (result.gridset || result.Gridset);
    } catch {
      return false;
    }
  }

  /**
   * Main validation method
   */
  async validate(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number
  ): Promise<ValidationResult> {
    this.reset();

    const isEncrypted = filename.toLowerCase().endsWith('.gridsetx');

    // eslint-disable-next-line @typescript-eslint/require-await
    await this.add_check('filename', 'file extension', async () => {
      if (!filename.match(/\.gridsetx?$/)) {
        this.warn('filename should end with .gridset or .gridsetx');
      }
    });

    // For encrypted .gridsetx files, we can't validate the content
    if (isEncrypted) {
      // eslint-disable-next-line @typescript-eslint/require-await
      await this.add_check('encrypted_format', 'encrypted gridsetx file', async () => {
        this.warn('gridsetx files are encrypted and cannot be fully validated');
      });
      return this.buildResult(filename, filesize, 'gridset');
    }

    const isZip = this.isZip(content);

    if (isZip) {
      await this.validateZipArchive(content, filename, filesize);
    } else {
      await this.validateSingleXml(content, filename, filesize);
    }

    return this.buildResult(filename, filesize, 'gridset');
  }

  /**
   * Check if the buffer is a zip archive
   */
  private isZip(content: Buffer | Uint8Array): boolean {
    if (content.length < 4) return false;
    return content[0] === 0x50 && content[1] === 0x4b && content[2] === 0x03 && content[3] === 0x04;
  }

  /**
   * Validate a single XML file (legacy or exploded format)
   */
  private async validateSingleXml(
    content: Buffer | Uint8Array,
    filename: string,
    _filesize: number
  ): Promise<void> {
    let xmlObj: any = null;
    await this.add_check('xml_parse', 'valid XML', async () => {
      try {
        const xml2js = getXml2js()
        const parser = new xml2js.Parser();
        const contentStr = content.toString('utf-8');
        xmlObj = await parser.parseStringPromise(contentStr);
      } catch (e: any) {
        this.err(`Failed to parse XML: ${e.message}`, true);
      }
    });

    if (!xmlObj) return;

    await this.add_check('xml_structure', 'gridset root element', async () => {
      if (!xmlObj.gridset && !xmlObj.Gridset) {
        this.err('missing root gridset element', true);
      }
    });

    const gridset = xmlObj.gridset || xmlObj.Gridset;
    if (gridset) {
      await this.validateGridsetStructure(gridset, filename, content);
    }
  }

  /**
   * Validate a ZIP archive (.gridset)
   */
  private async validateZipArchive(
    content: Buffer | Uint8Array,
    filename: string,
    _filesize: number
  ): Promise<void> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(Buffer.from(content));
    } catch (e: any) {
      this.err(`Failed to open ZIP archive: ${e.message}`, true);
      return;
    }

    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    // Check for gridset.xml (required)
    await this.add_check('gridset_xml_presence', 'gridset.xml presence', async () => {
      const gridsetEntry = entries.find((e) => e.name.toLowerCase() === 'gridset.xml');
      if (!gridsetEntry) {
        this.err('Missing gridset.xml in archive', true);
      } else {
        try {
          const gridsetXml = await gridsetEntry.async('string');
          const xml2js = getXml2js()
          const parser = new xml2js.Parser();
          const xmlObj = await parser.parseStringPromise(gridsetXml);
          const gridset = xmlObj.gridset || xmlObj.Gridset;
          if (!gridset) {
            this.err('Invalid gridset.xml structure', true);
          } else {
            await this.validateGridsetStructure(gridset, filename, Buffer.from(gridsetXml));
          }
        } catch (e: any) {
          this.err(`Failed to parse gridset.xml: ${e.message}`, true);
        }
      }
    });

    // Check for settings.xml (highly recommended/required for metadata)
    await this.add_check('settings_xml_presence', 'settings.xml presence', async () => {
      const settingsEntry = entries.find((e) => e.name.toLowerCase() === 'settings.xml');
      if (!settingsEntry) {
        this.warn('Missing settings.xml in archive (required for full metadata)');
      } else {
        try {
          const settingsXml = await settingsEntry.async('string');
          const xml2js = getXml2js()
          const parser = new xml2js.Parser();
          const xmlObj = await parser.parseStringPromise(settingsXml);
          const settings =
            xmlObj.GridSetSettings || xmlObj.gridSetSettings || xmlObj.GridsetSettings;
          if (!settings) {
            this.warn('Invalid settings.xml structure');
          } else {
            // Basic validation of settings.xml
            if (!settings.StartGrid && !settings.startGrid) {
              this.warn('settings.xml missing StartGrid element');
            }
          }
        } catch (e: any) {
          this.warn(`Failed to parse settings.xml: ${e.message}`);
        }
      }
    });
  }

  /**
   * Validate Gridset structure
   */
  private async validateGridsetStructure(
    gridset: any,
    _filename: string,
    _content: Buffer | Uint8Array
  ): Promise<void> {
    // Check for required elements
    await this.add_check('gridset_id', 'gridset id', async () => {
      const id = gridset.$.id || gridset.$.Id;
      if (!id) {
        this.warn('gridset should have an id attribute');
      }
    });

    await this.add_check('gridset_name', 'gridset name', async () => {
      const name = gridset.$.name || gridset.$.Name || gridset.name?.[0];
      if (!name) {
        this.warn('gridset should have a name attribute or element');
      }
    });

    // Check for pages
    await this.add_check('pages', 'pages element', async () => {
      if (!gridset.pages && !gridset.Pages) {
        this.err('gridset must have a pages element');
      } else {
        const pages = gridset.pages || gridset.Pages;
        if (!pages[0] || !Array.isArray(pages[0].page)) {
          this.warn('pages should contain at least one page element');
        }
      }
    });

    // Validate individual pages
    const pages = gridset.pages?.[0] || gridset.Pages?.[0];
    if (pages && Array.isArray(pages.page)) {
      await this.add_check('page_count', 'page count', async () => {
        if (pages.page.length === 0) {
          this.err('gridset must contain at least one page');
        }
      });

      for (let i = 0; i < Math.min(pages.page.length, 10); i++) {
        // Limit to first 10 pages to avoid excessive validation
        const page = pages.page[i];
        await this.validatePage(page, i);
      }
    }

    // Check for fixedCellSize
    await this.add_check('fixed_cell_size', 'fixedCellSize element', async () => {
      const fixedSize = gridset.fixedCellSize || gridset.FixedCellSize;
      if (!fixedSize) {
        this.warn('gridset should have a fixedCellSize element for consistency');
      } else {
        // Validate fixedCellSize structure
        const size = fixedSize[0];
        if (size) {
          const width = size.$.width || size.$.Width;
          const height = size.$.height || size.$.Height;

          if (!width || !height) {
            this.warn('fixedCellSize should have both width and height attributes');
          } else if (isNaN(parseInt(width)) || isNaN(parseInt(height))) {
            this.err('fixedCellSize width and height must be valid numbers');
          }
        }
      }
    });

    // Check for styles
    await this.add_check('styles', 'styles element', async () => {
      const styles = gridset.styles || gridset.Styles;
      if (!styles) {
        this.warn('gridset should have a styles element for consistent formatting');
      }
    });
  }

  /**
   * Validate a single page
   */
  private async validatePage(page: any, index: number): Promise<void> {
    await this.add_check(`page[${index}]_id`, `page ${index} id`, async () => {
      const id = page.$.id || page.$.Id;
      if (!id) {
        this.err(`page at index ${index} is missing id attribute`);
      }
    });

    await this.add_check(`page[${index}]_name`, `page ${index} name`, async () => {
      const name = page.$.name || page.$.Name || page.name?.[0];
      if (!name) {
        this.warn(`page ${index} should have a name`);
      }
    });

    // Check for cells
    await this.add_check(`page[${index}]_cells`, `page ${index} cells`, async () => {
      const cells = page.cells || page.Cells;
      if (!cells) {
        this.warn(`page ${index} should have a cells element`);
      } else {
        const cellArray = cells[0]?.cell || cells[0]?.Cell;
        if (!cellArray || !Array.isArray(cellArray) || cellArray.length === 0) {
          this.warn(`page ${index} should contain at least one cell`);
        }
      }
    });

    // Validate cells if present
    const cells = page.cells?.[0] || page.Cells?.[0];
    if (cells) {
      const cellArray = cells.cell || cells.Cell;
      if (Array.isArray(cellArray) && cellArray.length > 0) {
        // Sample a few cells to validate
        const sampleSize = Math.min(cellArray.length, 5);
        for (let i = 0; i < sampleSize; i++) {
          await this.validateCell(cellArray[i], index, i);
        }
      }
    }
  }

  /**
   * Validate a single cell
   */
  private async validateCell(cell: any, pageIdx: number, cellIdx: number): Promise<void> {
    await this.add_check(`page[${pageIdx}]_cell[${cellIdx}]_id`, `cell id`, async () => {
      const id = cell.$.id || cell.$.Id;
      if (!id) {
        this.warn(`cell ${cellIdx} on page ${pageIdx} is missing id attribute`);
      }
    });

    await this.add_check(`page[${pageIdx}]_cell[${cellIdx}]_content`, `cell content`, async () => {
      const label = cell.$.label || cell.$.Label;
      const image = cell.$.image || cell.$.Image;

      if (!label && !image) {
        this.warn(`cell ${cellIdx} on page ${pageIdx} should have a label or image`);
      }
    });

    // Validate scan block number (Grid 3 attribute)
    await this.add_check(
      `page[${pageIdx}]_cell[${cellIdx}]_scanblock`,
      `cell scan block`,
      async () => {
        const scanBlock = cell.$.scanBlock || cell.$.ScanBlock;
        if (scanBlock !== undefined) {
          const blockNum = parseInt(scanBlock, 10);
          if (isNaN(blockNum) || blockNum < 1 || blockNum > 8) {
            this.err(
              `cell ${cellIdx} on page ${pageIdx} has invalid scanBlock value: ${scanBlock} (must be 1-8)`,
              false
            );
          }
        }
      }
    );

    // Check for color attributes
    const backgroundColor = cell.$.backgroundColor || cell.$.BackgroundColor;
    const _color = cell.$.color || cell.$.Color;

    if (backgroundColor) {
      await this.add_check(
        `page[${pageIdx}]_cell[${cellIdx}]_bg_color`,
        `cell background color`,
        async () => {
          // Grid3 colors can be in various formats: named colors, hex, ARGB
          // We just check it's not empty
          if (backgroundColor.length === 0) {
            this.warn(`cell ${cellIdx} has empty background color`);
          }
        }
      );
    }

    // Check for valid jump references
    const jump = cell.$.jump || cell.$.Jump;
    if (jump) {
      await this.add_check(
        `page[${pageIdx}]_cell[${cellIdx}]_jump`,
        `cell jump reference`,
        async () => {
          if (typeof jump !== 'string' || jump.length === 0) {
            this.warn(`cell ${cellIdx} has invalid jump reference`);
          }
        }
      );
    }
  }

  /**
   * Validate color format (Grid3 uses ARGB format)
   */
  private isValidGrid3Color(color: string): boolean {
    if (!color || color.length === 0) return false;

    // Named colors are valid
    if (/^[a-zA-Z]+$/.test(color)) return true;

    // ARGB format: #AARRGGBB or #RRGGBB
    if (color.startsWith('#')) {
      return color.length === 7 || color.length === 9;
    }

    // RGB format: rgb(r,g,b) or rgba(r,g,b,a)
    if (color.startsWith('rgb')) {
      return true; // Simplified check
    }

    return false;
  }
}
