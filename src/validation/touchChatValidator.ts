/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as xml2js from 'xml2js';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { decodeText, getBasename, getFs, readBinaryFromInput, toUint8Array } from '../utils/io';

/**
 * Validator for TouchChat files (.ce)
 * TouchChat files are XML-based
 */
export class TouchChatValidator extends BaseValidator {
  constructor() {
    super();
  }

  /**
   * Validate a TouchChat file from disk
   */
  static async validateFile(filePath: string): Promise<ValidationResult> {
    const validator = new TouchChatValidator();
    const content = readBinaryFromInput(filePath);
    const stats = getFs().statSync(filePath);
    return validator.validate(content, getBasename(filePath), stats.size);
  }

  /**
   * Check if content is TouchChat format
   */
  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.ce')) {
      return true;
    }

    // Try to parse as XML and check for TouchChat structure
    try {
      const contentStr = typeof content === 'string' ? content : decodeText(toUint8Array(content));
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(contentStr);
      // TouchChat files typically have specific structure
      return result && (result.PageSet || result.Pageset || result.page || result.Page);
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

    await this.add_check('filename', 'file extension', async () => {
      if (!filename.match(/\.ce$/i)) {
        this.warn('filename should end with .ce');
      }
    });

    let xmlObj: any = null;
    await this.add_check('xml_parse', 'valid XML', async () => {
      try {
        const parser = new xml2js.Parser();
        const contentStr = decodeText(content);
        xmlObj = await parser.parseStringPromise(contentStr);
      } catch (e: any) {
        this.err(`Failed to parse XML: ${e.message}`, true);
      }
    });

    if (!xmlObj) {
      return this.buildResult(filename, filesize, 'touchchat');
    }

    await this.add_check('xml_structure', 'TouchChat root element', async () => {
      // TouchChat can have different root elements
      const hasValidRoot =
        xmlObj.PageSet ||
        xmlObj.Pageset ||
        xmlObj.page ||
        xmlObj.Page ||
        xmlObj.pages ||
        xmlObj.Pages;

      if (!hasValidRoot) {
        this.err('file does not contain a recognized TouchChat structure');
      }
    });

    const root =
      xmlObj.PageSet ||
      xmlObj.Pageset ||
      xmlObj.page ||
      xmlObj.Page ||
      xmlObj.pages ||
      xmlObj.Pages;
    if (root) {
      await this.validateTouchChatStructure(root);
    }

    return this.buildResult(filename, filesize, 'touchchat');
  }

  /**
   * Validate TouchChat structure
   */
  private async validateTouchChatStructure(root: any): Promise<void> {
    // Check for ID
    await this.add_check('root_id', 'root element ID', async () => {
      const id = root.$?.id || root.$?.Id;
      if (!id) {
        this.warn('root element should have an id attribute');
      }
    });

    // Check for name
    await this.add_check('root_name', 'root element name', async () => {
      const name = root.$?.name || root.$?.Name || root.name?.[0];
      if (!name) {
        this.warn('root element should have a name');
      }
    });

    // Check for pages
    await this.add_check('pages', 'pages collection', async () => {
      const pages = root.page || root.Page || root.pages || root.Pages;
      if (!pages) {
        this.err('TouchChat file must contain pages');
      } else if (!Array.isArray(pages) || pages.length === 0) {
        this.err('TouchChat file must contain at least one page');
      }
    });

    // Validate individual pages
    const pages = root.page || root.Page || root.pages || root.Pages;
    if (pages && Array.isArray(pages)) {
      await this.add_check('page_count', 'page count', async () => {
        if (pages.length === 0) {
          this.err('Must contain at least one page');
        }
      });

      // Sample first few pages
      const sampleSize = Math.min(pages.length, 5);
      for (let i = 0; i < sampleSize; i++) {
        await this.validatePage(pages[i], i);
      }
    }
  }

  /**
   * Validate a single page
   */
  private async validatePage(page: any, index: number): Promise<void> {
    await this.add_check(`page[${index}]_id`, `page ${index} ID`, async () => {
      const id = page.$?.id || page.$?.Id;
      if (!id) {
        this.warn(`page ${index} is missing an id attribute`);
      }
    });

    await this.add_check(`page[${index}]_name`, `page ${index} name`, async () => {
      const name = page.$?.name || page.$?.Name || page.name?.[0];
      if (!name) {
        this.warn(`page ${index} should have a name`);
      }
    });

    // Check for buttons/items
    await this.add_check(`page[${index}]_buttons`, `page ${index} buttons`, async () => {
      const buttons = page.button || page.Button || page.item || page.Item;
      if (!buttons) {
        this.warn(`page ${index} has no buttons/items`);
      } else if (Array.isArray(buttons) && buttons.length === 0) {
        this.warn(`page ${index} should contain at least one button`);
      }
    });

    // Validate button references
    const buttons = page.button || page.Button || page.item || page.Item;
    if (buttons && Array.isArray(buttons)) {
      const sampleSize = Math.min(buttons.length, 3);
      for (let i = 0; i < sampleSize; i++) {
        await this.validateButton(buttons[i], index, i);
      }
    }
  }

  /**
   * Validate a single button
   */
  private async validateButton(button: any, pageIdx: number, buttonIdx: number): Promise<void> {
    await this.add_check(
      `page[${pageIdx}]_button[${buttonIdx}]_label`,
      `button label`,
      async () => {
        const label = button.$?.label || button.$?.Label || button.label?.[0];
        if (!label) {
          this.warn(`button ${buttonIdx} on page ${pageIdx} should have a label`);
        }
      }
    );

    await this.add_check(
      `page[${pageIdx}]_button[${buttonIdx}]_vocalization`,
      `button vocalization`,
      async () => {
        const vocalization =
          button.$?.vocalization || button.$?.Vocalization || button.vocalization?.[0];
        if (!vocalization) {
          // Vocalization is optional, so just info
        }
      }
    );

    // Check for image reference
    await this.add_check(
      `page[${pageIdx}]_button[${buttonIdx}]_image`,
      `button image`,
      async () => {
        const image = button.$?.image || button.$?.Image || button.img?.[0];
        if (!image) {
          this.warn(`button ${buttonIdx} on page ${pageIdx} should have an image reference`);
        }
      }
    );

    // Check for link/action
    await this.add_check(
      `page[${pageIdx}]_button[${buttonIdx}]_action`,
      `button action`,
      async () => {
        const link = button.$?.link || button.$?.Link;
        const action = button.$?.action || button.$?.Action;
        if (!link && !action) {
          // Not all buttons need actions, they can just speak
        }
      }
    );
  }
}
