import path from 'path';
import fs from 'fs';
import { extractSymbolReferences } from '../processors/gridset/symbols';

// Dynamic imports for optional dependencies
type Database = typeof import('better-sqlite3');
type AdmZip = typeof import('adm-zip');
type XMLParser = typeof import('fast-xml-parser').XMLParser;

// --- Base Classes ---
export abstract class SymbolExtractor {
  abstract getSymbolReferences(filePath: string): string[];
}

export abstract class SymbolResolver {
  protected symbolPath: string;
  protected dbPath: string;

  constructor(symbolPath: string, dbPath: string) {
    this.symbolPath = symbolPath;
    this.dbPath = dbPath;
  }

  abstract resolveSymbol(symbolRef: string): string | null;
}

// --- Snap (Tobii Dynavox) ---
let Database: Database | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Database = require('better-sqlite3');
} catch {
  Database = null;
}

export class SnapSymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath: string): string[] {
    if (!Database) throw new Error('better-sqlite3 not installed');
    const db = new Database(filePath, { readonly: true });
    const rows = db
      .prepare('SELECT DISTINCT LibrarySymbolId FROM Button WHERE LibrarySymbolId IS NOT NULL')
      .all() as { LibrarySymbolId: number }[];
    db.close();
    return rows.map((row) => String(row.LibrarySymbolId));
  }
}

export class SnapSymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef: string): string | null {
    if (!Database) throw new Error('better-sqlite3 not installed');
    const db = new Database(this.dbPath, { readonly: true });
    const query = 'SELECT ImageData FROM Symbol WHERE Id = ?';
    const row = db.prepare(query).get(symbolRef) as { ImageData: Buffer } | undefined;
    db.close();
    if (!row) return null;

    const outPath = path.join(this.symbolPath, `${symbolRef}.png`);
    fs.writeFileSync(outPath, row.ImageData);
    return outPath;
  }
}

// --- Grid 3 ---
let AdmZip: AdmZip | null = null;
let XMLParser: XMLParser | null = null;
try {
  // Dynamic requires for optional dependencies
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admZipModule = require('adm-zip');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fxpModule = require('fast-xml-parser');
  AdmZip = admZipModule;
  XMLParser = fxpModule.XMLParser;
} catch {
  AdmZip = null;
  XMLParser = null;
}

export class Grid3SymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath: string): string[] {
    if (!AdmZip || !XMLParser) throw new Error('adm-zip or fast-xml-parser not installed');

    // Import GridsetProcessor dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GridsetProcessor } = require('../processors/gridsetProcessor');
    const proc = new GridsetProcessor();
    const tree = proc.loadIntoTree(filePath);

    // Use the existing extractSymbolReferences function from gridset/symbols.ts
    return extractSymbolReferences(tree);
  }
}

export class Grid3SymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef: string): string | null {
    // Implementation depends on Grid 3 symbol storage format
    const symbolPath = path.join(this.symbolPath, symbolRef);
    return fs.existsSync(symbolPath) ? symbolPath : null;
  }
}

// --- TouchChat ---
export class TouchChatSymbolExtractor extends SymbolExtractor {
  getSymbolReferences(_filePath: string): string[] {
    // Implementation depends on TouchChat file format
    return [];
  }
}

export class TouchChatSymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef: string): string | null {
    // Implementation depends on TouchChat symbol storage format
    const symbolPath = path.join(this.symbolPath, symbolRef);
    return fs.existsSync(symbolPath) ? symbolPath : null;
  }
}

// --- Simple fallback function for PCS-style lookup ---
export function resolveSymbol(label: string, symbolDir: string): string | null {
  const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exts = ['.png', '.jpg', '.svg'];

  for (const ext of exts) {
    const symbolPath = path.join(symbolDir, cleanLabel + ext);
    if (fs.existsSync(symbolPath)) {
      return symbolPath;
    }
  }

  return null;
}
