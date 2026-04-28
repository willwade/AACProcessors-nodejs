import { defaultFileAdapter } from '../utils/io';
import { getZipAdapter } from '../utils/zip';
import {
  ValidationError,
  ValidationResult,
  ValidationCheck,
  ValidationOptions,
  ValidationConfig,
} from './validationTypes';

/**
 * Base class for all format validators
 * Provides the check-based validation system
 */
export abstract class BaseValidator {
  protected _errors: number = 0;
  protected _warnings: number = 0;
  protected _checks: ValidationCheck[] = [];
  protected _sub_checks: ValidationResult[] = [];
  protected _blocked: boolean = false;
  protected _options: ValidationConfig;

  constructor(options: ValidationOptions = {}) {
    this._options = {
      includeWarnings: options.includeWarnings ?? true,
      stopOnBlocker: options.stopOnBlocker ?? true,
      customRules: options.customRules || [],
      fileAdapter: defaultFileAdapter,
      zipAdapter: getZipAdapter,
      ...options,
    };
    this.reset();
  }

  /**
   * Reset validator state
   */
  protected reset(): void {
    this._errors = 0;
    this._warnings = 0;
    this._checks = [];
    this._sub_checks = [];
    this._blocked = false;
  }

  /**
   * Add a validation check that will be executed
   * @param type - Category of the check
   * @param description - Human-readable description
   * @param checkFn - Async function that performs the check
   */
  protected async add_check(
    type: string,
    description: string,
    checkFn: () => Promise<void>
  ): Promise<void> {
    // Skip if blocked by a previous error
    if (this._blocked && this._options.stopOnBlocker) {
      return;
    }

    const checkObj: ValidationCheck = {
      type,
      description,
      valid: true,
    };
    this._checks.push(checkObj);

    try {
      await checkFn();
    } catch (e: any) {
      if (e instanceof ValidationError) {
        this._errors++;
        checkObj.valid = false;
        checkObj.error = e.message;
        if (e.blocker) {
          this._blocked = true;
        }
      } else {
        // Re-throw non-ValidationError exceptions
        throw e;
      }
    }
  }

  /**
   * Add a synchronous validation check
   */
  protected add_check_sync(type: string, description: string, checkFn: () => void): void {
    // Convert sync to async for consistency
    // eslint-disable-next-line @typescript-eslint/require-await
    void this.add_check(type, description, async () => checkFn());
  }

  /**
   * Throw a validation error
   * @param message - Error message
   * @param blocker - If true, stop further validation
   */
  protected err(message: string, blocker = false): never {
    throw new ValidationError(message, blocker);
  }

  /**
   * Add a warning to the last check
   * @param message - Warning message
   */
  protected warn(message: string): void {
    if (!this._options.includeWarnings) {
      return;
    }

    this._warnings++;
    const lastCheck = this._checks[this._checks.length - 1];
    if (lastCheck) {
      lastCheck.warnings = lastCheck.warnings || [];
      lastCheck.warnings.push(message);
    }
  }

  /**
   * Get the current error count
   */
  get errors(): number {
    return this._errors;
  }

  /**
   * Get the current warning count
   */
  get warnings(): number {
    return this._warnings;
  }

  /**
   * Get all checks performed so far
   */
  get checks(): ValidationCheck[] {
    return this._checks;
  }

  /**
   * Get sub-validation results
   */
  get sub_checks(): ValidationResult[] {
    return this._sub_checks;
  }

  /**
   * Check if validation has been blocked
   */
  get isBlocked(): boolean {
    return this._blocked;
  }

  /**
   * Build the final validation result
   */
  protected buildResult(filename: string, filesize: number, format: string): ValidationResult {
    return {
      filename,
      filesize,
      format,
      valid: this._errors === 0,
      errors: this._errors,
      warnings: this._warnings,
      results: this._checks,
      sub_results: this._sub_checks.length > 0 ? this._sub_checks : undefined,
    };
  }

  /**
   * Abstract method - each validator must implement this
   * @param content - The content to validate (can be string, buffer, object, etc.)
   * @param filename - Name of the file being validated
   * @param filesize - Size of the file in bytes
   */
  abstract validate(content: any, filename: string, filesize: number): Promise<ValidationResult>;

  /**
   * Static helper to validate from file path
   * Must be implemented by subclasses if they support file-based validation
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  static async validateFile(_filePath: string): Promise<ValidationResult> {
    throw new Error('validateFile must be implemented by subclass');
  }

  /**
   * Static helper to identify if content is this validator's format
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  static async identifyFormat(_content: any, _filename: string): Promise<boolean> {
    throw new Error('identifyFormat must be implemented by subclass');
  }
}
