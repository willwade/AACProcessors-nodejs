export { ApplePanelsProcessor } from "./applePanelsProcessor";
export { DotProcessor } from "./dotProcessor";
export { ExcelProcessor } from "./excelProcessor";
export { GridsetProcessor } from "./gridsetProcessor";
export { ObfProcessor } from "./obfProcessor";
export { OpmlProcessor } from "./opmlProcessor";
export { SnapProcessor } from "./snapProcessor";
export { TouchChatProcessor } from "./touchchatProcessor";
export { AstericsGridProcessor } from "./astericsGridProcessor";
export { ObfsetProcessor } from "./obfsetProcessor";

// Gridset (Grid 3) helpers
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
  findGrid3Users,
  findGrid3Vocabularies,
  findGrid3UserHistory,
  isGrid3Installed,
  readGrid3History,
  readGrid3HistoryForUser,
  readAllGrid3History,
  type Grid3UserPath,
  type Grid3VocabularyPath,
  type Grid3HistoryEntry,
} from "./gridset/helpers";
export {
  getPageTokenImageMap as getGridsetPageTokenImageMap,
  getAllowedImageEntries as getGridsetAllowedImageEntries,
  openImage as openGridsetImage,
  generateGrid3Guid as generateGridsetGuid,
  createSettingsXml as createGridsetSettingsXml,
  createFileMapXml as createGridsetFileMapXml,
  getCommonDocumentsPath as getGridsetCommonDocumentsPath,
  findGrid3UserPaths as findGridsetUserPaths,
  findGrid3HistoryDatabases as findGridsetHistoryDatabases,
  findGrid3Users as findGridsetUsers,
  findGrid3Vocabularies as findGridsetVocabularies,
  findGrid3UserHistory as findGridsetUserHistory,
  isGrid3Installed as isGridsetInstalled,
  readGrid3History as readGridsetHistory,
  readGrid3HistoryForUser as readGridsetHistoryForUser,
  readAllGrid3History as readAllGridsetHistory,
} from "./gridset/helpers";
export { resolveGrid3CellImage } from "./gridset/resolver";

// Gridset (Grid 3) wordlist helpers
export {
  createWordlist,
  extractWordlists,
  updateWordlist,
  wordlistToXml,
  type WordList,
  type WordListItem,
} from "./gridset/wordlistHelpers";
export {
  resolveGridsetPassword,
  resolveGridsetPasswordFromEnv,
} from "./gridset/password";

// Gridset (Grid 3) color utilities
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
} from "./gridset/colorUtils";

// Gridset (Grid 3) style helpers
export {
  DEFAULT_GRID3_STYLES,
  CATEGORY_STYLES,
  createDefaultStylesXml,
  createCategoryStyle,
  CellBackgroundShape,
  SHAPE_NAMES,
} from "./gridset/styleHelpers";

// Re-export ensureAlphaChannel from styleHelpers for backward compatibility
export { ensureAlphaChannel as ensureAlphaChannelFromStyles } from "./gridset/styleHelpers";

// Gridset (Grid 3) plugin cell type detection
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
} from "./gridset/pluginTypes";

// Gridset (Grid 3) command definitions and detection
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
} from "./gridset/commands";

// Gridset (Grid 3) enhanced index - re-export everything
export * from "./gridset/index";

// Gridset (Grid 3) symbol library handling
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
} from "./gridset/symbols";
export {
  isSymbolLibraryReference,
  parseImageSymbolReference,
} from "./gridset/resolver";

// Backward compatibility
export { getSymbolsDir, getSymbolSearchDir } from "./gridset/symbols";

// Gridset (Grid 3) symbol extraction for conversion
export {
  extractButtonImage,
  extractSymbolLibraryImage,
  convertToAstericsImage,
  analyzeSymbolExtraction,
  suggestExtractionStrategy,
  exportSymbolReferencesToCsv,
  createSymbolManifest,
} from "./gridset/symbolExtractor";

// Gridset (Grid 3) symbol search
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
} from "./gridset/symbolSearch";

// Snap helpers
export {
  getPageTokenImageMap as getSnapPageTokenImageMap,
  getAllowedImageEntries as getSnapAllowedImageEntries,
  openImage as openSnapImage,
  findSnapPackages,
  findSnapPackagePath,
  findSnapUsers,
  findSnapUserVocabularies,
  findSnapUserHistory,
  isSnapInstalled,
  readSnapUsage,
  readSnapUsageForUser,
  type SnapPackagePath,
  type SnapUserInfo,
  type SnapUsageEntry,
} from "./snap/helpers";

// TouchChat helpers (stubs)
export {
  getPageTokenImageMap as getTouchChatPageTokenImageMap,
  getAllowedImageEntries as getTouchChatAllowedImageEntries,
  openImage as openTouchChatImage,
} from "./touchchat/helpers";
