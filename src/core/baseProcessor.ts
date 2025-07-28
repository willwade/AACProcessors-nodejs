import {
  AACTree,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
} from "./treeStructure";

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
    outputPath: string,
  ): Buffer;

  // Save tree structure back to file/buffer
  abstract saveFromTree(tree: AACTree, outputPath: string): void;

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
        const toolbarNavigationIntents = [
          AACSemanticIntent.GO_BACK,
          AACSemanticIntent.GO_HOME,
        ];
        if (toolbarNavigationIntents.includes(intent)) {
          return true;
        }
      }

      // Filter system/text editing buttons by category
      if (
        this.options.excludeSystemButtons &&
        category === AACSemanticCategory.TEXT_EDITING
      ) {
        return true;
      }

      // Filter specific system intents
      if (this.options.excludeSystemButtons) {
        const systemIntents = [
          AACSemanticIntent.DELETE_WORD,
          AACSemanticIntent.DELETE_CHARACTER,
          AACSemanticIntent.CLEAR_TEXT,
          AACSemanticIntent.COPY_TEXT,
        ];
        if (systemIntents.includes(intent)) {
          return true;
        }
      }
    }

    // Fallback: check button labels for common navigation/system terms
    // Only apply label-based filtering if button doesn't have semantic actions
    if (
      !button.semanticAction &&
      (this.options.excludeNavigationButtons ||
        this.options.excludeSystemButtons)
    ) {
      const label = button.label?.toLowerCase() || "";
      const message = button.message?.toLowerCase() || "";

      // More conservative navigation terms (exclude "more" since it's often used for legitimate page navigation)
      const navigationTerms = ["back", "home", "menu", "settings"];
      const systemTerms = ["delete", "clear", "copy", "paste", "undo", "redo"];

      if (
        this.options.excludeNavigationButtons &&
        navigationTerms.some(
          (term) => label.includes(term) || message.includes(term),
        )
      ) {
        return true;
      }

      if (
        this.options.excludeSystemButtons &&
        systemTerms.some(
          (term) => label.includes(term) || message.includes(term),
        )
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
}

export { BaseProcessor };
