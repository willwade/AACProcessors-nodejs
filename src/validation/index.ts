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
} from './validationTypes';

export { BaseValidator } from './baseValidator';

// Individual format validators
export { ObfValidator } from './obfValidator';
export { GridsetValidator } from './gridsetValidator';
export { SnapValidator } from './snapValidator';
export { TouchChatValidator } from './touchChatValidator';

/**
 * Main validator factory
 * Returns the appropriate validator for a given format
 */
import { ObfValidator } from './obfValidator';
import { GridsetValidator } from './gridsetValidator';
import { SnapValidator } from './snapValidator';
import { TouchChatValidator } from './touchChatValidator';
import { BaseValidator } from './baseValidator';

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
    default:
      return null;
  }
}
