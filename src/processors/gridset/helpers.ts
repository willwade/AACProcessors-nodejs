import AdmZip from 'adm-zip';
import { XMLBuilder } from 'fast-xml-parser';
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

/**
 * Generate a random GUID for Grid3 elements
 * Grid3 uses GUIDs for grid identification
 * @returns A UUID v4-like string in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateGrid3Guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create Grid3 settings XML with start grid and common settings
 * @param startGrid - Name of the grid to start on
 * @param options - Optional settings (scan, hover, language, etc.)
 * @returns XML string for Settings.xml
 */
export function createSettingsXml(
  startGrid: string,
  options?: {
    scanEnabled?: boolean;
    scanTimeoutMs?: number;
    hoverEnabled?: boolean;
    hoverTimeoutMs?: number;
    mouseclickEnabled?: boolean;
    language?: string;
  }
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const settingsData = {
    GridSetSettings: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      StartGrid: startGrid,
      ScanEnabled: options?.scanEnabled?.toString() ?? 'false',
      ScanTimeoutMs: options?.scanTimeoutMs?.toString() ?? '2000',
      HoverEnabled: options?.hoverEnabled?.toString() ?? 'false',
      HoverTimeoutMs: options?.hoverTimeoutMs?.toString() ?? '1000',
      MouseclickEnabled: options?.mouseclickEnabled?.toString() ?? 'true',
      Language: options?.language ?? 'en-US',
    },
  };

  return builder.build(settingsData);
}

/**
 * Create Grid3 FileMap.xml content
 * @param grids - Array of grid configurations with name and path
 * @returns XML string for FileMap.xml
 */
export function createFileMapXml(
  grids: Array<{ name: string; path: string; dynamicFiles?: string[] }>
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const entries = grids.map((grid) => ({
    '@_StaticFile': grid.path,
    ...(grid.dynamicFiles && grid.dynamicFiles.length > 0
      ? { DynamicFiles: { File: grid.dynamicFiles } }
      : {}),
  }));

  const fileMapData = {
    FileMap: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      Entries: {
        Entry: entries,
      },
    },
  };

  return builder.build(fileMapData);
}
