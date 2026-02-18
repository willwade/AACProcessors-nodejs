/* eslint-disable @typescript-eslint/require-await */
import * as ExcelJS from 'exceljs';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { defaultFileAdapter, FileAdapter, getBasename, toArrayBuffer } from '../utils/io';

/**
 * Validator for Excel imports (.xlsx/.xls)
 */
export class ExcelValidator extends BaseValidator {
  static async validateFile(
    filePath: string,
    fileAdapter?: FileAdapter
  ): Promise<ValidationResult> {
    const { readBinaryFromInput, getFileSize } = fileAdapter ?? defaultFileAdapter;
    const validator = new ExcelValidator();
    const content = readBinaryFromInput(filePath);
    const size = getFileSize(filePath);
    return validator.validate(content, getBasename(filePath), size);
  }

  static async identifyFormat(_content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.xls');
  }

  async validate(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number
  ): Promise<ValidationResult> {
    this.reset();

    const ext = filename.toLowerCase().split('.').pop() || '';

    await this.add_check('filename', 'file extension', async () => {
      if (!['xlsx', 'xls'].includes(ext)) {
        this.warn('filename should end with .xlsx or .xls');
      }
    });

    if (ext === 'xls') {
      // exceljs cannot parse legacy .xls files
      await this.add_check('xls_support', 'legacy Excel format', async () => {
        this.err('legacy .xls files are not supported; please provide .xlsx', true);
      });
      return this.buildResult(filename, filesize, 'excel');
    }

    const buffer =
      typeof Buffer !== 'undefined' && Buffer.isBuffer(content) ? content : toArrayBuffer(content);
    const workbook = new ExcelJS.Workbook();

    await this.add_check('open', 'open workbook', async () => {
      try {
        await workbook.xlsx.load(buffer);
      } catch (e: any) {
        this.err(`Failed to read Excel workbook: ${e.message}`, true);
      }
    });

    await this.add_check('worksheets', 'worksheets exist', async () => {
      if (workbook.worksheets.length === 0) {
        this.err('Excel workbook has no worksheets', true);
      }
    });

    const firstSheet = workbook.worksheets[0];
    if (firstSheet) {
      await this.add_check('content', 'worksheet has content', async () => {
        const rows = firstSheet.actualRowCount || firstSheet.rowCount;
        const cols = firstSheet.columnCount;
        if (!rows || !cols) {
          this.err('first worksheet is empty', true);
        }
      });
    }

    return this.buildResult(filename, filesize, 'excel');
  }
}
