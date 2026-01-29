import { isSymbolReference, parseSymbolReference } from './symbols';

function normalizeZipPathLocal(p: string): string {
  const unified = p.replace(/\\/g, '/');
  try {
    return unified.normalize('NFC');
  } catch {
    return unified;
  }
}

function listZipEntries(zip: any, zipEntries?: any[]): string[] {
  try {
    const raw: unknown =
      Array.isArray(zipEntries) && zipEntries.length > 0
        ? zipEntries
        : typeof zip?.getEntries === 'function'
          ? zip.getEntries()
          : [];
    let entries: unknown[] = [];
    if (Array.isArray(raw)) entries = raw;
    const arr = entries as Array<{ entryName: unknown }>;
    return arr.map((e) => normalizeZipPathLocal(String(e.entryName)));
  } catch {
    return [];
  }
}

function extFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const m = name.match(/\.([A-Za-z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : undefined;
}

function joinBaseDir(baseDir: string, leaf: string): string {
  const base = normalizeZipPathLocal(baseDir).replace(/\/?$/, '/');
  return normalizeZipPathLocal(base + leaf.replace(/^\//, ''));
}

export function resolveGrid3CellImage(
  zip: any,
  args: {
    baseDir: string;
    imageName?: string;
    x?: number;
    y?: number;
    dynamicFiles?: string[];
    builtinHandler?: (name: string) => string | null;
  },
  zipEntries?: any[]
): string | null {
  const { baseDir, dynamicFiles } = args;
  const imageName = args.imageName?.trim();
  const x = args.x;
  const y = args.y;

  const entries = new Set(listZipEntries(zip, zipEntries));
  const has = (p: string): boolean => entries.has(normalizeZipPathLocal(p));

  // Debug logging for cells that fail to resolve
  const shouldDebug = imageName?.startsWith('-') && x !== undefined && y !== undefined;
  const debugLog = (msg: string) => {
    if (shouldDebug) {
      console.log(`[Resolver] ${baseDir} (${x},${y}) "${imageName}": ${msg}`);
    }
  };

  // Built-in resource like [grid3x]... (old format, not symbol library)
  // Check this BEFORE general symbol references to avoid misclassification
  if (imageName && imageName.startsWith('[')) {
    // Check if it's a symbol library reference like [widgit]/food/apple.png
    // Symbol library references have a path after the library name
    if (isSymbolReference(imageName)) {
      const parsed = parseSymbolReference(imageName);
      // If it's grid3x, it's a built-in resource, not a symbol library
      if (parsed.library !== 'grid3x') {
        // Symbol library references are NOT stored as files in the gridset
        // They are resolved from the external Grid 3 installation
        // Return null to indicate this is an external symbol reference
        return null;
      }
    }
    // For grid3x and other built-in resources, use the builtinHandler
    if (args.builtinHandler) {
      const mapped = args.builtinHandler(imageName);
      if (mapped) return mapped;
    }
    return null;
  }

  // Direct declared file
  if (imageName) {
    // Check for partial image names that start with '-' (common in Grid3)
    // These are coordinate-based suffixes like "-0-text-0.png" that need
    // to be prefixed with the cell coordinates
    if (imageName.startsWith('-') && x != null && y != null) {
      const coordPrefixed = joinBaseDir(baseDir, `${x}-${y}${imageName}`);
      debugLog(`trying coord-prefixed: ${coordPrefixed}, found: ${has(coordPrefixed)}`);
      if (has(coordPrefixed)) return coordPrefixed;
    }

    const p1 = joinBaseDir(baseDir, imageName);
    if (has(p1)) return p1;
    const p2 = joinBaseDir(baseDir, `Images/${imageName}`);
    if (has(p2)) return p2;
  }

  // FileMap.xml dynamic files
  if (x != null && y != null && dynamicFiles && dynamicFiles.length > 0) {
    const prefix = joinBaseDir(baseDir, `${x}-${y}-`);
    const matches = dynamicFiles
      .map((f) => normalizeZipPathLocal(f))
      .filter((f) => f.startsWith(prefix));
    if (matches.length > 0) {
      const preferred = matches.find((m) => /text/i.test(m)) || matches[0];
      if (has(preferred)) return preferred;
    }
  }

  // Coordinate-based guesses
  if (x != null && y != null) {
    const ext = extFromName(imageName);
    if (ext) {
      const c1 = joinBaseDir(baseDir, `${x}-${y}-0-text-0${ext}`);
      if (has(c1)) return c1;
      const c2 = joinBaseDir(baseDir, `${x}-${y}${ext}`);
      if (has(c2)) return c2;
    } else {
      const candidates = [
        `${x}-${y}-0-text-0.jpeg`,
        `${x}-${y}-0-text-0.jpg`,
        `${x}-${y}-0-text-0.png`,
        `${x}-${y}.jpeg`,
        `${x}-${y}.jpg`,
        `${x}-${y}.png`,
      ].map((n) => joinBaseDir(baseDir, n));
      debugLog(`trying candidates: ${candidates.filter(has).join(', ') || 'none found'}`);
      for (const c of candidates) {
        if (has(c)) return c;
      }
    }
  }

  debugLog(`NOT FOUND - returning null`);
  return null;
}

/**
 * Check if an image reference is a symbol library reference
 * @param imageName - Image reference from Grid 3
 * @returns True if it's a symbol library reference
 */
export function isSymbolLibraryReference(imageName?: string): boolean {
  if (!imageName) return false;
  return isSymbolReference(imageName.trim());
}

/**
 * Parse a symbol library reference from an image name
 * @param imageName - Image reference from Grid 3
 * @returns Parsed reference or null if not a symbol reference
 */
export function parseImageSymbolReference(
  imageName: string
): ReturnType<typeof parseSymbolReference> | null {
  if (!isSymbolLibraryReference(imageName)) {
    return null;
  }
  return parseSymbolReference(imageName.trim());
}
