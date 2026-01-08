import { XMLBuilder } from 'fast-xml-parser';
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
} from '../../core/treeStructure';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { dotNetTicksToDate } from '../../utils/dotnetTicks';
import { getZipEntriesWithPassword, resolveGridsetPasswordFromEnv } from './password';

function normalizeZipPath(p: string): string {
  const unified = p.replace(/\\/g, '/');
  try {
    return unified.normalize('NFC');
  } catch {
    return unified;
  }
}

/**
 * Build a map of button IDs to resolved image entry paths for a specific page.
 * Helpful when rewriting zip entry names or validating images referenced in a grid.
 */
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

/**
 * Collect all image entries referenced across every page in a tree.
 * Returns normalized zip entry paths that should be preserved when pruning images.
 */
export function getAllowedImageEntries(tree: AACTree): Set<string> {
  const out = new Set<string>();
  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((btn: AACButton) => {
      if (btn.resolvedImageEntry) out.add(normalizeZipPath(String(btn.resolvedImageEntry)));
    });
  });
  return out;
}

/**
 * Read an image entry from a gridset zip by path.
 * @param gridsetBuffer Gridset archive contents
 * @param entryPath Entry name inside the zip
 * @returns Image data buffer or null if not found
 */
export async function openImage(
  gridsetBuffer: Uint8Array,
  entryPath: string,
  password = resolveGridsetPasswordFromEnv()
): Promise<Uint8Array | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSZip = require('jszip') as typeof import('jszip');
    const zip = await JSZip.loadAsync(gridsetBuffer);
    const entries = getZipEntriesWithPassword(zip, password);
    const want = normalizeZipPath(entryPath);
    const entry = entries.find((e) => normalizeZipPath(e.entryName) === want);
    if (!entry) return null;
    const data = await entry.getData();
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(data);
    }
    return data;
  } catch (error) {
    return null;
  }
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

/**
 * Grid3 user data path information
 */
export interface Grid3UserPath {
  userName: string;
  langCode: string;
  basePath: string;
  historyDbPath: string;
}

export interface Grid3VocabularyPath {
  userName: string;
  gridsetPath: string;
}

export interface Grid3HistoryEntry {
  id: string;
  content: string;
  occurrences: Array<{
    timestamp: Date;
    latitude?: number | null;
    longitude?: number | null;
    type?: 'button' | 'action' | 'utterance' | 'note' | 'other';
    intent?: AACSemanticIntent | string;
    category?: AACSemanticCategory;
  }>;
  rawXml?: string;
}

/**
 * Get the Windows Common Documents folder path from registry
 * Falls back to default path if registry access fails
 * @returns Path to Common Documents folder
 */
