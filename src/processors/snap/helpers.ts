import {
  AACTree,
  AACSemanticCategory,
  AACSemanticIntent,
  AACButton,
} from '../../core/treeStructure';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { dotNetTicksToDate } from '../../utils/dotnetTicks';
import { ProcessorInput } from '../../utils/io';

// Minimal Snap helpers (stubs) to align with processors/<engine>/helpers pattern
// NOTE: Snap buttons currently do not populate resolvedImageEntry; these helpers
// therefore return empty collections until image resolution is implemented.

function collectFiles(
  root: string,
  matcher: (fullPath: string) => boolean,
  maxDepth = 3
): string[] {
  const results = new Set<string>();
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.depth > maxDepth) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch (error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: fullPath, depth: current.depth + 1 });
      } else if (matcher(fullPath)) {
        results.add(fullPath);
      }
    }
  }

  return Array.from(results);
}

/**
 * Build a map of button IDs to resolved image entries for a specific page.
 * Mirrors the Grid helper for consumers that expect image reference data.
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
 * Collect all image entry paths referenced in a Snap tree.
 * Returns the set of symbol identifiers (e.g., "SYM:12345") that are referenced by buttons.
 */
export function getAllowedImageEntries(tree: AACTree): Set<string> {
  const out = new Set<string>();
  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((btn: AACButton) => {
      // Extract image_id from parameters if it exists
      if (btn.parameters?.image_id && typeof btn.parameters.image_id === 'string') {
        out.add(btn.parameters.image_id);
      }
      // Also add resolvedImageEntry if it's a symbol identifier
      if (btn.resolvedImageEntry && typeof btn.resolvedImageEntry === 'string') {
        const entry = btn.resolvedImageEntry;
        if (entry.startsWith('SYM:')) {
          out.add(entry);
        }
      }
    });
  });
  return out;
}

/**
 * Read a binary asset from a Snap pageset.
 * @param dbOrFile Path to Snap .sps/.spb file or Buffer containing the file data
 * @param entryPath Symbol identifier (e.g., "SYM:12345")
 * @returns Image data buffer or null if not found
 */
