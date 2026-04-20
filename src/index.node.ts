/**
 * AACProcessors Library
 *
 * A comprehensive TypeScript library for processing AAC file formats.
 *
 * @module aac-processors
 */

// ===================================================================
// CORE TYPES (always needed)
// ===================================================================
export * from './core/treeStructure';
export * from './core/baseProcessor';
export * from './core/stringCasing';

// ===================================================================
// PROCESSORS (main functionality)
// ===================================================================
export * from './processors';

// ===================================================================
// NAMESPACES
// ===================================================================

// Analytics namespace (usage/history)
export * as Analytics from './analytics';

// Validation namespace
export * as Validation from './validation';

// Metrics namespace (pageset analytics)
export * as Metrics from './metrics';

// Node-only morphology utilities (Grid 3 verbs parser)
export { Grid3VerbsParser } from './utilities/analytics/morphology/grid3VerbsParser';
export { WordFormGenerator } from './utilities/analytics/morphology/wordFormGenerator';

// Processor namespaces (platform-specific utilities)
export * as Gridset from './gridset';
export * as Snap from './snap';
export * as OBF from './obf';
export * as Obfset from './obfset';
export * as TouchChat from './touchchat';
export * as Dot from './dot';
export * as Excel from './excel';
export * as Opml from './opml';
export * as ApplePanels from './applePanels';
export * as AstericsGrid from './astericsGrid';
export * as Translation from './translation';

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

import { BaseProcessor, ProcessorOptions } from './core/baseProcessor';
import { DotProcessor } from './processors/dotProcessor';
import { ExcelProcessor } from './processors/excelProcessor';
import { OpmlProcessor } from './processors/opmlProcessor';
import { ObfProcessor } from './processors/obfProcessor';
import { GridsetProcessor } from './processors/gridsetProcessor';
import { SnapProcessor } from './processors/snapProcessor';
import { TouchChatProcessor } from './processors/touchchatProcessor';
import { ApplePanelsProcessor } from './processors/applePanelsProcessor';
import { AstericsGridProcessor } from './processors/astericsGridProcessor';
import { ObfsetProcessor } from './processors/obfsetProcessor';

/**
 * Factory function to get the appropriate processor for a file extension
 * @param filePathOrExtension - File path or extension (e.g., '.dot', '/path/to/file.obf')
 * @returns The appropriate processor instance
 * @throws Error if the file extension is not supported
 *
 * @example
 * const processor = getProcessor('/path/to/file.gridset');
 * const tree = processor.loadIntoTree('/path/to/file.gridset');
 */
export function getProcessor(
  filePathOrExtension: string,
  options?: ProcessorOptions
): BaseProcessor {
  // Extract extension from file path
  const extension = filePathOrExtension.includes('.')
    ? filePathOrExtension.substring(filePathOrExtension.lastIndexOf('.'))
    : filePathOrExtension;

  switch (extension.toLowerCase()) {
    case '.dot':
      return new DotProcessor(options);
    case '.xlsx':
      return new ExcelProcessor(options);
    case '.opml':
      return new OpmlProcessor(options);
    case '.obf':
    case '.obz':
      return new ObfProcessor(options);
    case '.obfset':
      return new ObfsetProcessor(options);
    case '.gridset':
    case '.gridsetx':
      return new GridsetProcessor(options);
    case '.spb':
    case '.sps':
      return new SnapProcessor(options);
    case '.ce':
      return new TouchChatProcessor(options);
    case '.plist':
      return new ApplePanelsProcessor(options);
    case '.grd':
      return new AstericsGridProcessor(options);
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }
}

/**
 * Get all supported file extensions
 * @returns Array of supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return [
    '.dot',
    '.xlsx',
    '.opml',
    '.obf',
    '.obz',
    '.obfset',
    '.gridset',
    '.gridsetx',
    '.spb',
    '.sps',
    '.ce',
    '.plist',
    '.grd',
  ];
}

/**
 * Check if a file extension is supported
 * @param extension - File extension to check
 * @returns True if the extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  return getSupportedExtensions().includes(extension.toLowerCase());
}
