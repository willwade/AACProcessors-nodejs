import { AACTree } from '../../core/treeStructure';

// Minimal TouchChat helpers (stubs) to align with processors/<engine>/helpers pattern
// NOTE: TouchChat buttons currently do not populate resolvedImageEntry; these helpers
// therefore return empty collections until image resolution is implemented.

export function getPageTokenImageMap(tree: AACTree, pageId: string): Map<string, string> {
  const map = new Map<string, string>();
  const page = tree.getPage(pageId);
  if (!page) return map;
  for (const btn of page.buttons) {
    if (btn.resolvedImageEntry) map.set(btn.id, String(btn.resolvedImageEntry));
  }
  return map;
}

export function getAllowedImageEntries(_tree: AACTree): Set<string> {
  // No known image entry paths for TouchChat yet
  return new Set<string>();
}

export function openImage(_ceFile: string | Buffer, _entryPath: string): Buffer | null {
  // Not implemented for TouchChat yet
  return null;
}
