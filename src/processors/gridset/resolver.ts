function normalizeZipPathLocal(p: string): string {
  const unified = p.replace(/\\/g, '/');
  try {
    return unified.normalize('NFC');
  } catch {
    return unified;
  }
}

function listZipEntries(zip: any): string[] {
  try {
    const raw: unknown = typeof zip?.getEntries === 'function' ? zip.getEntries() : [];
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
  }
): string | null {
  const { baseDir, dynamicFiles } = args;
  const imageName = args.imageName?.trim();
  const x = args.x;
  const y = args.y;

  const entries = new Set(listZipEntries(zip));
  const has = (p: string): boolean => entries.has(normalizeZipPathLocal(p));

  // Built-in resource like [grid3x]...
  if (imageName && imageName.startsWith('[')) {
    if (args.builtinHandler) {
      const mapped = args.builtinHandler(imageName);
      if (mapped) return mapped;
    }
    return null;
  }

  // Direct declared file
  if (imageName) {
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
      for (const c of candidates) {
        if (has(c)) return c;
      }
    }
  }

  return null;
}
