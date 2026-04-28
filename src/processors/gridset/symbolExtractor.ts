/**
 * Grid 3 Symbol Extraction Strategy
 *
 * For converting Grid 3 gridsets to other formats (like Asterics),
 * we need to handle symbol library references properly.
 *
 * Strategy:
 * 1. Check if image is embedded in gridset (extract directly)
 * 2. If symbol library reference:
 *    a. Check if we can extract from .pix file (limited support)
 *    b. Provide reference/URL for manual resolution
 *    c. For Tawasol: provide alternative sources
 */

import {
  resolveSymbolReference,
  parseSymbolReference,
  type SymbolReference,
} from "./symbols";
import {
  defaultFileAdapter,
  FileAdapter,
  ProcessorInput,
} from "../../utils/io";
import { getZipAdapter, ZipAdapter } from "../../utils/zip";

/**
 * Image extraction result
 */
export interface ExtractedImage {
  found: boolean;
  data?: Buffer;
  format?: "png" | "jpg" | "jpeg" | "gif" | "svg" | "unknown";
  source: "embedded" | "symbol-library" | "external-file" | "not-found";
  reference?: string;
  error?: string;
  metadata?: {
    library?: string;
    symbolPath?: string;
    attribution?: string;
    license?: string;
  };
}

/**
 * Symbol extraction options
 */
export interface SymbolExtractionOptions {
  grid3Path?: string;
  locale?: string;
  preferEmbedded?: boolean; // Use embedded images over symbol library
  includeAttribution?: boolean; // Add attribution for open-license symbols
  /** For Tawasol: try to find alternative sources */
  tryAlternativeSources?: boolean;
  /** Callback for when symbol needs manual extraction */
  onMissingSymbol?: (ref: SymbolReference) => void;
}

/**
 * Known open-license symbol sources
 */
const OPEN_LICENSE_SYMBOLS: {
  [key: string]: {
    name: string;
    attribution: string;
    license: string;
    url?: string;
    alternativeSources?: readonly string[];
  };
} = {
  tawasl: {
    name: "Tawasol",
    attribution: "Tawasol symbols by Mada (Qatar Assistive Technology Center)",
    license: "CC BY-SA 4.0",
    url: "https://mada.org.qa/en/resources/tawasol-symbols",
    alternativeSources: ["https://github.com/mada-qatar/Tawasol"],
  },
  blissx: {
    name: "Blissymbols",
    attribution: "Blissymbolics Communication International",
    license: "CC BY-ND 3.0",
    url: "https://blissymbolics.org",
  },
  symoji: {
    name: "Symoji",
    attribution: "Smartbox Assistive Technology",
    license: "Proprietary - Free use in Grid 3",
  },
};

/**
 * Extract image data for a button
 * @param gridsetBuffer - Gridset ZIP buffer
 * @param resolvedImageEntry - Path to embedded image in gridset
 * @param symbolReference - Symbol library reference
 * @param options - Extraction options
 * @returns Extracted image data
 */
export async function extractButtonImage(
  gridsetBuffer: Buffer,
  resolvedImageEntry: string | undefined,
  symbolReference: string | undefined,
  options: SymbolExtractionOptions = {},
  fileAdapter: FileAdapter = defaultFileAdapter,
  zipAdapter?: (input: ProcessorInput) => Promise<ZipAdapter>,
): Promise<ExtractedImage> {
  // Priority 1: Use embedded image if available
  if (resolvedImageEntry && options.preferEmbedded !== false) {
    try {
      const zip = zipAdapter
        ? await zipAdapter(gridsetBuffer)
        : await getZipAdapter(gridsetBuffer, fileAdapter);
      const entries = zip.listFiles();
      const entry = entries.find((e) => e === resolvedImageEntry);

      if (entry) {
        const data = Buffer.from(await zip.readFile(entry));
        const format = detectImageFormat(data);
        return {
          found: true,
          data,
          format,
          source: "embedded",
          reference: resolvedImageEntry,
        };
      }
    } catch (error) {
      console.warn(`Failed to extract embedded image: ${String(error)}`);
    }
  }

  // Priority 2: Check symbol library reference
  if (symbolReference) {
    return await extractSymbolLibraryImage(symbolReference, options);
  }

  // Not found
  return {
    found: false,
    source: "not-found",
  };
}

