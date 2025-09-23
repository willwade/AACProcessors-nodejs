import { AACTree, AACButton, AACSemanticCategory, AACSemanticIntent } from './treeStructure';
import { StringCasing, detectCasing, isNumericOrEmpty } from './stringCasing';

// Configuration options for processors
export interface ProcessorOptions {
  // Filter out navigation/system buttons (enabled by default)
  excludeNavigationButtons?: boolean;
  excludeSystemButtons?: boolean;

  // Custom filtering function for advanced use cases
  customButtonFilter?: (button: AACButton) => boolean;

  // Preserve original behavior for backwards compatibility
  preserveAllButtons?: boolean;
}

// Types for aac-tools-platform compatibility
export interface ExtractedString {
  string: string;
  vocabPlacementMeta: VocabPlacementMetadata;
}

export interface VocabPlacementMetadata {
  vocabLocations: VocabLocation[];
}

export interface VocabLocation {
  table: string;
  id: number;
  column: string;
  casing: StringCasing;
}

export interface ProcessingError {
  message: string;
  step: 'EXTRACT' | 'PROCESS' | 'SAVE';
}

export interface ExtractStringsResult {
  errors: ProcessingError[];
  extractedStrings: ExtractedString[];
}

export interface TranslatedString {
  sourcestringid: number;
  overridestring: string;
  translatedstring: string;
}

export interface SourceString {
  id: number;
  sourcestring: string;
  vocabplacementmetadata: VocabPlacementMetadata;
}

abstract class BaseProcessor {
  protected options: ProcessorOptions;

  constructor(options: ProcessorOptions = {}) {
    // Default configuration: exclude navigation/system buttons
    this.options = {
      excludeNavigationButtons: true,
      excludeSystemButtons: true,
      preserveAllButtons: false,
      ...options,
    };
  }

  // Extract all text content (for translation, analysis, etc.)
  abstract extractTexts(filePathOrBuffer: string | Buffer): string[];

  // Load file into common tree structure
  abstract loadIntoTree(filePathOrBuffer: string | Buffer): AACTree;

  // Process texts (e.g., apply translations) and return new file/buffer
  abstract processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer;

  // Save tree structure back to file/buffer
  abstract saveFromTree(tree: AACTree, outputPath: string): void;

  // Optional alias methods for aac-tools-platform compatibility
  // These provide a unified interface across all AAC formats

  /**
   * Extract strings with metadata for external platform integration
   * @param filePath - Path to the AAC file
   * @returns Promise with extracted strings and any errors
   */
  extractStringsWithMetadata?(filePath: string): Promise<ExtractStringsResult>;

