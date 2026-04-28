/**
 * Validation system for AAC processors
 * Provides consistent validation across all supported formats
 */

export {
  ValidationError,
  ValidationCheck,
  ValidationResult,
  ValidationOptions,
  ValidationRule,
  ValidationFailureError,
  buildValidationResultFromMessage,
} from './validationTypes';

export { BaseValidator } from './baseValidator';

// Individual format validators
export { ObfValidator } from './obfValidator';
export { GridsetValidator } from './gridsetValidator';
export { SnapValidator } from './snapValidator';
export { TouchChatValidator } from './touchChatValidator';
export { AstericsGridValidator } from './astericsValidator';
export { ExcelValidator } from './excelValidator';
export { OpmlValidator } from './opmlValidator';
export { DotValidator } from './dotValidator';
export { ApplePanelsValidator } from './applePanelsValidator';
export { ObfsetValidator } from './obfsetValidator';

/**
 * Main validator factory
 * Returns the appropriate validator for a given format
 */
import { ObfValidator } from './obfValidator';
import { GridsetValidator } from './gridsetValidator';
import { SnapValidator } from './snapValidator';
import { TouchChatValidator } from './touchChatValidator';
import { BaseValidator } from './baseValidator';
import { ValidationResult } from './validationTypes';
import { AstericsGridValidator } from './astericsValidator';
import { ExcelValidator } from './excelValidator';
import { OpmlValidator } from './opmlValidator';
import { DotValidator } from './dotValidator';
import { ApplePanelsValidator } from './applePanelsValidator';
import { ObfsetValidator } from './obfsetValidator';
import {
  defaultFileAdapter,
  FileAdapter,
  getBasename,
  isNodeRuntime,
  toUint8Array,
  type ProcessorInput,
} from '../utils/io';

export function getValidatorForFormat(format: string): BaseValidator | null {
  switch (format.toLowerCase()) {
    case 'obf':
    case 'obz':
      return new ObfValidator();
    case 'gridset':
    case 'gridsetx':
      return new GridsetValidator();
    case 'snap':
    case 'spb':
    case 'sps':
      return new SnapValidator();
    case 'touchchat':
    case 'ce':
      return new TouchChatValidator();
    case 'asterics':
    case 'grd':
      return new AstericsGridValidator();
    case 'excel':
    case 'xlsx':
    case 'xls':
      return new ExcelValidator();
    case 'opml':
      return new OpmlValidator();
    case 'dot':
      return new DotValidator();
    case 'applepanels':
    case 'plist':
    case 'ascconfig':
      return new ApplePanelsValidator();
    case 'obfset':
      return new ObfsetValidator();
    default:
      return null;
  }
}

export function getValidatorForFile(filename: string): BaseValidator | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return null;

  switch (ext) {
    case 'obf':
    case 'obz':
      return new ObfValidator();
    case 'gridset':
    case 'gridsetx':
      return new GridsetValidator();
    case 'spb':
    case 'sps':
      return new SnapValidator();
    case 'ce':
      return new TouchChatValidator();
    case 'grd':
      return new AstericsGridValidator();
    case 'xlsx':
    case 'xls':
      return new ExcelValidator();
    case 'opml':
      return new OpmlValidator();
    case 'dot':
      return new DotValidator();
    case 'plist':
    case 'ascconfig':
      return new ApplePanelsValidator();
    case 'obfset':
      return new ObfsetValidator();
    default:
      return null;
  }
}

/**
 * Convenience helper to validate either a file path or a Buffer/Uint8Array.
 * When a file path is provided, any validator-specific validateFile() helper
 * will be used if available to access nested resources.
 */
export async function validateFileOrBuffer(
  filePathOrBuffer: ProcessorInput,
  fileAdapter?: FileAdapter,
  filenameHint?: string
): Promise<ValidationResult> {
  const isPath = typeof filePathOrBuffer === 'string';
  const name = filenameHint || (isPath ? getBasename(filePathOrBuffer) : 'upload');
  const validator = getValidatorForFile(name) || getValidatorForFormat(name);
  const adapter = fileAdapter ?? defaultFileAdapter;

  if (!validator) {
    throw new Error(`No validator registered for ${name}`);
  }

  if (isPath) {
    if (!isNodeRuntime()) {
      throw new Error('File path validation is only supported in Node.js environments.');
    }
    const ctor = validator.constructor as typeof BaseValidator & {
      validateFile?: (filePath: string) => Promise<ValidationResult>;
    };

    if (typeof ctor.validateFile === 'function') {
      return ctor.validateFile(filePathOrBuffer);
    }

    const buf = await adapter.readBinaryFromInput(filePathOrBuffer);
    const size = await adapter.getFileSize(filePathOrBuffer);
    return validator.validate(buf, getBasename(filePathOrBuffer), size);
  }

  const buffer = toUint8Array(filePathOrBuffer);
  return validator.validate(buffer, name, buffer.byteLength);
}
