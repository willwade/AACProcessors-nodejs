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
  ValidationFailureError,
  buildValidationResultFromMessage,
} from "./validation/validationTypes";

// Base validator
export { BaseValidator } from "./validation/baseValidator";

// Format-specific validators
export { ObfValidator } from "./validation/obfValidator";
export { GridsetValidator } from "./validation/gridsetValidator";
export { SnapValidator } from "./validation/snapValidator";
export { TouchChatValidator } from "./validation/touchChatValidator";
export { AstericsGridValidator } from "./validation/astericsValidator";
export { ExcelValidator } from "./validation/excelValidator";
export { OpmlValidator } from "./validation/opmlValidator";
export { DotValidator } from "./validation/dotValidator";
export { ApplePanelsValidator } from "./validation/applePanelsValidator";
export { ObfsetValidator } from "./validation/obfsetValidator";

// Validator factory functions
export {
  getValidatorForFormat,
  getValidatorForFile,
  validateFileOrBuffer,
} from "./validation/index";
