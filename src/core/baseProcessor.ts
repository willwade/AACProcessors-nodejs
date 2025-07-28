import { AACTree } from "./treeStructure";

abstract class BaseProcessor {
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
}

export { BaseProcessor };
