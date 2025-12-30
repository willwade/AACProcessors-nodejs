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
