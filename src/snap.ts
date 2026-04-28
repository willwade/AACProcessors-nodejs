/**
 * Snap (Tobii Dynavox) Namespace
 *
 * All Snap-specific utilities, helpers, and types.
 */

// Processor class
export { SnapProcessor } from './processors/snapProcessor';

// === Snap Helpers ===
export {
  getPageTokenImageMap,
  getAllowedImageEntries,
  openImage,
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
} from './processors/snap/helpers';