export function openImage(dbOrFile: ProcessorInput, entryPath: string): Buffer | null {
  let dbPath: string;
  let cleanupNeeded = false;

  // Handle Buffer input by writing to temp file
  if (Buffer.isBuffer(dbOrFile)) {
    if (typeof fs.mkdtempSync !== 'function') {
      return null; // Not in Node environment
    }
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'snap-'));
    dbPath = path.join(tempDir, 'temp.sps');
    fs.writeFileSync(dbPath, dbOrFile);
    cleanupNeeded = true;
  } else if (typeof dbOrFile === 'string') {
    dbPath = dbOrFile;
  } else {
    return null;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });

    // Query PageSetData for the symbol
    const row = db
      .prepare('SELECT Id, Identifier, Data FROM PageSetData WHERE Identifier = ?')
      .get(entryPath) as { Id: number; Identifier: string; Data: Buffer } | undefined;

    if (row && row.Data && row.Data.length > 0) {
      return row.Data;
    }

    return null;
  } catch (error) {
    console.warn(`[Snap helpers] Failed to open image ${entryPath}:`, error);
    return null;
  } finally {
    if (db) {
      db.close();
    }
    if (cleanupNeeded && dbPath) {
      try {
        fs.unlinkSync(dbPath);
        const dir = path.dirname(dbPath);
        fs.rmdirSync(dir);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Snap package path information
 */
export interface SnapPackagePath {
  packageName: string;
  packagePath: string;
}

export interface SnapUserInfo {
  userId: string;
  userPath: string;
  vocabPaths: string[];
}

export interface SnapUsageEntry {
  id: string;
  content: string;
  occurrences: Array<{
    timestamp: Date;
    modeling?: boolean;
    accessMethod?: number | null;
    type?: 'button' | 'action' | 'utterance' | 'note' | 'other';
    buttonId?: string | null;
    intent?: AACSemanticIntent | string;
    category?: AACSemanticCategory;
  }>;
  platform?: {
    label?: string;
    message?: string;
    buttonId?: string;
  };
}

/**
 * Find Tobii Communicator Snap package paths
 * Searches in %LOCALAPPDATA%\Packages for Snap-related packages
 * @param packageNamePattern Optional pattern to filter package names (default: 'TobiiDynavox')
 * @returns Array of Snap package path information
 */
export function findSnapPackages(packageNamePattern = 'TobiiDynavox'): SnapPackagePath[] {
  const results: SnapPackagePath[] = [];

  // Only works on Windows
  if (process.platform !== 'win32') {
    return results;
  }

  try {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
      return results;
    }

    const packagesPath = path.join(localAppData, 'Packages');

    // Check if Packages directory exists
    if (!fs.existsSync(packagesPath)) {
      return results;
    }

    // Enumerate packages
    const packages = fs.readdirSync(packagesPath, { withFileTypes: true });

    for (const packageDir of packages) {
      if (!packageDir.isDirectory()) continue;

      const packageName = packageDir.name;

      // Filter by pattern
      if (packageName.includes(packageNamePattern)) {
        results.push({
          packageName,
          packagePath: path.join(packagesPath, packageName),
        });
      }
    }
  } catch (error) {
    // Silently fail if directory access fails
  }

  return results;
}

/**
 * Find the first Snap package path matching the pattern
 * Convenience method for when you expect only one Snap installation
 * @param packageNamePattern Optional pattern to filter package names (default: 'TobiiDynavox')
 * @returns Path to the first matching Snap package, or null if not found
 */
export function findSnapPackagePath(packageNamePattern = 'TobiiDynavox'): string | null {
  const packages = findSnapPackages(packageNamePattern);
  return packages.length > 0 ? packages[0].packagePath : null;
}

/**
 * Find Snap user directories and their vocab files (.sps/.spb)
 * Typical path:
 * C:\Users\{username}\AppData\Roaming\Tobii Dynavox\Snap Scene\Users\{userId}\
 * @param packageNamePattern Optional package filter (default TobiiDynavox)
 * @returns Array of user info with vocab paths
 */
export function findSnapUsers(packageNamePattern = 'TobiiDynavox'): SnapUserInfo[] {
  const results: SnapUserInfo[] = [];

  if (process.platform !== 'win32') {
    return results;
  }

  const packagePath = findSnapPackagePath(packageNamePattern);
  if (!packagePath) {
    return results;
  }

  const usersRoot = path.join(packagePath, 'LocalState', 'Users');
  if (!fs.existsSync(usersRoot)) {
    return results;
  }

  const entries = fs.readdirSync(usersRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.toLowerCase().startsWith('swiftkey')) continue;

    const userPath = path.join(usersRoot, entry.name);
    const vocabPaths = collectFiles(
      userPath,
      (full) => {
        const ext = path.extname(full).toLowerCase();
        return ext === '.sps' || ext === '.spb';
      },
      2
    );

    results.push({
      userId: entry.name,
      userPath,
      vocabPaths,
    });
  }

  return results;
}

/**
 * Find vocab files for a specific Snap user (or all users)
 * @param userId Optional user identifier filter (case-sensitive directory name)
 * @param packageNamePattern Optional package filter
 * @returns Array of vocab file paths
 */
export function findSnapUserVocabularies(
  userId?: string,
  packageNamePattern = 'TobiiDynavox'
): string[] {
  const users = findSnapUsers(packageNamePattern).filter((u) => !userId || u.userId === userId);
  return users.flatMap((u) => u.vocabPaths);
}

/**
 * Attempt to find history/analytics files for a Snap user by name
 * Currently searches for files containing "history" under the user directory
 * @param userId User identifier (directory name)
 * @param packageNamePattern Optional package filter
 * @returns Array of history file paths (may be empty if not found)
 */
export function findSnapUserHistory(userId: string, packageNamePattern = 'TobiiDynavox'): string[] {
  const user = findSnapUsers(packageNamePattern).find((u) => u.userId === userId);
  if (!user) return [];

  return collectFiles(
    user.userPath,
    (full) => path.basename(full).toLowerCase().includes('history'),
    2
  );
}

/**
 * Check whether TD Snap appears to be installed (Windows only)
 */
export function isSnapInstalled(packageNamePattern = 'TobiiDynavox'): boolean {
  if (process.platform !== 'win32') return false;
  return Boolean(findSnapPackagePath(packageNamePattern));
}

/**
 * Read Snap usage history from a pageset file (.sps/.spb)
 */
export function readSnapUsage(pagesetPath: string): SnapUsageEntry[] {
  if (!fs.existsSync(pagesetPath)) return [];

  const db = new Database(pagesetPath, { readonly: true });

  const tableCheck = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ButtonUsage','Button')"
    )
    .all();
  if (tableCheck.length < 2) return [];

  const rows = db
    .prepare(
      `
      SELECT
        bu.ButtonUniqueId as ButtonId,
        bu.Timestamp as TickValue,
        bu.Modeling as Modeling,
        bu.AccessMethod as AccessMethod,
        b.Label as Label,
        b.Message as Message
      FROM ButtonUsage bu
      LEFT JOIN Button b ON bu.ButtonUniqueId = b.UniqueId
      WHERE bu.Timestamp IS NOT NULL
      ORDER BY bu.Timestamp ASC
    `
    )
    .all() as Array<{
    ButtonId?: string;
    TickValue?: number | bigint;
    Modeling?: number;
    AccessMethod?: number;
    Label?: string;
    Message?: string;
  }>;

  const events = new Map<string, SnapUsageEntry>();

  for (const row of rows) {
    const buttonId: string = row.ButtonId ?? 'unknown';
    const label = row.Label ?? undefined;
    const message = row.Message ?? undefined;
    const content = message || label || '';

    const entry =
      events.get(buttonId) ??
      ({
        id: `snap:${buttonId}`,
        content,
        occurrences: [],
        platform: {
          label,
          message,
          buttonId,
        },
      } as SnapUsageEntry);

    entry.occurrences.push({
      timestamp: dotNetTicksToDate(BigInt(row.TickValue ?? 0)),
      modeling: row.Modeling === 1,
      accessMethod: row.AccessMethod ?? null,
      type: 'button',
      buttonId: row.ButtonId,
      intent: AACSemanticIntent.SPEAK_TEXT,
      category: AACSemanticCategory.COMMUNICATION,
    });

    events.set(buttonId, entry);
  }

  return Array.from(events.values());
}

/**
 * Read Snap usage history for a user (all pagesets)
 */
export function readSnapUsageForUser(
  userId?: string,
  packageNamePattern = 'TobiiDynavox'
): SnapUsageEntry[] {
  const users = findSnapUsers(packageNamePattern).filter((u) => !userId || u.userId === userId);
  const pagesets = users.flatMap((u) => u.vocabPaths);
  return pagesets.flatMap((p) => readSnapUsage(p));
}
