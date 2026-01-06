/**
 * Custom error class for validation errors
 * Can be marked as a blocker to stop validation immediately
 */
export class ValidationError extends Error {
  blocker: boolean;

  constructor(message: string, blocker = false) {
    super(message);
    this.name = 'ValidationError';
    this.blocker = blocker;
  }
}

/**
 * Represents a single validation check with its result
 */
export interface ValidationCheck {
  /** Type/category of the check (e.g., 'json_parse', 'grid', 'buttons') */
  type: string;
  /** Human-readable description of what is being checked */
  description: string;
  /** Whether the check passed */
  valid: boolean;
  /** Error message if the check failed */
  error?: string;
  /** Non-blocking warnings */
  warnings?: string[];
}

/**
 * Complete validation result for a file
 */
export interface ValidationResult {
  /** Name of the file that was validated */
  filename: string;
  /** Size of the file in bytes */
  filesize: number;
  /** Format identifier (e.g., 'obf', 'gridset', 'snap') */
  format: string;
  /** Overall validity - true if no errors */
  valid: boolean;
  /** Total number of errors found */
  errors: number;
  /** Total number of warnings found */
  warnings: number;
  /** Array of individual validation checks */
  results: ValidationCheck[];
  /** Nested validation results (e.g., boards within an OBZ) */
  sub_results?: ValidationResult[];
}

/**
 * Options for validation behavior
 */
export interface ValidationOptions {
  /** Whether to include warnings in validation (default: true) */
  includeWarnings?: boolean;
  /** Whether to stop on first blocker error (default: true) */
  stopOnBlocker?: boolean;
  /** Custom validation rules to apply */
  customRules?: ValidationRule[];
}

/**
 * Custom validation rule that can be added
 */
export interface ValidationRule {
  type: string;
  description: string;
  check: (data: any) => Promise<boolean> | boolean;
  errorMessage?: string;
}

/**
 * Error wrapper that carries a structured ValidationResult so callers
 * can surface actionable details instead of generic exceptions.
 */
export class ValidationFailureError extends Error {
  validationResult: ValidationResult;
  originalError?: unknown;

  constructor(message: string, validationResult: ValidationResult, originalError?: unknown) {
    super(message);
    this.name = 'ValidationFailureError';
    this.validationResult = validationResult;
    this.originalError = originalError;
  }
}

/**
 * Build a minimal ValidationResult for situations where we cannot run
 * the full validator (e.g., early parse failure) but still want
 * structured feedback for the caller.
 */
export function buildValidationResultFromMessage(params: {
  filename: string;
  filesize: number;
  format: string;
  message: string;
  type?: string;
  description?: string;
}): ValidationResult {
  return {
    filename: params.filename,
    filesize: params.filesize,
    format: params.format,
    valid: false,
    errors: 1,
    warnings: 0,
    results: [
      {
        type: params.type || 'parse',
        description: params.description || 'parse',
        valid: false,
        error: params.message,
      },
    ],
  };
}
