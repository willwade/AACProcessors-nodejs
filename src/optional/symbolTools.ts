import path from "path";
import fs from "fs";

// Dynamic imports for optional dependencies
type Database = typeof import("better-sqlite3");
type AdmZip = typeof import("adm-zip");
type XMLParser = typeof import("fast-xml-parser").XMLParser;

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
  Database = require("better-sqlite3");
} catch {
  Database = null;
}

export class SnapSymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath: string): string[] {
    if (!Database) throw new Error("better-sqlite3 not installed");
    const db = new Database(filePath, { readonly: true });
    const rows = db
      .prepare(
        "SELECT DISTINCT LibrarySymbolId FROM Button WHERE LibrarySymbolId IS NOT NULL",
      )
      .all() as { LibrarySymbolId: number }[];
    db.close();
    return rows.map((row) => String(row.LibrarySymbolId));
  }
}

export class SnapSymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef: string): string | null {
    if (!Database) throw new Error("better-sqlite3 not installed");
    const db = new Database(this.dbPath, { readonly: true });
    const query = "SELECT ImageData FROM Symbol WHERE Id = ?";
    const row = db.prepare(query).get(symbolRef) as
      | { ImageData: Buffer }
      | undefined;
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AdmZip = require("adm-zip");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  XMLParser = require("fast-xml-parser").XMLParser;
} catch {
  AdmZip = null;
  XMLParser = null;
}

export class Grid3SymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath: string): string[] {
    if (!AdmZip || !XMLParser)
      throw new Error("adm-zip or fast-xml-parser not installed");
    const zip = new AdmZip(filePath);
    const parser = new XMLParser();
    const refs = new Set<string>();

    zip.getEntries().forEach((entry) => {
      if (entry.entryName.endsWith(".gridset")) {
        const xmlBuffer = entry.getData();
        const _data = parser.parse(xmlBuffer.toString("utf8"));
        // Extract symbol references from Grid 3 XML structure
        // Implementation depends on Grid 3 file format
      }
    });

    return Array.from(refs);
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
  const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exts = [".png", ".jpg", ".svg"];

  for (const ext of exts) {
    const symbolPath = path.join(symbolDir, cleanLabel + ext);
    if (fs.existsSync(symbolPath)) {
      return symbolPath;
    }
  }

  return null;
}
