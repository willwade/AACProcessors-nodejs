/**
 * Symbol Alignment for Translation
 *
 * Utilities to preserve symbol positions during text translation.
 * When translating AAC gridset messages that contain symbols attached
 * to specific words, we need to maintain the symbol-to-word associations
 * across languages.
 *
 * Example:
 *   English: "I want apple juice" with apple symbol on "apple"
 *   Spanish: "Yo quiero jugo de manzana" with apple symbol on "manzana"
 */

/**
 * Represents a symbol anchored to a specific word in the text
 */
export interface SymbolAnchor {
  symbolRef: string; // e.g., "[widgit]/food/apple.png" or local image path
  wordIndex: number; // 0-based index of the word this symbol is attached to
  originalWord: string; // The actual word the symbol is attached to
  startPos: number; // Character position in the original text
  endPos: number; // End character position in the original text
}

/**
 * Parsed message with symbol anchors
 */
export interface ParsedMessage {
  text: string; // The plain text without symbols
  words: string[]; // Tokenized words
  symbols: SymbolAnchor[]; // Symbols with their word associations
}

/**
 * Translation result with preserved symbols
 */
export interface TranslatedMessage {
  text: string; // Translated text with symbols reattached
  alignment: {
    originalWord: string;
    translatedWord: string;
    originalIndex: number;
    translatedIndex: number;
  }[];
}

/**
 * Parse a message to extract text and symbol anchors.
 *
 * This handles various formats:
 * 1. Plain text with no symbols
 * 2. Rich text with embedded symbol markers (future enhancement)
 * 3. Text where symbols are tracked separately (via richText.symbols)
 *
 * For now, this assumes symbols are tracked separately in the richText structure.
 * The text itself is plain, and we need to tokenize it to find word positions.
 *
 * @param message - The message text (may contain words or be plain)
 * @param richTextSymbols - Optional symbols from richText.symbols array
 * @returns Parsed message with word positions and symbol anchors
 */
export function parseMessageWithSymbols(
  message: string,
  richTextSymbols?: Array<{ text: string; image?: string }>
): ParsedMessage {
  // Normalize whitespace for consistent tokenization
  const normalizedMessage = message.trim().replace(/\s+/g, ' ');

  // Tokenize into words, preserving punctuation
  const words: string[] = [];
  const wordPositions: { start: number; end: number; word: string }[] = [];

  // Split by whitespace but track positions
  let currentPos = 0;
  const parts = normalizedMessage.split(/(\s+)/); // Keep delimiters

  for (const part of parts) {
    if (part.trim().length > 0) {
      // This is a word
      const startPos = currentPos;
      const endPos = currentPos + part.length;
      words.push(part);
      wordPositions.push({ start: startPos, end: endPos, word: part });
      currentPos = endPos;
    } else {
      // This is whitespace
      currentPos += part.length;
    }
  }

  // Extract symbol anchors from richText.symbols if provided
  const symbols: SymbolAnchor[] = [];

  if (richTextSymbols && richTextSymbols.length > 0) {
    for (const sym of richTextSymbols) {
      // Find which word this symbol is attached to
      const wordIndex = words.findIndex((w) => w === sym.text);

      if (wordIndex !== -1) {
        const pos = wordPositions[wordIndex];
        symbols.push({
          symbolRef: sym.image || '',
          wordIndex,
          originalWord: sym.text,
          startPos: pos.start,
          endPos: pos.end,
        });
      } else {
        // Fuzzy match - find closest word (handles case differences, punctuation)
        const normalizedSymText = sym.text.toLowerCase().replace(/[^\w]/g, '');
        const fuzzyIndex = words.findIndex(
          (w) => w.toLowerCase().replace(/[^\w]/g, '') === normalizedSymText
        );

        if (fuzzyIndex !== -1) {
          const pos = wordPositions[fuzzyIndex];
          symbols.push({
            symbolRef: sym.image || '',
            wordIndex: fuzzyIndex,
            originalWord: words[fuzzyIndex],
            startPos: pos.start,
            endPos: pos.end,
          });
        }
      }
    }
  }

  return {
    text: normalizedMessage,
    words,
    symbols,
  };
}

/**
 * Align words from original text to translated text.
 *
 * This is a simple alignment strategy that works for many cases:
 * 1. Exact word matching (for cognates, names, numbers)
 * 2. Position-based alignment (assumes similar word order)
 *
 * For more accurate alignment, you could integrate with:
 * - Translation APIs that return alignment (e.g., Google Translate's word alignment)
 * - Statistical machine translation alignment tools
 * - Bilingual dictionaries
 *
 * @param originalWords - Words from the original text
 * @param translatedWords - Words from the translated text
 * @returns Alignment mapping between original and translated word indices
 */
