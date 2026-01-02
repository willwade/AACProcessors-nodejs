/**
 * Gridset (Grid 3) Namespace
 *
 * All Grid 3 / Gridset-specific utilities, helpers, and types.
 * Organized by category for cleaner imports.
 */

// Processor class
export { GridsetProcessor } from './processors/gridsetProcessor';

// === User & File System Helpers ===
export {
  getPageTokenImageMap,
  getAllowedImageEntries,
  openImage,
  getCommonDocumentsPath,
  findGrid3UserPaths,
  findGrid3HistoryDatabases,
  findGrid3Users,
  findGrid3Vocabularies,
  findGrid3UserHistory,
  isGrid3Installed,
  readGrid3History,
  readGrid3HistoryForUser,
  readAllGrid3History,
  generateGrid3Guid,
  createSettingsXml,
  createFileMapXml,
  type Grid3UserPath,
  type Grid3VocabularyPath,
  type Grid3HistoryEntry,
} from './processors/gridset/helpers';

// === Wordlist Management ===
export {
  createWordlist,
  extractWordlists,
  updateWordlist,
  wordlistToXml,
  type WordList,
  type WordListItem,
} from './processors/gridset/wordlistHelpers';

// === Color Utilities ===
export {
  getNamedColor,
  rgbaToHex,
  channelToHex,
  clampColorChannel,
  clampAlpha,
  toHexColor,
  darkenColor,
  normalizeColor,
  ensureAlphaChannel,
} from './processors/gridset/colorUtils';

// === Style Helpers ===
export {
  DEFAULT_GRID3_STYLES,
  CATEGORY_STYLES,
  createDefaultStylesXml,
  createCategoryStyle,
  CellBackgroundShape,
  SHAPE_NAMES,
  ensureAlphaChannel as ensureAlphaChannelFromStyles,
} from './processors/gridset/styleHelpers';

// === Plugin & Workspace Detection ===
export {
  detectPluginCellType,
  getCellTypeDisplayName,
  isWorkspaceCell,
  isLiveCell,
  isAutoContentCell,
  isRegularCell,
  type Grid3PluginMetadata,
  Grid3CellType,
  WORKSPACE_TYPES,
  LIVECELL_TYPES,
  AUTOCONTENT_TYPES,
} from './processors/gridset/pluginTypes';

// === Command Detection ===
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
} from './processors/gridset/commands';

// === Symbol Libraries ===
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
  isSymbolLibraryReference,
  parseImageSymbolReference,
  resolveGrid3CellImage,
  // Backward compatibility
  getSymbolsDir,
  getSymbolSearchDir,
} from './processors/gridset/index';

// === Symbol Extraction ===
export {
  extractButtonImage,
  extractSymbolLibraryImage,
  convertToAstericsImage,
  analyzeSymbolExtraction,
  suggestExtractionStrategy,
  exportSymbolReferencesToCsv,
  createSymbolManifest,
} from './processors/gridset/symbolExtractor';

// === Symbol Search ===
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
} from './processors/gridset/symbolSearch';

// === Password Management ===
export {
  resolveGridsetPassword,
  resolveGridsetPasswordFromEnv,
} from './processors/gridset/password';
