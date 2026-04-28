/* eslint-disable @typescript-eslint/require-await */
import plist from 'plist';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import {
  decodeText,
  defaultFileAdapter,
  FileAdapter,
  getBasename,
  toUint8Array,
} from '../utils/io';

type PanelsContainer = { panels?: any; Panels?: Record<string, any> };

/**
 * Validator for Apple Panels (.plist or .ascconfig directory)
 */
export class ApplePanelsValidator extends BaseValidator {
  static async validateFile(
    filePath: string,
    fileAdapter: FileAdapter = defaultFileAdapter
  ): Promise<ValidationResult> {
    const { pathExists, isDirectory, getFileSize, readBinaryFromInput, join } = fileAdapter;
    const validator = new ApplePanelsValidator();
    let content: Uint8Array;
    const filename = getBasename(filePath);
    let size = 0;
    const isDir = await isDirectory(filePath);

    if (isDir && filename.toLowerCase().endsWith('.ascconfig')) {
      const panelPath = join(filePath, 'Contents', 'Resources', 'PanelDefinitions.plist');
      if (!(await pathExists(panelPath))) {
        return validator.validate(Buffer.alloc(0), filename, 0);
      }
      content = await readBinaryFromInput(panelPath);
      size = await getFileSize(panelPath);
    } else {
      content = await readBinaryFromInput(filePath);
      size = (await getFileSize(filePath)) || content.byteLength;
    }

    return validator.validate(content, filename, size);
  }

  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.plist') || name.endsWith('.ascconfig')) {
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
      const parsed = plist.parse(str) as PanelsContainer;
      return Boolean(parsed.panels || parsed.Panels);
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
      if (!filename.toLowerCase().match(/\.(plist|ascconfig)$/)) {
        this.warn('filename should end with .plist or .ascconfig');
      }
    });

    let parsed: PanelsContainer | null = null;
    await this.add_check('plist_parse', 'valid plist/XML', async () => {
      try {
        const str = decodeText(content);
        parsed = plist.parse(str) as PanelsContainer;
      } catch (e: any) {
        this.err(`Failed to parse plist: ${e.message}`, true);
      }
    });

    if (!parsed) {
      return this.buildResult(filename, filesize, 'applepanels');
    }

    let panels: any[] = [];
    await this.add_check('panels', 'panels present', async () => {
      if (Array.isArray(parsed?.panels)) {
        panels = parsed?.panels;
      } else if (parsed?.Panels && typeof parsed.Panels === 'object') {
        panels = Object.values(parsed.Panels);
      } else {
        this.err('missing panels/PanelDefinitions content', true);
      }
    });

    panels.slice(0, 5).forEach((panel: any, idx: number) => {
      const prefix = `panel[${idx}]`;
      this.add_check_sync(`${prefix}_id`, `${prefix} id`, () => {
        if (!panel?.ID && !panel?.id) {
          this.err('panel missing ID');
        }
      });

      this.add_check_sync(`${prefix}_buttons`, `${prefix} buttons`, () => {
        const buttons = Array.isArray(panel?.PanelObjects)
          ? panel.PanelObjects.filter((obj: any) => obj?.PanelObjectType === 'Button')
          : [];
        if (buttons.length === 0) {
          this.warn('panel has no buttons');
        }
      });
    });

    return this.buildResult(filename, filesize, 'applepanels');
  }
}
