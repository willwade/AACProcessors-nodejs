import AdmZip from 'adm-zip';
import { AACTree, AACPage, AACButton } from '../../core/treeStructure';

function normalizeZipPath(p: string): string {
  const unified = p.replace(/\\/g, '/');
  try {
    return unified.normalize('NFC');
  } catch {
    return unified;
  }
}

export function getPageTokenImageMap(tree: AACTree, pageId: string): Map<string, string> {
  const map = new Map<string, string>();
  const page: AACPage | undefined = tree.getPage(pageId);
  if (!page) return map;
  for (const btn of page.buttons) {
    if (btn.resolvedImageEntry) {
      map.set(btn.id, normalizeZipPath(String(btn.resolvedImageEntry)));
    }
  }
  return map;
}

export function getAllowedImageEntries(tree: AACTree): Set<string> {
  const out = new Set<string>();
  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((btn: AACButton) => {
      if (btn.resolvedImageEntry) out.add(normalizeZipPath(String(btn.resolvedImageEntry)));
    });
  });
  return out;
}

export function openImage(gridsetBuffer: Buffer, entryPath: string): Buffer | null {
  const zip = new AdmZip(gridsetBuffer);
  const want = normalizeZipPath(entryPath);
  const entry = zip.getEntries().find((e) => normalizeZipPath(e.entryName) === want);
  if (!entry) return null;
  return entry.getData();
}