export function getCommonDocumentsPath(): string {
  // Only works on Windows
  if (process.platform !== 'win32') {
    return '';
  }

  try {
    // Query registry for Common Documents path
    const command =
      'REG.EXE QUERY "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders" /V "Common Documents"';
    const output = execSync(command, { encoding: 'utf-8', windowsHide: true });

    // Parse the output to extract the path
    const match = output.match(/Common Documents\s+REG_SZ\s+(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (error) {
    // Registry access failed, fall back to default
  }

  // Default fallback path
  return 'C:\\Users\\Public\\Documents';
}

/**
 * Find all Grid3 user data paths
 * Searches for users and language codes in the Grid3 directory structure
 * C:\Users\Public\Documents\Smartbox\Grid 3\Users\{UserName}\{langCode}\Phrases\history.sqlite
 * Grid set/vocabulary archives live alongside users at:
 * C:\Users\Public\Documents\Smartbox\Grid 3\Users\{UserName}\Grid Sets\
 * @returns Array of Grid3 user path information
 */
export function findGrid3UserPaths(): Grid3UserPath[] {
  const results: Grid3UserPath[] = [];

  // Only works on Windows
  if (process.platform !== 'win32') {
    return results;
  }

  try {
    const commonDocs = getCommonDocumentsPath();
    // Use Windows path joining so tests that mock a Windows platform stay consistent even on POSIX runners
    const grid3BasePath = path.win32.join(commonDocs, 'Smartbox', 'Grid 3', 'Users');

    // Check if Grid3 Users directory exists
    if (!fs.existsSync(grid3BasePath)) {
      return results;
    }

    // Enumerate users
    const users = fs.readdirSync(grid3BasePath, { withFileTypes: true });

    for (const userDir of users) {
      if (!userDir.isDirectory()) continue;

      const userName = userDir.name;
      const userPath = path.win32.join(grid3BasePath, userName);

      // Enumerate language codes
      const langDirs = fs.readdirSync(userPath, { withFileTypes: true });

      for (const langDir of langDirs) {
        if (!langDir.isDirectory()) continue;

        const langCode = langDir.name;
        const basePath = path.win32.join(userPath, langCode);
        const historyDbPath = path.win32.join(basePath, 'Phrases', 'history.sqlite');

        // Only include if history database exists
        if (fs.existsSync(historyDbPath)) {
          results.push({
            userName,
            langCode,
            basePath,
            historyDbPath,
          });
        }
      }
    }
  } catch (error) {
    // Silently fail if directory access fails
  }

  return results;
}

/**
 * Find all Grid3 history database paths
 * Convenience method that returns just the database file paths
 * @returns Array of paths to history.sqlite files
 */
export function findGrid3HistoryDatabases(): string[] {
  return findGrid3UserPaths().map((userPath) => userPath.historyDbPath);
}

/**
 * Get Grid 3 users (alias of findGrid3UserPaths for clarity)
 */
export function findGrid3Users(): Grid3UserPath[] {
  return findGrid3UserPaths();
}

/**
 * Find Grid 3 gridset/vocabulary files for each user
 * @param userName Optional user filter; matches case-insensitively
 * @returns Array of user/gridset path pairs
 */
export function findGrid3Vocabularies(userName?: string): Grid3VocabularyPath[] {
  const results: Grid3VocabularyPath[] = [];

  if (process.platform !== 'win32') {
    return results;
  }

  const commonDocs = getCommonDocumentsPath();
  const grid3BasePath = path.win32.join(commonDocs, 'Smartbox', 'Grid 3', 'Users');

  if (!fs.existsSync(grid3BasePath)) {
    return results;
  }

  const normalizedUser = userName?.toLowerCase();
  const users = fs.readdirSync(grid3BasePath, { withFileTypes: true });

  for (const userDir of users) {
    if (!userDir.isDirectory()) continue;
    if (normalizedUser && userDir.name.toLowerCase() !== normalizedUser) continue;

    const userRoot = path.win32.join(grid3BasePath, userDir.name);
    const gridSetsDir = path.win32.join(userRoot, 'Grid Sets');
    if (!fs.existsSync(gridSetsDir)) continue;

    const entries = fs.readdirSync(gridSetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.gridset' || ext === '.gridsetx' || ext === '.grd' || ext === '.grdl') {
        results.push({
          userName: userDir.name,
          gridsetPath: path.win32.join(gridSetsDir, entry.name),
        });
      }
    }
  }

  return results;
}

/**
 * Find a specific user's Grid 3 history database
 * @param userName User name to search for (case-insensitive)
 * @param langCode Optional language code filter (case-insensitive)
 * @returns Path to history.sqlite or null if not found
 */
export function findGrid3UserHistory(userName: string, langCode?: string): string | null {
  if (!userName) return null;

  const normalizedUser = userName.toLowerCase();
  const normalizedLang = langCode?.toLowerCase();

  const match = findGrid3UserPaths().find(
    (u) =>
      u.userName.toLowerCase() === normalizedUser &&
      (!normalizedLang || u.langCode.toLowerCase() === normalizedLang)
  );

  return match?.historyDbPath ?? null;
}

/**
 * Check whether Grid 3 appears to be installed (Windows only)
 */
export function isGrid3Installed(): boolean {
  if (process.platform !== 'win32') return false;
  const commonDocs = getCommonDocumentsPath();
  if (!commonDocs) return false;
  const grid3BasePath = path.win32.join(commonDocs, 'Smartbox', 'Grid 3', 'Users');
  return fs.existsSync(grid3BasePath);
}

function parseGrid3ContentXml(xmlContent: string): string {
  const regex = /<r>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/r>/gis;
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlContent)) !== null) {
    parts.push(match[1]);
  }
  if (parts.length > 0) {
    return parts.join('');
  }
  return xmlContent.replace(/<[^>]+>/g, '').trim();
}

