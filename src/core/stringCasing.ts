/**
 * String casing utilities for AAC text processing
 * Used for detecting and managing text casing across different AAC formats
 */

export enum StringCasing {
  LOWER = 'lower',
  SNAKE = 'snake',
  CONSTANT = 'constant',
  CAMEL = 'camel',
  UPPER = 'upper',
  KEBAB = 'kebab',
  CAPITAL = 'capital',
  HEADER = 'header',
  PASCAL = 'pascal',
  TITLE = 'title',
  SENTENCE = 'sentence',
}

/**
 * Detects the casing pattern of a given text string
 * @param text - The text to analyze for casing pattern
 * @returns StringCasing enum value representing the detected casing
 */
export function detectCasing(text: string): StringCasing {
  if (!text || text.length === 0) return StringCasing.LOWER;

  // Remove leading/trailing whitespace for analysis
  const trimmed = text.trim();
  if (trimmed.length === 0) return StringCasing.LOWER;

  // Check for specific patterns

  // CONSTANT_CASE (ALL_CAPS_WITH_UNDERSCORES)
  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed) && trimmed.includes('_')) {
    return StringCasing.CONSTANT;
  }

  // snake_case (lowercase_with_underscores)
  if (/^[a-z][a-z0-9_]*$/.test(trimmed) && trimmed.includes('_')) {
    return StringCasing.SNAKE;
  }

  // kebab-case (lowercase-with-hyphens)
  if (/^[a-z][a-z0-9-]*$/.test(trimmed) && trimmed.includes('-')) {
    return StringCasing.KEBAB;
  }

  // camelCase (firstWordLowerCaseFollowingWordsCapitalized)
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return StringCasing.CAMEL;
  }

  // PascalCase (FirstWordAndFollowingWordsCapitalized)
  if (
    /^[A-Z][a-zA-Z0-9]*$/.test(trimmed) &&
    /[a-z]/.test(trimmed) &&
    /[A-Z].*[A-Z]/.test(trimmed)
  ) {
    return StringCasing.PASCAL;
  }

  // UPPER CASE (ALL UPPERCASE) - but only if more than one character
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 1) {
    return StringCasing.UPPER;
  }

  // lower case (all lowercase)
  if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed)) {
    return StringCasing.LOWER;
  }

  // Title Case (First Letter Of Each Word Capitalized)
  const words = trimmed.split(/\s+/);
  if (
    words.length > 1 &&
    words.every(
      (word) =>
        word.length > 0 &&
        word[0] === word[0].toUpperCase() &&
        (word.length === 1 || word.slice(1) === word.slice(1).toLowerCase())
    )
  ) {
    return StringCasing.TITLE;
  }

  // Header-Case (First-Letter-Of-Each-Word-Capitalized-With-Hyphens)
  if (trimmed.includes('-')) {
    const hyphenWords = trimmed.split('-');
    if (
      hyphenWords.length > 1 &&
      hyphenWords.every(
        (word) =>
          word.length > 0 &&
          word[0] === word[0].toUpperCase() &&
          (word.length === 1 || word.slice(1) === word.slice(1).toLowerCase())
      )
    ) {
      return StringCasing.HEADER;
    }
  }

  // Sentence case (First letter capitalized, rest lowercase)
  if (
    trimmed.length > 1 &&
    trimmed[0] === trimmed[0].toUpperCase() &&
    trimmed.slice(1) === trimmed.slice(1).toLowerCase()
  ) {
    return StringCasing.SENTENCE;
  }

  // Capital case (Just first letter capitalized, may have mixed case after)
  if (trimmed[0] === trimmed[0].toUpperCase()) {
    return StringCasing.CAPITAL;
  }

  // Default fallback
  return StringCasing.LOWER;
}

/**
 * Converts text to the specified casing
 * @param text - The text to convert
 * @param targetCasing - The desired casing format
 * @returns The text converted to the target casing
 */
export function convertCasing(text: string, targetCasing: StringCasing): string {
  if (!text || text.length === 0) return text;

  const trimmed = text.trim();
  if (trimmed.length === 0) return text;

  switch (targetCasing) {
    case StringCasing.LOWER:
      return trimmed.toLowerCase();

    case StringCasing.UPPER:
      return trimmed.toUpperCase();

    case StringCasing.CAPITAL:
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();

    case StringCasing.SENTENCE:
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();

    case StringCasing.TITLE:
      return trimmed
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    case StringCasing.CAMEL:
      return trimmed
        .split(/[\s_-]+/)
        .map((word, index) =>
          index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

    case StringCasing.PASCAL:
      return trimmed
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');

    case StringCasing.SNAKE:
      return trimmed
        .split(/[\s-]+/)
        .map((word) => word.toLowerCase())
        .join('_');

    case StringCasing.CONSTANT:
      return trimmed
        .split(/[\s-]+/)
        .map((word) => word.toUpperCase())
        .join('_');

    case StringCasing.KEBAB:
      return trimmed
        .split(/[\s_]+/)
        .map((word) => word.toLowerCase())
        .join('-');

    case StringCasing.HEADER:
      return trimmed
        .split(/[\s_]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('-');

    default:
      return trimmed;
  }
}

/**
 * Utility function to check if text is primarily numeric or empty
 * Used for filtering out non-meaningful text content
 * @param text - The text to check
 * @returns True if the text should be considered non-meaningful
 */
export function isNumericOrEmpty(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= 1) return true;

  // Check if the entire string is numeric
  const numericValue = parseInt(trimmed, 10);
  return !isNaN(numericValue) && numericValue.toString() === trimmed;
}
