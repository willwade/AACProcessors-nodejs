/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import JSZip from 'jszip';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import {
  decodeText,
  defaultFileAdapter,
  FileAdapter,
  getBasename,
  toUint8Array,
} from '../utils/io';

const OBF_FORMAT = 'open-board-0.1';
const OBF_FORMAT_CURRENT_VERSION = 0.1;

/**
 * Validator for Open Board Format (OBF/OBZ) files
 */
export class ObfValidator extends BaseValidator {
  constructor() {
    super();
  }

  /**
   * Validate an OBF file from disk
   */
  static async validateFile(
    filePath: string,
    fileAdapter?: FileAdapter
  ): Promise<ValidationResult> {
    const { readBinaryFromInput, getFileSize } = fileAdapter ?? defaultFileAdapter;
    const validator = new ObfValidator();
    const content = readBinaryFromInput(filePath);
    const size = getFileSize(filePath);
    return validator.validate(content, getBasename(filePath), size);
  }

  /**
   * Check if content is OBF format
   */
  static async identifyFormat(content: any, filename: string): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith('.obf') || name.endsWith('.obz')) {
      return true;
    }

    // Try to parse as JSON and check format
    try {
      if (
        typeof content !== 'string' &&
        !(content instanceof ArrayBuffer) &&
        !(content instanceof Uint8Array)
      ) {
        return false;
      }
      const contentStr = typeof content === 'string' ? content : decodeText(toUint8Array(content));
      const json = JSON.parse(contentStr);
      return json && json.format && json.format.startsWith('open-board-');
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

    // Determine if it's OBF or OBZ
    const isObz = filename.toLowerCase().endsWith('.obz');

    if (isObz) {
      return await this.validateObz(content, filename, filesize);
    } else {
      return await this.validateObf(content, filename, filesize);
    }
  }

  /**
   * Validate OBF content
   */
  private async validateObf(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number
  ): Promise<ValidationResult> {
    await this.add_check('filename', 'file name', async () => {
      if (!filename.match(/\.obf$/)) {
        this.warn('filename should end with .obf');
      }
    });

    let json: any = null;
    await this.add_check('valid_json', 'JSON file', async () => {
      try {
        json = JSON.parse(decodeText(content));
      } catch {
        this.err("Couldn't parse as JSON", true);
      }
    });

    if (!json) {
      return this.buildResult(filename, filesize, 'obf');
    }

    await this.validateBoardStructure(json);

    return this.buildResult(filename, filesize, 'obf');
  }

  /**
   * Validate OBZ (zip) content
   */
  private async validateObz(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number
  ): Promise<ValidationResult> {
    await this.add_check('filename', 'file name', async () => {
      if (!filename.match(/\.obz$/)) {
        this.warn('filename should end with .obz');
      }
    });

    let zip: JSZip | null = null;
    let validZip = false;

    await this.add_check('zip', 'valid zip', async () => {
      try {
        zip = await JSZip.loadAsync(content);
        validZip = true;
      } catch {
        this.err('file is not a valid zip package');
      }
    });

    if (validZip && zip) {
      await this.validateObzStructure(zip);
    }

    return this.buildResult(filename, filesize, 'obz');
  }

  /**
   * Validate OBF board structure
   */
  private async validateBoardStructure(board: any): Promise<void> {
    await this.add_check('format_version', 'format version', async () => {
      if (!board.format) {
        this.err(`format attribute is required, set to ${OBF_FORMAT}`);
        return;
      }
      const version = parseFloat(board.format.split('-').pop() || '0');
      if (version > OBF_FORMAT_CURRENT_VERSION) {
        this.err(
          `format version (${version}) is invalid, current version is ${OBF_FORMAT_CURRENT_VERSION}`
        );
      } else if (version < OBF_FORMAT_CURRENT_VERSION) {
        this.warn(
          `format version (${version}) is old, consider updating to ${OBF_FORMAT_CURRENT_VERSION}`
        );
      }
    });

    await this.add_check('id', 'board ID', async () => {
      if (!board.id) {
        this.err('id attribute is required');
      }
    });

    await this.add_check('locale', 'locale', async () => {
      if (!board.locale) {
        this.err('locale attribute is required, please set to "en" for English');
      }
    });

    await this.add_check('extras', 'extra attributes', async () => {
      const attrs = [
        'format',
        'id',
        'locale',
        'url',
        'data_url',
        'name',
        'description_html',
        'default_layout',
        'buttons',
        'images',
        'sounds',
        'grid',
        'license',
      ];
      Object.keys(board).forEach((key) => {
        if (!attrs.includes(key) && !key.startsWith('ext_')) {
          this.warn(
            `${key} attribute is not defined in the spec, should be prefixed with ext_yourapp_`
          );
        }
      });
    });

    await this.add_check('description', 'descriptive attributes', async () => {
      if (!board.name) {
        this.warn('name attribute is strongly recommended');
      }
      if (!board.description_html) {
        this.warn('description_html attribute is recommended');
      }
    });

    await this.add_check('background', 'background attribute', async () => {
      if (board.background && typeof board.background !== 'object') {
        this.err('background attribute must be a hash');
      }
    });

    await this.add_check('buttons', 'buttons attribute', async () => {
      if (!board.buttons) {
        this.err('buttons attribute is required');
      } else if (!Array.isArray(board.buttons)) {
        this.err('buttons attribute must be an array');
      }
    });

    await this.add_check('grid', 'grid attribute', async () => {
      if (!board.grid) {
        this.err('grid attribute is required');
        return;
      }
      if (typeof board.grid !== 'object') {
        this.err('grid attribute must be a hash');
        return;
      }
      if (typeof board.grid.rows !== 'number' || board.grid.rows < 1) {
        this.err('grid.rows must be a positive number');
      }
      if (typeof board.grid.columns !== 'number' || board.grid.columns < 1) {
        this.err('grid.columns must be a positive number');
      }
      if (!board.grid.order || !Array.isArray(board.grid.order)) {
        this.err('grid.order must be an array of arrays');
        return;
      }
      if (board.grid.order.length !== board.grid.rows) {
        this.err(
          `grid.order length (${board.grid.order.length}) must match grid.rows (${board.grid.rows})`
        );
      }
      if (
        !board.grid.order.every((r: any) => Array.isArray(r) && r.length === board.grid.columns)
      ) {
        this.err(
          `grid.order must contain ${board.grid.rows} arrays each of size ${board.grid.columns}`
        );
      }
    });

    await this.add_check('grid_ids', 'button IDs in grid.order attribute', async () => {
      const buttonIds = (board.buttons || []).map((b: any) => b.id);
      const usedButtonIds: string[] = [];
      if (board.grid && board.grid.order) {
        board.grid.order.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((id: any) => {
              if (id !== null && id !== undefined) {
                usedButtonIds.push(id);
                if (!buttonIds.includes(id)) {
                  this.err(
                    `grid.order references button with id ${id} but no button with that id found in buttons attribute`
                  );
                }
              }
            });
          }
        });
      }
      if (usedButtonIds.length === 0) {
        this.warn('board has no buttons defined in the grid');
      }

      const unusedIds = buttonIds.filter((id: any) => !usedButtonIds.includes(id));
      if (unusedIds.length > 0) {
        this.warn(
          `not all defined buttons were included in the grid order (${unusedIds.join(',')})`
        );
      }
    });

    await this.add_check('images', 'images attribute', async () => {
      if (!board.images) {
        this.err('images attribute is required');
      } else if (!Array.isArray(board.images)) {
        this.err('images attribute must be an array');
      }
    });

    if (Array.isArray(board.images)) {
      for (let i = 0; i < board.images.length; i++) {
        const image = board.images[i];
        await this.add_check(`image[${i}]`, `image at images[${i}]`, async () => {
          if (typeof image !== 'object') {
            this.err('image must be a hash');
            return;
          }
          if (!image.id) {
            this.err('image.id is required');
          }
          if (!image.width || typeof image.width !== 'number' || image.width < 1) {
            this.warn('image.width should be a valid positive number');
          }
          if (!image.height || typeof image.height !== 'number' || image.height < 1) {
            this.warn('image.height should be a valid positive number');
          }
          if (!image.content_type || !image.content_type.match(/^image\/.+$/)) {
            this.err('image.content_type must be a valid image mime type');
          }
          if (!image.url && !image.data && !image.symbol && !image.path) {
            this.err('image must have data, url, path or symbol attribute defined');
          }

          const imageAttrs = [
            'id',
            'width',
            'height',
            'content_type',
            'data',
            'url',
            'symbol',
            'path',
            'data_url',
            'license',
          ];
          Object.keys(image).forEach((key) => {
            if (!imageAttrs.includes(key) && !key.startsWith('ext_')) {
              this.warn(
                `image.${key} attribute is not defined in the spec, should be prefixed with ext_yourapp_`
              );
            }
          });
        });
      }
    }

    await this.add_check('sounds', 'sounds attribute', async () => {
      if (!board.sounds) {
        this.err('sounds attribute is required');
      } else if (!Array.isArray(board.sounds)) {
        this.err('sounds attribute must be an array');
      }
    });

    if (Array.isArray(board.sounds)) {
      for (let i = 0; i < board.sounds.length; i++) {
        const sound = board.sounds[i];
        await this.add_check(`sounds[${i}]`, `sound at sounds[${i}]`, async () => {
          if (typeof sound !== 'object') {
            this.err('sound must be a hash');
            return;
          }
          if (!sound.id) {
            this.err('sound.id is required');
          }
          if (
            sound.duration !== undefined &&
            (typeof sound.duration !== 'number' || sound.duration < 0)
          ) {
            this.err('sound.duration must be a valid positive number');
          }
          if (!sound.content_type || !sound.content_type.match(/^audio\/.+$/)) {
            this.err('sound.content_type must be a valid audio mime type');
          }
          if (!sound.url && !sound.data && !sound.path) {
            this.err('sound must have data, url, or path attribute defined');
          }
        });
      }
    }

    if (Array.isArray(board.buttons)) {
      for (let i = 0; i < board.buttons.length; i++) {
        const button = board.buttons[i];
        await this.add_check(`buttons[${i}]`, `button at buttons[${i}]`, async () => {
          await this.validateButton(button);
        });
      }
    }
  }

  /**
   * Validate a single button
   */
  private async validateButton(button: any): Promise<void> {
    if (typeof button !== 'object') {
      this.err('button must be a hash');
      return;
    }
    if (!button.id) {
      this.err('button.id is required');
    }
    if (!button.label) {
      this.err('button.label is required');
    }

    ['top', 'left', 'width', 'height'].forEach((attr) => {
      if (button[attr] !== undefined && (typeof button[attr] !== 'number' || button[attr] < 0)) {
        this.warn(`button.${attr} should be a positive number`);
      }
    });

    ['background_color', 'border_color'].forEach((color) => {
      if (button[color]) {
        if (
          !button[color].match(/^\s*rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[01]?\.?\d*)?\)\s*/)
        ) {
          this.err(
            `button.${color} must be a valid rgb or rgba value if defined ("${button[color]}" is invalid)`
          );
        }
      }
    });

    if (button.hidden !== undefined && typeof button.hidden !== 'boolean') {
      this.err('button.hidden must be a boolean if defined');
    }

    if (!button.image_id) {
      this.warn('button.image_id is recommended');
    }

    if (button.action && typeof button.action === 'string' && !button.action.match(/^(:|\+)/)) {
      this.err('button.action must start with either : or + if defined');
    }

    if (button.actions && !Array.isArray(button.actions)) {
      this.err('button.actions must be an array of strings');
    }

    const buttonAttrs = [
      'id',
      'label',
      'vocalization',
      'image_id',
      'sound_id',
      'hidden',
      'background_color',
      'border_color',
      'action',
      'actions',
      'load_board',
      'top',
      'left',
      'width',
      'height',
    ];
    Object.keys(button).forEach((key) => {
      if (!buttonAttrs.includes(key) && !key.startsWith('ext_')) {
        this.warn(
          `button.${key} attribute is not defined in the spec, should be prefixed with ext_yourapp_`
        );
      }
    });
  }

  /**
   * Validate OBZ structure
   */
  private async validateObzStructure(zip: JSZip): Promise<void> {
    let json: any = null;

    await this.add_check('manifest', 'manifest.json', async () => {
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        this.err('manifest.json is required in the zip package');
        return;
      }

      try {
        const manifestStr = await manifestFile.async('string');
        json = JSON.parse(manifestStr);
      } catch {
        json = null;
      }

      if (!json) {
        this.err('manifest.json must contain a valid JSON structure');
      }
    });

    if (json) {
      await this.validateManifest(json, zip);
    }
  }

  /**
   * Validate manifest structure
   */
  private async validateManifest(manifest: any, zip: JSZip): Promise<void> {
    await this.add_check('manifest_format', 'manifest.json format version', async () => {
      if (!manifest.format) {
        this.err(`format attribute is required, set to ${OBF_FORMAT}`);
        return;
      }
      const version = parseFloat(manifest.format.split('-').pop());
      if (version > OBF_FORMAT_CURRENT_VERSION) {
        this.err(
          `format version (${version}) is invalid, current version is ${OBF_FORMAT_CURRENT_VERSION}`
        );
      } else if (version < OBF_FORMAT_CURRENT_VERSION) {
        this.warn(
          `format version (${version}) is old, consider updating to ${OBF_FORMAT_CURRENT_VERSION}`
        );
      }
    });

    await this.add_check('manifest_root', 'manifest.json root attribute', async () => {
      if (!manifest.root) {
        this.err('root attribute is required');
      }
      if (!zip.file(manifest.root)) {
        this.err('root attribute must reference a file in the package');
      }
    });

    await this.add_check('manifest_paths', 'manifest.json paths attribute', async () => {
      if (!manifest.paths || typeof manifest.paths !== 'object') {
        this.err('paths attribute must be a valid hash');
      }
      if (!manifest.paths.boards || typeof manifest.paths.boards !== 'object') {
        this.err('paths.boards must be a valid hash');
      }
    });

    await this.add_check('manifest_extras', 'manifest.json extra attributes', async () => {
      const attrs = ['format', 'root', 'paths'];
      Object.keys(manifest).forEach((key) => {
        if (!attrs.includes(key) && !key.startsWith('ext_')) {
          this.warn(
            `${key} attribute is not defined in the spec, should be prefixed with ext_yourapp_`
          );
        }
      });

      const pathAttrs = ['boards', 'images', 'sounds'];
      Object.keys(manifest.paths || {}).forEach((key) => {
        if (!pathAttrs.includes(key) && !key.startsWith('ext_')) {
          this.warn(
            `paths.${key} attribute is not defined in the spec, should be prefixed with ext_yourapp_`
          );
        }
      });
    });

    // Validate boards referenced in manifest
    if (manifest.paths && manifest.paths.boards) {
      for (const [id, boardPath] of Object.entries(manifest.paths.boards)) {
        await this.add_check(
          `manifest_boards[${id}]`,
          `manifest.json path.boards.${id}`,
          async () => {
            const bFile = zip.file(boardPath as string);
            if (!bFile) {
              this.err(`board path (${boardPath}) not found in the zip package`);
              return;
            }
            try {
              const boardStr = await bFile.async('string');
              const boardJson = JSON.parse(boardStr);
              if (!boardJson || boardJson.id !== id) {
                const boardId = (boardJson && boardJson.id) || 'null';
                this.err(
                  `board at path (${boardPath}) defined in manifest with id "${id}" but actually has id "${boardId}"`
                );
              }
            } catch {
              this.err(`could not parse board at path (${boardPath})`);
            }
          }
        );
      }
    }

    // Validate images referenced in manifest
    if (manifest.paths && manifest.paths.images) {
      for (const [id, imgPath] of Object.entries(manifest.paths.images)) {
        await this.add_check(
          `manifest_images[${id}]`,
          `manifest.json path.images.${id}`,
          async () => {
            if (!zip.file(imgPath as string)) {
              this.err(`image path (${imgPath}) not found in the zip package`);
            }
          }
        );
      }
    }

    // Validate sounds referenced in manifest
    if (manifest.paths && manifest.paths.sounds) {
      for (const [id, soundPath] of Object.entries(manifest.paths.sounds)) {
        await this.add_check(
          `manifest_sounds[${id}]`,
          `manifest.json path.sounds.${id}`,
          async () => {
            if (!zip.file(soundPath as string)) {
              this.err(`sound path (${soundPath}) not found in the zip package`);
            }
          }
        );
      }
    }
  }
}
