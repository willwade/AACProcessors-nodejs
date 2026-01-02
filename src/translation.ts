/**
 * Translation Namespace
 *
 * LLM-based translation utilities for AAC files with symbol preservation.
 *
 * These utilities are used by processor classes. See individual processors for:
 * - extractSymbolsForLLM() - method on GridsetProcessor, ObfProcessor, TouchChatProcessor, SnapProcessor
 * - processLLMTranslations() - method on GridsetProcessor, ObfProcessor, TouchChatProcessor, SnapProcessor
 *
 * Or use the lower-level utilities directly:
 */

export {
  normalizeButtonForTranslation,
  extractSymbolsFromButton,
  extractAllButtonsForTranslation,
  createTranslationPrompt,
  validateTranslationResults,
  type SymbolInfo,
  type ButtonForTranslation,
  type LLMLTranslationResult,
} from './utilities/translation/translationProcessor';