/**
 * Extract image from symbol library
 * @param reference - Symbol reference like "[tawasl]/food/apple.png"
 * @param options - Extraction options
 * @returns Extracted image or reference info
 */
export async function extractSymbolLibraryImage(
  reference: string,
  options: SymbolExtractionOptions = {},
): Promise<ExtractedImage> {
  const ref = parseSymbolReferenceSafe(reference);

  if (!ref || !ref.isValid) {
    return {
      found: false,
      source: "not-found",
      reference,
    };
  }

  // Get library metadata
  const libInfo =
    OPEN_LICENSE_SYMBOLS[ref.library as keyof typeof OPEN_LICENSE_SYMBOLS];

  // Resolve symbol reference and extract from .symbols file
  const resolved = await resolveSymbolReference(reference, {
    grid3Path: options.grid3Path,
  });

  const metadata = {
    library: ref.library,
    symbolPath: ref.path,
    attribution: libInfo?.attribution,
    license: libInfo?.license,
  };

  if (!resolved.found) {
    // Symbol not found in library
    if (options.onMissingSymbol) {
      options.onMissingSymbol(ref);
    }

    return {
      found: false,
      source: "symbol-library",
      reference: reference,
      metadata,
      error: resolved.error,
    };
  }

  // Successfully extracted!
  const data = resolved.data;
  const format = data ? detectImageFormat(data) : "unknown";
  return {
    found: true,
    data,
    format,
    source: "symbol-library",
    reference: reference,
    metadata,
  };
}

/**
 * Convert extracted image to Asterics Grid format
 * @param extracted - Extracted image
 * @returns GridImage object for Asterics
 */
export function convertToAstericsImage(extracted: ExtractedImage): any {
  const image: any = {};

  if (extracted.found && extracted.data) {
    // Embed as base64
    image.data = Buffer.from(extracted.data).toString("base64");
  }

  // Even if embedded, add attribution for symbol libraries
  if (extracted.source === "symbol-library") {
    if (extracted.metadata?.attribution) {
      image.author = extracted.metadata.attribution;
    }
    if (extracted.metadata?.license) {
      image.searchProviderName = extracted.metadata.license;
    }
  }

  // If not found but we have a reference, keep it for manual handling
  if (!extracted.found && extracted.reference) {
    image.url = `symbol:${extracted.reference}`;
    if (extracted.metadata?.attribution) {
      image.author = extracted.metadata.attribution;
    }
  }

  return image;
}

/**
 * Generate a symbol extraction report
 * Useful for identifying which symbols need manual extraction
 */
export interface SymbolReport {
  total: number;
  embedded: number;
  symbolLibraries: number;
  notFound: number;
  byLibrary: Record<string, number>;
  missingSymbols: Array<{
    reference: string;
    library: string;
    path: string;
    attribution?: string;
    license?: string;
  }>;
}

/**
 * Analyze symbol usage for a gridset
 * @param tree - AAC tree
 * @returns Symbol usage report
 */
export function analyzeSymbolExtraction(tree: any): SymbolReport {
  const report: SymbolReport = {
    total: 0,
    embedded: 0,
    symbolLibraries: 0,
    notFound: 0,
    byLibrary: {},
    missingSymbols: [],
  };

  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];

    if (page.buttons) {
      for (const button of page.buttons) {
        report.total++;

        // Embedded image
        if (button.resolvedImageEntry && !button.symbolLibrary) {
          report.embedded++;
          continue;
        }

        // Symbol library reference
        if (button.symbolLibrary) {
          report.symbolLibraries++;
          report.byLibrary[button.symbolLibrary] =
            (report.byLibrary[button.symbolLibrary] || 0) + 1;

          const ref = `[${button.symbolLibrary}]${button.symbolPath || ""}`;
          const libInfo =
            OPEN_LICENSE_SYMBOLS[
              button.symbolLibrary as keyof typeof OPEN_LICENSE_SYMBOLS
            ];

          report.missingSymbols.push({
            reference: ref,
            library: button.symbolLibrary,
            path: button.symbolPath || "",
            attribution: libInfo?.attribution,
            license: libInfo?.license,
          });
          continue;
        }

        // Not found
        if (!button.resolvedImageEntry && !button.symbolLibrary) {
          report.notFound++;
        }
      }
    }
  }

  return report;
}

/**
 * Suggest extraction strategy based on report
 */
