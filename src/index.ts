// Main entry point for AACProcessors library
export * from './core/treeStructure';
export * from './core/baseProcessor';
export * from './processors';

import { BaseProcessor } from './core/baseProcessor';
import { DotProcessor } from './processors/dotProcessor';
import { OpmlProcessor } from './processors/opmlProcessor';
import { ObfProcessor } from './processors/obfProcessor';
import { GridsetProcessor } from './processors/gridsetProcessor';
import { SnapProcessor } from './processors/snapProcessor';
import { TouchChatProcessor } from './processors/touchchatProcessor';
import { ApplePanelsProcessor } from './processors/applePanelsProcessor';

/**
 * Factory function to get the appropriate processor for a file extension
 * @param filePathOrExtension - File path or extension (e.g., '.dot', '/path/to/file.obf')
 * @returns The appropriate processor instance
 * @throws Error if the file extension is not supported
 */
export function getProcessor(filePathOrExtension: string): BaseProcessor {
  // Extract extension from file path
  const extension = filePathOrExtension.includes('.') 
    ? filePathOrExtension.substring(filePathOrExtension.lastIndexOf('.'))
    : filePathOrExtension;

  switch (extension.toLowerCase()) {
    case '.dot':
      return new DotProcessor();
    case '.opml':
      return new OpmlProcessor();
    case '.obf':
    case '.obz':
      return new ObfProcessor();
    case '.gridset':
      return new GridsetProcessor();
    case '.spb':
    case '.sps':
      return new SnapProcessor();
    case '.ce':
      return new TouchChatProcessor();
    case '.plist':
      return new ApplePanelsProcessor();
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }
}

/**
 * Get all supported file extensions
 * @returns Array of supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['.dot', '.opml', '.obf', '.obz', '.gridset', '.spb', '.sps', '.ce', '.plist'];
}

/**
 * Check if a file extension is supported
 * @param extension - File extension to check
 * @returns True if the extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  return getSupportedExtensions().includes(extension.toLowerCase());
}
