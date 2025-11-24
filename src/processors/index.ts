export { ApplePanelsProcessor } from './applePanelsProcessor';
export { DotProcessor } from './dotProcessor';
export { ExcelProcessor } from './excelProcessor';
export { GridsetProcessor } from './gridsetProcessor';
export { ObfProcessor } from './obfProcessor';
export { OpmlProcessor } from './opmlProcessor';
export { SnapProcessor } from './snapProcessor';
export { TouchChatProcessor } from './touchchatProcessor';
export { AstericsGridProcessor } from './astericsGridProcessor';

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
  type Grid3UserPath,
  type Grid3VocabularyPath,
} from './gridset/helpers';
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
} from './gridset/helpers';
export { resolveGrid3CellImage } from './gridset/resolver';

// Gridset (Grid 3) wordlist helpers
export {
  createWordlist,
  extractWordlists,
  updateWordlist,
  wordlistToXml,
  type WordList,
  type WordListItem,
} from './gridset/wordlistHelpers';

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
} from './gridset/colorUtils';

// Gridset (Grid 3) style helpers
export {
  DEFAULT_GRID3_STYLES,
  CATEGORY_STYLES,
  createDefaultStylesXml,
  createCategoryStyle,
} from './gridset/styleHelpers';

// Re-export ensureAlphaChannel from styleHelpers for backward compatibility
export { ensureAlphaChannel as ensureAlphaChannelFromStyles } from './gridset/styleHelpers';

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
  type SnapPackagePath,
  type SnapUserInfo,
} from './snap/helpers';

// TouchChat helpers (stubs)
export {
  getPageTokenImageMap as getTouchChatPageTokenImageMap,
  getAllowedImageEntries as getTouchChatAllowedImageEntries,
  openImage as openTouchChatImage,
} from './touchchat/helpers';