  /**
   * Generate translated download with external translation data
   * @param filePath - Path to the original AAC file
   * @param translatedStrings - Array of translated string data
   * @param sourceStrings - Array of source string data with metadata
   * @returns Promise with path to the generated translated file
   */
  generateTranslatedDownload?(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string>;

  // Helper method to determine if a button should be filtered out
  protected shouldFilterButton(button: AACButton): boolean {
    // If preserveAllButtons is true, never filter
    if (this.options.preserveAllButtons) {
      return false;
    }

    // Apply custom filter if provided
    if (this.options.customButtonFilter) {
      return !this.options.customButtonFilter(button);
    }

    // Check semantic action-based filtering
    if (button.semanticAction) {
      const { category, intent } = button.semanticAction;

      // Filter specific navigation intents (toolbar navigation only)
      if (this.options.excludeNavigationButtons) {
        const i = String(intent);
        if (i === 'GO_BACK' || i === 'GO_HOME') {
          return true;
        }
      }

      // Filter system/text editing buttons by category
      if (this.options.excludeSystemButtons && category === AACSemanticCategory.TEXT_EDITING) {
        return true;
      }

      // Filter specific system intents
      if (this.options.excludeSystemButtons) {
        const i = String(intent);
        if (
          i === 'DELETE_WORD' ||
          i === 'DELETE_CHARACTER' ||
          i === 'CLEAR_TEXT' ||
          i === 'COPY_TEXT'
        ) {
          return true;
        }
      }
    }

    // Fallback: check button labels for common navigation/system terms
    // Only apply label-based filtering if button doesn't have semantic actions
    if (
      !button.semanticAction &&
      (this.options.excludeNavigationButtons || this.options.excludeSystemButtons)
    ) {
      const label = button.label?.toLowerCase() || '';
      const message = button.message?.toLowerCase() || '';

      // More conservative navigation terms (exclude "more" since it's often used for legitimate page navigation)
      const navigationTerms = ['back', 'home', 'menu', 'settings'];
      const systemTerms = ['delete', 'clear', 'copy', 'paste', 'undo', 'redo'];

      if (
        this.options.excludeNavigationButtons &&
        navigationTerms.some((term) => label.includes(term) || message.includes(term))
      ) {
        return true;
      }

      if (
        this.options.excludeSystemButtons &&
        systemTerms.some((term) => label.includes(term) || message.includes(term))
      ) {
        return true;
      }
    }

    return false;
  }

  // Helper method to filter buttons from a page
  protected filterPageButtons(buttons: AACButton[]): AACButton[] {
    return buttons.filter((button) => !this.shouldFilterButton(button));
  }

  /**
   * Generic implementation for extracting strings with metadata
   * Can be used by any processor that doesn't need format-specific logic
   * @param filePath - Path to the AAC file
   * @returns Promise with extracted strings and metadata
   */
  protected extractStringsWithMetadataGeneric(filePath: string): Promise<ExtractStringsResult> {
    try {
      const tree = this.loadIntoTree(filePath);
      const extractedMap = new Map<string, ExtractedString>();

      // Process all pages and buttons
      Object.values(tree.pages).forEach((page) => {
        // Process page names
        if (page.name && page.name.trim().length > 1 && !isNumericOrEmpty(page.name)) {
          const key = page.name.trim().toLowerCase();
          const vocabLocation: VocabLocation = {
            table: 'pages',
            id: parseInt(page.id) || 0,
            column: 'NAME',
            casing: detectCasing(page.name),
          };

          this.addToExtractedMap(extractedMap, key, page.name.trim(), vocabLocation);
        }

        page.buttons.forEach((button) => {
          // Process button labels
          if (button.label && button.label.trim().length > 1 && !isNumericOrEmpty(button.label)) {
            const key = button.label.trim().toLowerCase();
            const vocabLocation: VocabLocation = {
              table: 'buttons',
              id: parseInt(button.id) || 0,
              column: 'LABEL',
              casing: detectCasing(button.label),
            };

            this.addToExtractedMap(extractedMap, key, button.label.trim(), vocabLocation);
          }

          // Process button messages (if different from label)
          if (
            button.message &&
            button.message !== button.label &&
            button.message.trim().length > 1 &&
            !isNumericOrEmpty(button.message)
          ) {
            const key = button.message.trim().toLowerCase();
            const vocabLocation: VocabLocation = {
              table: 'buttons',
              id: parseInt(button.id) || 0,
              column: 'MESSAGE',
              casing: detectCasing(button.message),
            };

            this.addToExtractedMap(extractedMap, key, button.message.trim(), vocabLocation);
          }
        });
      });

      const extractedStrings = Array.from(extractedMap.values());
      return Promise.resolve({ errors: [], extractedStrings });
    } catch (error) {
      return Promise.resolve({
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown extraction error',
            step: 'EXTRACT' as const,
          },
        ],
        extractedStrings: [],
      });
    }
  }

  /**
   * Generic implementation for generating translated downloads
   * Can be used by any processor that doesn't need format-specific logic
   * @param filePath - Path to the original AAC file
   * @param translatedStrings - Array of translated string data
   * @param sourceStrings - Array of source string data
   * @returns Promise with path to the generated translated file
   */
  protected generateTranslatedDownloadGeneric(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    try {
      // Build translation map from the provided data
      const translations = new Map<string, string>();

      sourceStrings.forEach((sourceString) => {
        const translated = translatedStrings.find(
          (ts) => ts.sourcestringid.toString() === sourceString.id.toString()
        );

        if (translated) {
          const translatedText =
            translated.overridestring.length > 0
              ? translated.overridestring
              : translated.translatedstring;
          translations.set(sourceString.sourcestring, translatedText);
        }
      });

      // Generate output path based on file extension
      const outputPath = this.generateTranslatedOutputPath(filePath);

      // Use existing processTexts method
      this.processTexts(filePath, translations, outputPath);

      return Promise.resolve(outputPath);
    } catch (error) {
      return Promise.reject(
        new Error(
          `Failed to generate translated download: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  /**
   * Helper method to add extracted strings to the map, handling duplicates
   * @param extractedMap - Map to store extracted strings
   * @param key - Lowercase key for deduplication
   * @param originalString - Original string with proper casing
   * @param vocabLocation - Metadata about where the string was found
   */
  protected addToExtractedMap(
    extractedMap: Map<string, ExtractedString>,
    key: string,
    originalString: string,
    vocabLocation: VocabLocation
  ): void {
    const existing = extractedMap.get(key);
    if (existing) {
      existing.vocabPlacementMeta.vocabLocations.push(vocabLocation);
    } else {
      extractedMap.set(key, {
        string: originalString, // Use original casing for the string value
        vocabPlacementMeta: {
          vocabLocations: [vocabLocation],
        },
      });
    }
  }

  /**
   * Generate output path for translated file based on input file extension
   * @param filePath - Original file path
   * @returns Path for the translated output file
   */
  protected generateTranslatedOutputPath(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return filePath + '_translated';
    }

    const basePath = filePath.substring(0, lastDotIndex);
    const extension = filePath.substring(lastDotIndex);
    return `${basePath}_translated${extension}`;
  }
}

export { BaseProcessor };
