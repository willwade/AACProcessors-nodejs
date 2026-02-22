/* eslint-disable @typescript-eslint/require-await */
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import {
  decodeText,
  defaultFileAdapter,
  FileAdapter,
  getBasename,
  toUint8Array,
} from '../utils/io';

/**
 * Validator for OBF set bundles (.obfset) - JSON arrays of boards
 */
export class ObfsetValidator extends BaseValidator {
  static async validateFile(
    filePath: string,
    fileAdapter?: FileAdapter
  ): Promise<ValidationResult> {
    const { readBinaryFromInput, getFileSize } = fileAdapter ?? defaultFileAdapter;
    const validator = new ObfsetValidator();
    const content = await readBinaryFromInput(filePath);
    const size = await getFileSize(filePath);
    return validator.validate(content, getBasename(filePath), size);
  }

  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.obfset')) return true;

    try {
      if (
        typeof content !== 'string' &&
        !(content instanceof ArrayBuffer) &&
        !(content instanceof Uint8Array)
      ) {
        return false;
      }
      const str = typeof content === 'string' ? content : decodeText(toUint8Array(content));
      const parsed = JSON.parse(str);
      return Array.isArray(parsed);
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
      if (!filename.toLowerCase().endsWith('.obfset')) {
        this.warn('filename should end with .obfset');
      }
    });

    let boards: any[] | null = null;
    await this.add_check('json_parse', 'valid JSON array', async () => {
      try {
        const str = decodeText(content);
        const parsed = JSON.parse(str);
        if (!Array.isArray(parsed)) {
          this.err('root must be a JSON array of boards', true);
        } else {
          boards = parsed;
        }
      } catch (e: any) {
        this.err(`Failed to parse JSON: ${e.message}`, true);
      }
    });

    if (!boards) {
      return this.buildResult(filename, filesize, 'obfset');
    }

    const safeBoards = boards as any[];
    safeBoards.slice(0, 5).forEach((board, idx) => {
      const prefix = `board[${idx}]`;
      this.add_check_sync(`${prefix}_id`, `${prefix} id`, () => {
        if (!board?.id) {
          this.err('board is missing id');
        }
      });
      this.add_check_sync(`${prefix}_buttons`, `${prefix} buttons`, () => {
        if (!Array.isArray(board?.buttons)) {
          this.warn('board has no buttons array');
        }
      });
      this.add_check_sync(`${prefix}_grid`, `${prefix} grid definition`, () => {
        const grid = board?.grid;
        if (!grid || typeof grid.rows !== 'number' || typeof grid.columns !== 'number') {
          this.warn('grid rows/columns missing; layout may be invalid');
        }
      });
    });

    return this.buildResult(filename, filesize, 'obfset');
  }
}
