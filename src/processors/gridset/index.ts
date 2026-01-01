/**
 * Grid 3 Enhanced Support Module
 *
 * This module exports all enhanced Grid 3 functionality including:
 * - Cell shape detection and support
 * - Plugin cell type detection (Workspace, LiveCell, AutoContent)
 * - Comprehensive command definitions and detection
 * - Color utilities and style helpers
 * - Image resolution helpers
 */

// Style helpers
export {
  CellBackgroundShape,
  SHAPE_NAMES,
  type Grid3Style,
  DEFAULT_GRID3_STYLES,
  CATEGORY_STYLES,
  createDefaultStylesXml,
  createCategoryStyle,
} from "./styleHelpers";

// Plugin cell type detection
export {
  detectPluginCellType,
  type Grid3PluginMetadata,
  Grid3CellType,
  WORKSPACE_TYPES,
  LIVECELL_TYPES,
  AUTOCONTENT_TYPES,
  getCellTypeDisplayName,
  isWorkspaceCell,
  isLiveCell,
  isAutoContentCell,
  isRegularCell,
} from "./pluginTypes";

// Command definitions and detection
export {
  detectCommand,
  getCommandDefinition,
  getCommandsByPlugin,
  getCommandsByCategory,
  getAllCommandIds,
  getAllPluginIds,
  extractCommandParameters,
  GRID3_COMMANDS,
  type Grid3CommandDefinition,
  type CommandParameter,
  type ExtractedParameters,
  Grid3CommandCategory,
} from "./commands";

// Import for local use in constant definitions
import { getAllCommandIds, getAllPluginIds } from "./commands";
import { CellBackgroundShape } from "./styleHelpers";
import { Grid3CellType } from "./pluginTypes";
import { Grid3CommandCategory } from "./commands";

// Color utilities
export {
  ensureAlphaChannel,
  darkenColor,
  lightenColor,
  hexToRgba,
  rgbaToHex,
} from "./colorUtils";

// Password handling
export {
  resolveGridsetPassword,
  getZipEntriesWithPassword,
  resolveGridsetPasswordFromEnv,
} from "./password";

// Helper functions
export {
  getPageTokenImageMap,
  getAllowedImageEntries,
  openImage,
  generateGrid3Guid,
  createSettingsXml,
  createFileMapXml,
  getCommonDocumentsPath,
  findGrid3UserPaths,
  findGrid3HistoryDatabases,
  findGrid3Vocabularies,
  findGrid3UserHistory,
  findGrid3Users,
  isGrid3Installed,
  readGrid3History,
  readGrid3HistoryForUser,
  readAllGrid3History,
  type Grid3UserPath,
  type Grid3VocabularyPath,
  type Grid3HistoryEntry,
} from "./helpers";

// Symbol library handling
export {
  parseSymbolReference,
  isSymbolReference,
  resolveSymbolReference,
  getAvailableSymbolLibraries,
  getSymbolLibraryInfo,
  extractSymbolReferences,
  analyzeSymbolUsage,
  createSymbolReference,
  getSymbolLibraryName,
  getSymbolPath,
  isKnownSymbolLibrary,
  getSymbolLibraryDisplayName,
  getDefaultGrid3Path,
  getSymbolLibrariesDir,
  getSymbolSearchIndexesDir,
  symbolReferenceToFilename,
  SYMBOL_LIBRARIES,
  type SymbolReference,
  type SymbolLibraryInfo,
  type SymbolResolutionOptions,
  type SymbolResolutionResult,
  type SymbolUsageStats,
  type SymbolLibraryName,
} from "./symbols";

// Backward compatibility aliases for old function names
export { getSymbolsDir, getSymbolSearchDir } from "./symbols";

// Image resolution
export {
  resolveGrid3CellImage,
  isSymbolLibraryReference,
  parseImageSymbolReference,
} from "./resolver";

// Symbol extraction and conversion
export {
  extractButtonImage,
  extractSymbolLibraryImage,
  convertToAstericsImage,
  analyzeSymbolExtraction,
  suggestExtractionStrategy,
  exportSymbolReferencesToCsv,
  createSymbolManifest,
  type ExtractedImage,
  type SymbolExtractionOptions,
  type SymbolReport,
  type SymbolManifest,
} from "./symbolExtractor";

// Symbol search functionality
export {
  parsePixFile,
  loadSearchIndexes,
  searchSymbols,
  searchSymbolsWithReferences,
  getSymbolFilename,
  getSymbolDisplayName,
  getAllSearchTerms,
  getSearchSuggestions,
  countLibrarySymbols,
  getSymbolSearchStats,
  type SymbolSearchResult,
  type SymbolSearchOptions,
  type LibrarySearchIndex,
  type SymbolSearchStats,
} from "./symbolSearch";

/**
 * Get all Grid 3 command IDs as a readonly array
 * Useful for validation and autocomplete
 */
export const GRID3_COMMAND_IDS = Object.freeze(getAllCommandIds());

/**
 * Get all Grid 3 plugin IDs as a readonly array
 */
export const GRID3_PLUGIN_IDS = Object.freeze(getAllPluginIds());

/**
 * Grid 3 cell shapes enum values
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const GRID3_CELL_SHAPES = Object.freeze(
  Object.values(CellBackgroundShape),
);

/**
 * Grid 3 cell types enum values
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const GRID3_CELL_TYPES = Object.freeze(Object.values(Grid3CellType));

/**
 * Grid 3 command categories enum values
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const GRID3_COMMAND_CATEGORIES = Object.freeze(
  Object.values(Grid3CommandCategory),
);
