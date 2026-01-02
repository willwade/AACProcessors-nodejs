/**
 * LLM-Based Translation with Symbol Preservation
 *
 * This module provides utilities for translating AAC files while preserving
 * symbol-to-word associations across different formats (gridset, OBF, Snap, etc.).
 *
 * The key insight: Different AAC formats have different internal structures,
 * but they all share common concepts:
 * - Buttons with labels and messages
 * - Symbols attached to specific words
 * - Need to preserve symbol positions during translation
 *
 * This module provides a format-agnostic way to:
 * 1. Extract symbol information for LLM processing
 * 2. Apply LLM translations with preserved symbols
 *
 * Usage:
 * 1. Processor extracts buttons and calls extractSymbolsForLLM()
 * 2. LLM translates and returns aligned symbols
 * 3. Processor calls processLLMTranslations() to apply results
 */

/**
 * Represents a symbol attached to text in a format-agnostic way
 */
export interface SymbolInfo {
  text: string; // The word/phrase this symbol is attached to
  image?: string; // Symbol reference (e.g., "[widgit]/food/apple.png")
  symbolLibrary?: string; // Library name (e.g., "widgit")
  symbolPath?: string; // Path within library (e.g., "/food/apple.png")
}

/**
 * Button data extracted for translation (format-agnostic)
 */
export interface ButtonForTranslation {
  buttonId: string; // Unique identifier for this button
  pageId?: string; // Optional: which page this button is on
  pageName?: string; // Optional: page name for context
  label: string; // Button label text
  message: string; // Button message/speak text
  textToTranslate: string; // The actual text to translate (usually message or label)
  symbols: SymbolInfo[]; // Symbols attached to this button
  grammar?: any; // Optional grammar tags (e.g., pos, person, number)
}

/**
 * LLM translation result with symbol mappings
 */
export interface LLMLTranslationResult {
  buttonId: string; // Must match the input buttonId
  translatedLabel?: string; // Translated label (optional if not needed)
  translatedMessage?: string; // Translated message
  symbols?: Array<{
    text: string; // The translated word to attach the symbol to
    image?: string; // The symbol reference (copied from input)
  }>;
}

/**
 * Extract symbols from a button for LLM-based translation.
 *
 * This is a format-agnostic helper that processors can use to normalize
 * their button data into a common format for LLM processing.
 *
 * @param buttonId - Unique identifier for the button
 * @param label - Button label text
 * @param message - Button message/speak text
 * @param symbols - Array of symbols from the button
 * @param context - Optional page context
 * @returns Normalized button data for translation
 */
export function normalizeButtonForTranslation(
  buttonId: string,
  label: string,
  message: string,
  symbols: SymbolInfo[],
  context?: {
    pageId?: string;
    pageName?: string;
  },
  grammar?: any
): ButtonForTranslation {
  return {
    buttonId,
    label,
    message,
    textToTranslate: message || label, // Translate message if present, otherwise label
    symbols,
    grammar,
    ...context,
  };
}

/**
 * Extract symbols from various button formats.
 *
 * This helper handles different ways symbols might be stored in button data:
 * - semanticAction.richText.symbols (gridset format)
 * - symbolLibrary + symbolPath fields
 * - image field with [library]path format
 *
 * @param button - Button object from any AAC format
 * @returns Array of symbol info, or undefined if no symbols
 */
export function extractSymbolsFromButton(button: any): SymbolInfo[] | undefined {
  const symbols: SymbolInfo[] = [];

  // Method 1: Check for semanticAction.richText.symbols (gridset format)
  if (button.semanticAction?.richText?.symbols) {
    const richTextSymbols = button.semanticAction.richText.symbols as SymbolInfo[];
    if (Array.isArray(richTextSymbols) && richTextSymbols.length > 0) {
      symbols.push(...richTextSymbols);
      return symbols;
    }
  }

  // Determine the text to attach symbol to
  const text = button.label || button.message || '';
  if (!text) {
    return undefined;
  }

  // Method 2: Check for symbolLibrary + symbolPath fields
  if (button.symbolLibrary && button.symbolPath) {
    symbols.push({
      text,
      image: `[${button.symbolLibrary}]${button.symbolPath}`,
      symbolLibrary: button.symbolLibrary,
      symbolPath: button.symbolPath,
    });
    return symbols;
  }

  // Method 3: Check if image field contains a symbol reference
  if (button.image && typeof button.image === 'string' && button.image.startsWith('[')) {
    symbols.push({
      text,
      image: button.image,
    });
    return symbols;
  }

  // No symbols found
  return undefined;
}