export function alignWords(
  originalWords: string[],
  translatedWords: string[]
): TranslatedMessage['alignment'] {
  const alignment: TranslatedMessage['alignment'] = [];

  // Strategy 1: Try to match identical words (numbers, names, cognates)
  const matchedTranslatedIndices = new Set<number>();

  for (let origIdx = 0; origIdx < originalWords.length; origIdx++) {
    const origWord = originalWords[origIdx];
    const normalizedOrig = origWord.toLowerCase().replace(/[^\w]/g, '');

    // Try to find this word in the translation
    for (let transIdx = 0; transIdx < translatedWords.length; transIdx++) {
      if (matchedTranslatedIndices.has(transIdx)) continue;

      const transWord = translatedWords[transIdx];
      const normalizedTrans = transWord.toLowerCase().replace(/[^\w]/g, '');

      // Exact match (case-insensitive, ignoring punctuation)
      if (normalizedOrig === normalizedTrans && normalizedOrig.length > 0) {
        alignment.push({
          originalWord: origWord,
          translatedWord: transWord,
          originalIndex: origIdx,
          translatedIndex: transIdx,
        });
        matchedTranslatedIndices.add(transIdx);
        break;
      }
    }
  }

  // Strategy 2: For unmatched words, use positional alignment
  // This is a simple fallback that assumes similar word order
  for (let origIdx = 0; origIdx < originalWords.length; origIdx++) {
    if (alignment.find((a) => a.originalIndex === origIdx)) continue; // Already matched

    // Find the closest unmatched position in translation
    let bestTransIdx = -1;
    let minDistance = Infinity;

    for (let transIdx = 0; transIdx < translatedWords.length; transIdx++) {
      if (matchedTranslatedIndices.has(transIdx)) continue;

      // Calculate relative position
      const relativeOrigPos = origIdx / originalWords.length;
      const relativeTransPos = transIdx / translatedWords.length;
      const distance = Math.abs(relativeOrigPos - relativeTransPos);

      if (distance < minDistance) {
        minDistance = distance;
        bestTransIdx = transIdx;
      }
    }

    if (bestTransIdx !== -1) {
      alignment.push({
        originalWord: originalWords[origIdx],
        translatedWord: translatedWords[bestTransIdx],
        originalIndex: origIdx,
        translatedIndex: bestTransIdx,
      });
      matchedTranslatedIndices.add(bestTransIdx);
    }
  }

  return alignment;
}

/**
 * Reattach symbols to translated text based on word alignment.
 *
 * @param translatedText - The translated plain text
 * @param originalParsed - The original parsed message with symbols
 * @param alignment - Word alignment between original and translation
 * @returns Translated text with symbols embedded (as rich text structure)
 */
export function reattachSymbols(
  translatedText: string,
  originalParsed: ParsedMessage,
  alignment: TranslatedMessage['alignment']
): {
  text: string;
  richTextSymbols: Array<{ text: string; image?: string }>;
} {
  // Tokenize the translated text
  const translatedWords = translatedText
    .trim()
    .replace(/\s+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Create the rich text symbols array
  const richTextSymbols: Array<{ text: string; image?: string }> = [];

  for (const symbol of originalParsed.symbols) {
    // Find the alignment for this word
    const wordAlignment = alignment.find((a) => a.originalIndex === symbol.wordIndex);

    if (wordAlignment && wordAlignment.translatedIndex < translatedWords.length) {
      const translatedWord = translatedWords[wordAlignment.translatedIndex];

      // Attach the symbol to the translated word
      richTextSymbols.push({
        text: translatedWord,
        image: symbol.symbolRef,
      });
    } else {
      // Fallback: keep symbol on original word if no alignment found
      richTextSymbols.push({
        text: symbol.originalWord,
        image: symbol.symbolRef,
      });
    }
  }

  return {
    text: translatedText,
    richTextSymbols,
  };
}

/**
 * Complete pipeline: translate a message while preserving symbol positions.
 *
 * @param originalMessage - The original message text
 * @param translatedText - The translated text (from translation API)
 * @param richTextSymbols - Original symbols from richText.symbols
 * @returns Object with translated text and aligned symbols
 */
export function translateWithSymbols(
  originalMessage: string,
  translatedText: string,
  richTextSymbols?: Array<{ text: string; image?: string }>
): {
  text: string;
  richTextSymbols: Array<{ text: string; image?: string }>;
} {
  // Step 1: Parse original message
  const parsedOriginal = parseMessageWithSymbols(originalMessage, richTextSymbols);

  // If no symbols, return as-is
  if (parsedOriginal.symbols.length === 0) {
    return {
      text: translatedText,
      richTextSymbols: [],
    };
  }

  // Step 2: Tokenize translated text
  const translatedWords = translatedText
    .trim()
    .replace(/\s+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Step 3: Align words
  const alignment = alignWords(parsedOriginal.words, translatedWords);

  // Step 4: Reattach symbols
  const result = reattachSymbols(translatedText, parsedOriginal, alignment);

  return result;
}

/**
 * Extract symbols from a button for use during translation.
 *
 * This helper extracts symbols from either:
 * - button.semanticAction.richText.symbols
 * - button.image (if it's a symbol library reference)
 *
 * @param button - The AAC button
 * @returns Array of symbol attachments
 */
export function extractSymbolsFromButton(
  button: any
): Array<{ text: string; image?: string }> | undefined {
  // First check richText structure
  if (button.semanticAction?.richText?.symbols) {
    return button.semanticAction.richText.symbols as Array<{
      text: string;
      image?: string;
    }>;
  }

  // Check if button has a symbol library reference as image
  if (button.symbolLibrary && button.symbolPath) {
    // Create a symbol attachment for the label/message
    const text = button.label || button.message || '';
    if (text) {
      return [
        {
          text,
          image: `[${button.symbolLibrary}]${button.symbolPath}`,
        },
      ];
    }
  }

  // Check if image field contains a symbol reference
  if (button.image && button.image.startsWith('[')) {
    const text = button.label || button.message || '';
    if (text) {
      return [
        {
          text,
          image: button.image,
        },
      ];
    }
  }

  return undefined;
}
