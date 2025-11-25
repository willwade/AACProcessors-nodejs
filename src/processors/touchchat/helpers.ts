import { AACTree } from '../../core/treeStructure';

// Minimal TouchChat helpers (stubs) to align with processors/<engine>/helpers pattern
// NOTE: TouchChat buttons currently do not populate resolvedImageEntry; these helpers
// therefore return empty collections until image resolution is implemented.

/**
 * Build a map of button IDs to resolved image entry strings for a page.
 * Returns an empty map when no images are present.
 */
export function getPageTokenImageMap(tree: AACTree, pageId: string): Map<string, string> {
  const map = new Map<string, string>();
  const page = tree.getPage(pageId);
  if (!page) return map;
  for (const btn of page.buttons) {
    if (btn.resolvedImageEntry) map.set(btn.id, String(btn.resolvedImageEntry));
  }
  return map;
}

/**
 * Collect all referenced image entries across the tree.
 * Currently empty until TouchChat image resolution is implemented.
 */
export function getAllowedImageEntries(_tree: AACTree): Set<string> {
  return new Set<string>();
}

/**
 * Read a binary asset from a .ce file.
 * Not implemented yet; provided for API symmetry with other processors.
 */
export function openImage(_ceFile: string | Buffer, _entryPath: string): Buffer | null {
  return null;
}
