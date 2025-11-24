import { AACTree } from '../../core/treeStructure';
import * as fs from 'fs';
import * as path from 'path';

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
  // No known image entry paths for Snap yet
  return new Set<string>();
}

export function openImage(_dbOrFile: string | Buffer, _entryPath: string): Buffer | null {
  // Not implemented for Snap yet
  return null;
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
