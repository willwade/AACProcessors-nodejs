// Optional symbol library tools for AACProcessors
// Only use this if you have local access to symbol libraries (PCS, ARASAAC, etc.)
// Place any symbol resolution, lookup, or image extraction logic here.
//
// Example usage:
//   const symbolTools = require('../optional/symbolTools');
//   const imgPath = symbolTools.resolveSymbol('eat', '/path/to/symbols');

const path = require('path');
const fs = require('fs');

/**
 * Attempt to resolve a symbol image path for a given label.
 * @param {string} label - The symbol label (e.g., 'eat')
 * @param {string} symbolDir - Path to the local symbol library directory
 * @returns {string|null} - Path to the symbol image, or null if not found
 */
// Optional symbol tools for AACProcessors (class-based, engine-specific)
// Inspired by Python's symbol_tools.py
const path = require('path');
const fs = require('fs');

// --- Base Classes ---
class SymbolExtractor {
  getSymbolReferences(filePath) {
    throw new Error('Not implemented');
  }
}

class SymbolResolver {
  constructor(symbolPath, dbPath) {
    this.symbolPath = symbolPath;
    this.dbPath = dbPath;
  }
  resolveSymbol(symbolRef) {
    throw new Error('Not implemented');
  }
}

// --- Snap (Tobii Dynavox) ---
const Database = (() => { try { return require('better-sqlite3'); } catch { return null; } })();
class SnapSymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath) {
    if (!Database) throw new Error('better-sqlite3 not installed');
    const db = new Database(filePath, { readonly: true });
    const rows = db.prepare('SELECT DISTINCT LibrarySymbolId FROM Button WHERE LibrarySymbolId IS NOT NULL').all();
    db.close();
    return rows.map(row => String(row.LibrarySymbolId));
  }
}
class SnapSymbolResolver extends SymbolResolver {
  resolveSymbol(symbolId) {
    // Example: PCS symbol files named by ID in symbolPath
    const imgPath = path.join(this.symbolPath, symbolId + '.png');
    if (fs.existsSync(imgPath)) {
      return { id: symbolId, file: imgPath };
    }
    return null;
  }
}

// --- Grid 3 ---
const AdmZip = (() => { try { return require('adm-zip'); } catch { return null; } })();
const { XMLParser } = (() => { try { return require('fast-xml-parser'); } catch { return {}; } })();
class Grid3SymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath) {
    if (!AdmZip || !XMLParser) throw new Error('adm-zip or fast-xml-parser not installed');
    const zip = new AdmZip(filePath);
    const symbols = [];
    zip.getEntries().forEach(entry => {
      if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('/grid.xml')) {
        const xml = entry.getData().toString('utf8');
        const doc = new XMLParser().parse(xml);
        // Example: parse doc for symbol references (customize as needed)
        // symbols.push(...)
      }
    });
    return symbols;
  }
}
class Grid3SymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef) {
    // Example: symbolRef is a filename
    const imgPath = path.join(this.symbolPath, symbolRef + '.png');
    if (fs.existsSync(imgPath)) {
      return { id: symbolRef, file: imgPath };
    }
    return null;
  }
}

// --- TouchChat ---
class TouchChatSymbolExtractor extends SymbolExtractor {
  getSymbolReferences(filePath) {
    // Example: parse .ce SQLite or JSON for symbol references
    // Not implemented: return []
    return [];
  }
}
class TouchChatSymbolResolver extends SymbolResolver {
  resolveSymbol(symbolRef) {
    // Example: symbolRef is a filename
    const imgPath = path.join(this.symbolPath, symbolRef + '.png');
    if (fs.existsSync(imgPath)) {
      return { id: symbolRef, file: imgPath };
    }
    return null;
  }
}

// --- Simple fallback function for PCS-style lookup ---
function resolveSymbol(label, symbolDir) {
  if (!label || !symbolDir) return null;
  const tryNames = [label, label.toLowerCase(), label.toUpperCase()];
  for (const name of tryNames) {
    const imgPath = path.join(symbolDir, name + '.png');
    if (fs.existsSync(imgPath)) return imgPath;
  }
  return null;
}

module.exports = {
  SymbolExtractor,
  SymbolResolver,
  SnapSymbolExtractor,
  SnapSymbolResolver,
  Grid3SymbolExtractor,
  Grid3SymbolResolver,
  TouchChatSymbolExtractor,
  TouchChatSymbolResolver,
  resolveSymbol, // simple PCS-style fallback
};
