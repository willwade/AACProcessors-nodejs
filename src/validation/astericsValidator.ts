/* eslint-disable @typescript-eslint/require-await */
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { decodeText, defaultFileAdapter, FileAdapter, getBasename, getFs, toUint8Array } from '../utils/io';

/**
 * Validator for Asterics Grid (.grd) JSON files
 */
export class AstericsGridValidator extends BaseValidator {
  /**
   * Validate from disk
   */
  static async validateFile(filePath: string, fileAdapter?: FileAdapter): Promise<ValidationResult> {
    const { readBinaryFromInput } = fileAdapter ?? defaultFileAdapter;
    const validator = new AstericsGridValidator();
    const content = readBinaryFromInput(filePath);
    const stats = getFs().statSync(filePath);
    return validator.validate(content, getBasename(filePath), stats.size);
  }

  /**
   * Identify whether the content appears to be an Asterics .grd file
   */
  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.grd')) {
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
      const json = JSON.parse(str);
      return Array.isArray(json?.grids);
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

    await this.add_check('filename', 'file extension', async () => {
      if (!filename.toLowerCase().endsWith('.grd')) {
        this.warn('filename should end with .grd');
      }
    });

    let json: any = null;
    await this.add_check('json_parse', 'valid JSON', async () => {
      try {
        let str = decodeText(content);
        if (str.charCodeAt(0) === 0xfeff) {
          str = str.slice(1);
        }
        json = JSON.parse(str);
      } catch (e: any) {
        this.err(`Failed to parse JSON: ${e.message}`, true);
      }
    });

    if (!json) {
      return this.buildResult(filename, filesize, 'asterics');
    }

    await this.add_check('grids', 'grids array', async () => {
      if (!Array.isArray(json.grids) || json.grids.length === 0) {
        this.err('missing grids array in file', true);
      }
    });

    const grids = Array.isArray(json.grids) ? json.grids.slice(0, 5) : [];

    grids.forEach((grid: any, idx: number) => {
      const prefix = `grid[${idx}]`;
      this.add_check_sync(`${prefix}_id`, `${prefix} id`, () => {
        if (!grid?.id || typeof grid.id !== 'string') {
          this.err('grid is missing an id');
        }
      });

      this.add_check_sync(`${prefix}_rows`, `${prefix} rowCount`, () => {
        if (typeof grid?.rowCount !== 'number' || grid.rowCount <= 0) {
          this.err('rowCount must be a positive number');
        }
      });

      this.add_check_sync(`${prefix}_elements`, `${prefix} elements`, () => {
        if (!Array.isArray(grid?.gridElements)) {
          this.err('gridElements must be an array');
          return;
        }
        if (grid.gridElements.length === 0) {
          this.warn('grid has no elements');
        }
      });
    });

    return this.buildResult(filename, filesize, 'asterics');
  }
}
