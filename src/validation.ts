/**
 * Validation Namespace
 *
 * All validation functionality for AAC processors.
 * Provides consistent validation across all supported formats.
 */

// Validation types and interfaces
export {
  ValidationError,
  ValidationCheck,
  ValidationResult,
  ValidationOptions,
  ValidationRule,
} from './validation/validationTypes';

// Base validator
export { BaseValidator } from './validation/baseValidator';

// Format-specific validators
export { ObfValidator } from './validation/obfValidator';
export { GridsetValidator } from './validation/gridsetValidator';
export { SnapValidator } from './validation/snapValidator';
export { TouchChatValidator } from './validation/touchChatValidator';

// Validator factory functions
export { getValidatorForFormat, getValidatorForFile } from './validation/index';