export function suggestExtractionStrategy(report: SymbolReport): string {
  const suggestions: string[] = [];

  if (report.embedded > 0) {
    suggestions.push(
      `✓ Can extract ${report.embedded} embedded images directly`,
    );
  }

  if (report.symbolLibraries > 0) {
    suggestions.push(
      `⚠ ${report.symbolLibraries} symbol library references found:`,
    );
    Object.entries(report.byLibrary).forEach(([lib, count]) => {
      const libInfo =
        OPEN_LICENSE_SYMBOLS[lib as keyof typeof OPEN_LICENSE_SYMBOLS];
      if (libInfo) {
        suggestions.push(`  - ${lib}: ${count} symbols (${libInfo.license})`);
        if (libInfo.alternativeSources) {
          suggestions.push(
            `    Alternative: ${libInfo.alternativeSources.join(", ")}`,
          );
        }
      } else {
        suggestions.push(
          `  - ${lib}: ${count} symbols (Proprietary - requires Grid 3)`,
        );
      }
    });
  }

  if (report.notFound > 0) {
    suggestions.push(`✗ ${report.notFound} images not found`);
  }

  return suggestions.join("\n");
}

/**
 * Detect image format from buffer
 */
function detectImageFormat(
  buffer: Buffer,
): "png" | "jpg" | "jpeg" | "gif" | "svg" | "unknown" {
  if (buffer.length < 4) return "unknown";

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "gif";
  }

  // SVG (check for <svg text)
  const header = buffer
    .slice(0, Math.min(100, buffer.length))
    .toString("ascii")
    .toLowerCase();
  if (header.includes("<svg")) {
    return "svg";
  }

  return "unknown";
}

/**
 * Safe parse of symbol reference
 */
function parseSymbolReferenceSafe(reference: string): SymbolReference | null {
  try {
    return parseSymbolReference(reference);
  } catch {
    return null;
  }
}

/**
 * Export symbol references to CSV for manual extraction
 */
export async function exportSymbolReferencesToCsv(
  report: SymbolReport,
  outputPath: string,
  fileAdapter: FileAdapter = defaultFileAdapter,
): Promise<void> {
  const { writeTextToPath } = fileAdapter;
  const lines = ["Reference,Library,Path,Attribution,License"];

  for (const symbol of report.missingSymbols) {
    lines.push(
      `"${symbol.reference}","${symbol.library}","${symbol.path}","${symbol.attribution || ""}","${symbol.license || ""}"`,
    );
  }

  await writeTextToPath(outputPath, lines.join("\n"));
}

/**
 * Create a manifest file for missing symbols
 */
export interface SymbolManifest {
  generatedAt: string;
  gridset: string;
  totalSymbols: number;
  embedded: number;
  fromLibraries: number;
  libraries: Record<
    string,
    {
      count: number;
      attribution?: string;
      license?: string;
      url?: string;
    }
  >;
  symbols: Array<{
    pageId: string;
    buttonId: string;
    reference: string;
    label?: string;
  }>;
}

export function createSymbolManifest(
  tree: any,
  gridsetName: string,
): SymbolManifest {
  const manifest: SymbolManifest = {
    generatedAt: new Date().toISOString(),
    gridset: gridsetName,
    totalSymbols: 0,
    embedded: 0,
    fromLibraries: 0,
    libraries: {},
    symbols: [],
  };

  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];

    if (page.buttons) {
      for (const button of page.buttons) {
        manifest.totalSymbols++;

        if (button.resolvedImageEntry && !button.symbolLibrary) {
          manifest.embedded++;
          continue;
        }

        if (button.symbolLibrary) {
          manifest.fromLibraries++;

          if (!manifest.libraries[button.symbolLibrary]) {
            const libInfo =
              OPEN_LICENSE_SYMBOLS[
                button.symbolLibrary as keyof typeof OPEN_LICENSE_SYMBOLS
              ];
            manifest.libraries[button.symbolLibrary] = {
              count: 0,
              attribution: libInfo?.attribution,
              license: libInfo?.license,
              url: libInfo?.url,
            };
          }

          manifest.libraries[button.symbolLibrary].count++;

          const ref = `[${button.symbolLibrary}]${button.symbolPath || ""}`;
          manifest.symbols.push({
            pageId,
            buttonId: button.id,
            reference: ref,
            label: button.label,
          });
        }
      }
    }
  }

  return manifest;
}
