/**
 * AACProcessors Browser Entry
 *
 * Browser-safe exports only (no Node-only dependencies).
 *
 * **NOTE: Gridset .gridsetx files**
 * GridsetProcessor supports regular `.gridset` files in browser.
 * Encrypted `.gridsetx` files require Node.js for crypto operations and are not supported in browser.
 *
 * **NOTE: SQLite-backed formats**
 * Snap (.sps/.spb) and TouchChat (.ce) require a WASM-backed SQLite engine.
 * Configure `sql.js` in browser builds via `configureSqlJs()` before loading these formats.
 */

// ===================================================================
// CORE TYPES
// ===================================================================
export * from './core/treeStructure';
export * from './core/baseProcessor';
export * from './core/stringCasing';

// ===================================================================
// BROWSER-SAFE PROCESSORS
// ===================================================================
export { DotProcessor } from './processors/dotProcessor';
export { OpmlProcessor } from './processors/opmlProcessor';
export { ObfProcessor } from './processors/obfProcessor';
export { GridsetProcessor } from './processors/gridsetProcessor';
export { NuVoiceProcessor } from './processors/nuvoiceProcessor';
export { SnapProcessor } from './processors/snapProcessor';
export { TouchChatProcessor } from './processors/touchchatProcessor';
export { ApplePanelsProcessor } from './processors/applePanelsProcessor';
export { AstericsGridProcessor } from './processors/astericsGridProcessor';

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

// Metrics namespace (pageset analytics)
export * as Metrics from './metrics';

import { BaseProcessor, ProcessorOptions } from './core/baseProcessor';
import { DotProcessor } from './processors/dotProcessor';
import { OpmlProcessor } from './processors/opmlProcessor';
import { ObfProcessor } from './processors/obfProcessor';
import { GridsetProcessor } from './processors/gridsetProcessor';
import { NuVoiceProcessor } from './processors/nuvoiceProcessor';
import { SnapProcessor } from './processors/snapProcessor';
import { TouchChatProcessor } from './processors/touchchatProcessor';
import { ApplePanelsProcessor } from './processors/applePanelsProcessor';
import { AstericsGridProcessor } from './processors/astericsGridProcessor';
export { configureSqlJs } from './utils/sqlite';

/**
 * Factory function to get the appropriate processor for a file extension
 * @param filePathOrExtension - File path or extension (e.g., '.dot', '/path/to/file.obf')
 * @returns The appropriate processor instance
 * @throws Error if the file extension is not supported
 */
export function getProcessor(
  filePathOrExtension: string,
  options?: ProcessorOptions
): BaseProcessor {
  const extension = filePathOrExtension.includes('.')
    ? filePathOrExtension.substring(filePathOrExtension.lastIndexOf('.'))
    : filePathOrExtension;

  switch (extension.toLowerCase()) {
    case '.dot':
      return new DotProcessor(options);
    case '.opml':
      return new OpmlProcessor(options);
    case '.obf':
    case '.obz':
      return new ObfProcessor(options);
    case '.gridset':
      return new GridsetProcessor(options);
    case '.mti':
      return new NuVoiceProcessor(options);
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
    '.opml',
    '.obf',
    '.obz',
    '.gridset',
    '.mti',
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