/**
 * Extract all buttons from a file for LLM translation.
 *
 * This is a convenience method that processors can use to extract all
 * translatable buttons with their symbols in a format-agnostic way.
 *
 * @param buttons - Array of button objects from any AAC format
 * @param contextFn - Optional function to provide page context for each button
 * @returns Array of normalized button data ready for LLM translation
 */
export function extractAllButtonsForTranslation(
  buttons: any[],
  contextFn?: (button: any) => { pageId?: string; pageName?: string }
): ButtonForTranslation[] {
  const results: ButtonForTranslation[] = [];

  for (const button of buttons) {
    if (!button) continue;

    const buttonId = (button.id || button.buttonId || `button_${results.length}`) as string;
    const label = (button.label || '') as string;
    const message = (button.message || '') as string;
    const symbols = extractSymbolsFromButton(button);

    // Only include buttons that have text to translate
    if (!label && !message) continue;

    const context = contextFn ? contextFn(button) : undefined;
    const grammar = button.parameters?.grammar || undefined;

    results.push(
      normalizeButtonForTranslation(buttonId, label, message, symbols || [], context, grammar)
    );
  }

  return results;
}

/**
 * Create a prompt for LLM translation with symbol preservation.
 *
 * This generates a structured prompt that instructs the LLM to translate
 * while preserving symbol-to-word associations.
 *
 * @param buttons - Buttons to translate
 * @param targetLanguage - Target language for translation
 * @returns Prompt string for LLM
 */
export function createTranslationPrompt(
  buttons: ButtonForTranslation[],
  targetLanguage: string
): string {
  const buttonsData = JSON.stringify(buttons, null, 2);

  return `You are a translation assistant for AAC (Augmentative and Alternative Communication) systems.

Your task is to translate the following buttons to ${targetLanguage} while preserving symbol associations.

Each button has:
- label: The text shown on the button
- message: The text spoken when the button is activated
- textToTranslate: The actual text to translate (usually the message)
- symbols: Visual symbols attached to specific words
- grammar: Grammatical context (e.g., pos: Part of Speech, person, number)

IMPORTANT: After translation, you MUST reattach symbols to the correct translated words based on MEANING, not position.

Example:
- Original: "I want apple" with apple symbol on "apple"
- Spanish: "Yo quiero manzana" with apple symbol on "manzana" (NOT "Yo" or "quiero")
- French: "Je veux une pomme" with apple symbol on "pomme"

The symbols array should contain the translated word that each symbol should be attached to.

Buttons to translate:
${buttonsData}

Return ONLY a JSON array with this exact structure:
[
  {
    "buttonId": "...",
    "translatedLabel": "...",
    "translatedMessage": "...",
    "symbols": [
      {"text": "translated_word", "image": "[library]path"}
    ]
  }
]

Ensure all symbol image references are preserved exactly as provided.`;
}

/**
 * Validate LLM translation results before applying.
 *
 * @param translations - LLM translation results
 * @param originalButtonIds - Expected button IDs (optional, for validation)
 * @param options - Validation options
 * @throws Error if validation fails
 */
export function validateTranslationResults(
  translations: LLMLTranslationResult[],
  originalButtonIds?: string[],
  options?: { allowPartial?: boolean }
): void {
  if (!Array.isArray(translations)) {
    throw new Error('Translation results must be an array');
  }

  const translatedIds = new Set(translations.map((t) => t.buttonId));

  // Check that all original buttons have translations (unless partial is allowed)
  if (originalButtonIds && !options?.allowPartial) {
    for (const id of originalButtonIds) {
      if (!translatedIds.has(id)) {
        throw new Error(`Missing translation for button: ${id}`);
      }
    }
  }

  // Check each translation has required fields
  for (const trans of translations) {
    if (!trans.buttonId) {
      throw new Error('Translation missing buttonId');
    }
    if (!trans.translatedMessage && !trans.translatedLabel) {
      throw new Error(`Translation for ${trans.buttonId} has no translated text`);
    }
  }
}
