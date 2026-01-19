/* eslint-disable @typescript-eslint/require-await */
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { decodeText, getBasename, getFs, readBinaryFromInput, toUint8Array } from '../utils/io';

/**
 * Validator for OPML files
 */
export class OpmlValidator extends BaseValidator {
  static async validateFile(filePath: string): Promise<ValidationResult> {
    const validator = new OpmlValidator();
    const content = readBinaryFromInput(filePath);
    const stats = getFs().statSync(filePath);
    return validator.validate(content, getBasename(filePath), stats.size);
  }

  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.opml')) {
      return true;
    }

    try {
      if (
        typeof content !== 'string' &&
        !(content instanceof ArrayBuffer) &&
        !(content instanceof Uint8Array)
      ) {
        return false;
      }
      const str = typeof content === 'string' ? content : decodeText(toUint8Array(content));
      const validation = XMLValidator.validate(str);
      if (validation !== true) {
        return false;
      }
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(str);
      return Boolean(parsed?.opml?.body?.outline);
    } catch {
      return false;
    }
  }

  async validate(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number
  ): Promise<ValidationResult> {
    this.reset();
    const parser = new XMLParser({ ignoreAttributes: false });

    await this.add_check('filename', 'file extension', async () => {
      if (!filename.toLowerCase().endsWith('.opml')) {
        this.warn('filename should end with .opml');
      }
    });

    let text = '';
    await this.add_check('content', 'non-empty content', async () => {
      text = decodeText(content);
      if (!text.trim()) {
        this.err('OPML file is empty', true);
      }
    });

    await this.add_check('xml', 'valid XML', async () => {
      const validation = XMLValidator.validate(text);
      if (validation !== true) {
        const msg = String((validation as any)?.err?.msg || 'Invalid OPML XML');
        this.err(msg, true);
      }
    });

    let parsed: any = null;
    await this.add_check('structure', 'outline structure', async () => {
      parsed = parser.parse(text);
      if (!parsed?.opml?.body?.outline) {
        this.err('missing body.outline', true);
      }
    });

    if (parsed?.opml?.body?.outline) {
      const outlines = Array.isArray(parsed.opml.body.outline)
        ? parsed.opml.body.outline
        : [parsed.opml.body.outline];
      await this.add_check('outline_nodes', 'outline nodes', async () => {
        const hasText = outlines.some((node: any) => {
          const textValue =
            node?.['@_text'] || node?._attributes?.text || node?.text || node?.['@_title'];
          return typeof textValue === 'string' && textValue.trim().length > 0;
        });
        if (!hasText) {
          this.err('outline nodes missing text attributes');
        }
      });
    }

    return this.buildResult(filename, filesize, 'opml');
  }
}