/**
 * Read history events from a Grid 3 history.sqlite database.
 * @param historyDbPath Absolute path to the history database
 * @returns Parsed history entries grouped by phrase
 */
export function readGrid3History(historyDbPath: string): Grid3HistoryEntry[] {
  if (!fs.existsSync(historyDbPath)) return [];

  const db = new Database(historyDbPath, { readonly: true });
  const rows = db
    .prepare(
      `
      SELECT p.Id as PhraseId,
             p.Text as TextValue,
             p.Content as ContentXml,
             ph.Timestamp as TickValue,
             ph.Latitude as Latitude,
             ph.Longitude as Longitude
      FROM PhraseHistory ph
      INNER JOIN Phrases p ON p.Id = ph.PhraseId
      WHERE ph.Timestamp <> 0
      ORDER BY ph.Timestamp ASC
    `
    )
    .all() as Array<{
    PhraseId: number;
    TextValue?: string;
    ContentXml?: string;
    TickValue?: number | bigint;
    Latitude?: number;
    Longitude?: number;
  }>;

  const events = new Map<number, Grid3HistoryEntry>();

  for (const row of rows) {
    const phraseId: number = row.PhraseId;
    const rawContentSource = [row.ContentXml, row.TextValue].find((candidate) => {
      if (candidate === null || candidate === undefined) return false;
      const asString = String(candidate);
      return asString.trim().length > 0;
    });
    if (rawContentSource === undefined) {
      continue; // Skip history rows with no usable text content
    }

    const rawContentText = String(rawContentSource);
    const contentText = parseGrid3ContentXml(rawContentText);
    const rawXml =
      typeof row.ContentXml === 'string' && row.ContentXml.trim().length > 0
        ? row.ContentXml
        : undefined;
    const entry =
      events.get(phraseId) ??
      ({
        id: `grid:${phraseId}`,
        content: contentText,
        occurrences: [],
        rawXml,
      } as Grid3HistoryEntry);

    entry.occurrences.push({
      timestamp: dotNetTicksToDate(BigInt(row.TickValue ?? 0)),
      latitude: row.Latitude ?? null,
      longitude: row.Longitude ?? null,
      type: 'utterance',
      intent: AACSemanticIntent.SPEAK_TEXT,
      category: AACSemanticCategory.COMMUNICATION,
    });

    events.set(phraseId, entry);
  }

  return Array.from(events.values());
}

/**
 * Convenience wrapper to load history for a specific Grid 3 user/lang combination.
 * @param userName Grid 3 user name (case-insensitive)
 * @param langCode Optional language code to narrow selection (case-insensitive)
 * @returns History entries for that user/language, or empty array if none
 */
export function readGrid3HistoryForUser(userName: string, langCode?: string): Grid3HistoryEntry[] {
  const dbPath = findGrid3UserHistory(userName, langCode);
  if (!dbPath) return [];
  return readGrid3History(dbPath);
}

/**
 * Load all available Grid 3 histories on the machine.
 * @returns Combined history entries from every discovered history.sqlite
 */
export function readAllGrid3History(): Grid3HistoryEntry[] {
  const paths = findGrid3HistoryDatabases();
  return paths.flatMap((p) => readGrid3History(p));
}
