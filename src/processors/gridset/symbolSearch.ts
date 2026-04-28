/**
 * Grid 3 Symbol Search Implementation
 *
 * The .pix files are simple text mappings:
 * searchTerm=symbolFilename=searchTerm
 *
 * Example:
 * above bw=above bw.png=above bw
 * active family=active family.png=active family
 */

import { defaultFileAdapter, FileAdapter } from '../../utils/io';

/**
 * Symbol search result
 */
export interface SymbolSearchResult {
  searchTerm: string;
  symbolFilename: string;
  displayName: string;
  library: string;
  exactMatch: boolean;
}

/**
 * Symbol search options
 */
export interface SymbolSearchOptions {
  grid3Path?: string;
  locale?: string;
  libraries?: string[]; // e.g., ['tawasl', 'widgit']
  limit?: number;
  fuzzyMatch?: boolean;
}

/**
 * Search index for a single library
 */
export interface LibrarySearchIndex {
  library: string;
  searchTerms: Map<string, string>; // searchTerm -> symbolFilename
  filenames: Map<string, string>; // symbolFilename -> searchTerm
}

/**
 * Parse a .pix file into search index
 * @param pixFilePath - Path to .pix file
 * @returns Search index
 */
export async function parsePixFile(
  pixFilePath: string,
  fileAdapter: FileAdapter = defaultFileAdapter
): Promise<LibrarySearchIndex> {
  const { readTextFromInput, basename } = fileAdapter;
  const content = await readTextFromInput(pixFilePath);
  const library = basename(pixFilePath, '.pix');

  const searchTerms = new Map<string, string>();
  const filenames = new Map<string, string>();

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('encoding=')) {
      continue;
    }

    // Format: searchTerm=symbolFilename=searchTerm
    const parts = trimmed.split('=');
    if (parts.length >= 3) {
      const searchTerm = parts[0];
      const symbolFilename = parts[1];
      const displayName = parts[2];

      searchTerms.set(searchTerm.toLowerCase(), symbolFilename);
      filenames.set(symbolFilename, displayName || searchTerm);
    }
  }

  return { library, searchTerms, filenames };
}

/**
 * Load search indexes for all available libraries
 * @param options - Search options
 * @returns Map of library name to search index
 */
export async function loadSearchIndexes(
  options: SymbolSearchOptions = {},
  fileAdapter: FileAdapter = defaultFileAdapter
): Promise<Map<string, LibrarySearchIndex>> {
  const { listDir, pathExists, join, basename } = fileAdapter;
  const { grid3Path, locale = 'en-GB', libraries: specifiedLibs } = options;

  if (!grid3Path) {
    throw new Error('grid3Path is required for symbol search');
  }

  const searchIndexesDir = join(grid3Path, 'Locale', locale, 'symbolsearch');

  if (!(await pathExists(searchIndexesDir))) {
    throw new Error(`Symbol search directory not found: ${searchIndexesDir}`);
  }

  const indexes = new Map<string, LibrarySearchIndex>();
  const files = await listDir(searchIndexesDir);

  for (const file of files) {
    if (!file.endsWith('.pix')) {
      continue;
    }

    const libraryName = basename(file, '.pix');

    // Filter libraries if specified
    if (specifiedLibs && specifiedLibs.length > 0) {
      if (!specifiedLibs.some((lib) => lib.toLowerCase() === libraryName.toLowerCase())) {
        continue;
      }
    }

    try {
      const pixFilePath = join(searchIndexesDir, file);
      const index = await parsePixFile(pixFilePath);
      indexes.set(libraryName, index);
    } catch (error) {
      console.warn(`Failed to load index for ${libraryName}:`, error);
    }
  }

  return indexes;
}

/**
 * Search for symbols by term
 * @param searchTerm - Term to search for
 * @param options - Search options
 * @returns Array of search results
 */
export async function searchSymbols(
  searchTerm: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchResult[]> {
  const indexes = await loadSearchIndexes(options);
  const results: SymbolSearchResult[] = [];
  const lowerSearchTerm = searchTerm.toLowerCase().trim();
  const limit = options.limit || 100;

  for (const [libraryName, index] of indexes.entries()) {
    // Exact match first
    if (index.searchTerms.has(lowerSearchTerm)) {
      const symbolFilename = index.searchTerms.get(lowerSearchTerm);
      if (symbolFilename) {
        results.push({
          searchTerm: lowerSearchTerm,
          symbolFilename,
          displayName: index.filenames.get(symbolFilename) || lowerSearchTerm,
          library: libraryName,
          exactMatch: true,
        });
      }
    }

    // Fuzzy match if enabled
    if (options.fuzzyMatch !== false) {
      for (const [term, symbolFilename] of index.searchTerms.entries()) {
        if (term.includes(lowerSearchTerm) || lowerSearchTerm.includes(term)) {
          // Skip if already added as exact match
          if (
            results.some((r) => r.library === libraryName && r.symbolFilename === symbolFilename)
          ) {
            continue;
          }

          results.push({
            searchTerm: lowerSearchTerm,
            symbolFilename,
            displayName: index.filenames.get(symbolFilename) || term,
            library: libraryName,
            exactMatch: false,
          });
        }
      }
    }
  }

  // Sort by exact match first, then by library
  results.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) {
      return a.exactMatch ? -1 : 1;
    }
    return a.library.localeCompare(b.library);
  });

  return results.slice(0, limit);
}

/**
 * Get symbol filename for a specific search term
 * @param searchTerm - Search term to look up
 * @param library - Library name
 * @param options - Search options
 * @returns Symbol filename or undefined
 */
export async function getSymbolFilename(
  searchTerm: string,
  library: string,
  options: SymbolSearchOptions = {}
): Promise<string | undefined> {
  const indexes = await loadSearchIndexes({
    ...options,
    libraries: [library],
  });

  const index = indexes.get(library.toLowerCase());
  if (!index) {
    return undefined;
  }

  return index.searchTerms.get(searchTerm.toLowerCase());
}

/**
 * Get display name for a symbol filename
 * @param symbolFilename - Symbol filename (e.g., "above bw.png")
 * @param library - Library name
 * @param options - Search options
 * @returns Display name or undefined
 */
export async function getSymbolDisplayName(
  symbolFilename: string,
  library: string,
  options: SymbolSearchOptions = {}
): Promise<string | undefined> {
  const indexes = await loadSearchIndexes({
    ...options,
    libraries: [library],
  });

  const index = indexes.get(library.toLowerCase());
  if (!index) {
    return undefined;
  }

  return index.filenames.get(symbolFilename);
}

/**
 * Get all search terms for a library
 * @param library - Library name
 * @param options - Search options
 * @returns Array of search terms
 */
export async function getAllSearchTerms(
  library: string,
  options: SymbolSearchOptions = {}
): Promise<string[]> {
  const indexes = await loadSearchIndexes({
    ...options,
    libraries: [library],
  });

  const index = indexes.get(library.toLowerCase());
  if (!index) {
    return [];
  }

  return Array.from(index.searchTerms.keys());
}

/**
 * Search suggestions (autocomplete)
 * @param partialTerm - Partial search term
 * @param options - Search options
 * @returns Array of suggested terms
 */
export async function getSearchSuggestions(
  partialTerm: string,
  options: SymbolSearchOptions = {}
): Promise<string[]> {
  const indexes = await loadSearchIndexes(options);
  const suggestions = new Set<string>();
  const lowerPartial = partialTerm.toLowerCase().trim();

  for (const index of indexes.values()) {
    for (const term of index.searchTerms.keys()) {
      if (term.startsWith(lowerPartial)) {
        suggestions.add(term);
      }
    }
  }

  return Array.from(suggestions).sort().slice(0, 20);
}

/**
 * Search for symbols and return results with library references
 * @param searchTerm - Term to search for
 * @param options - Search options
 * @returns Array of full symbol references
 */
export async function searchSymbolsWithReferences(
  searchTerm: string,
  options: SymbolSearchOptions = {}
): Promise<string[]> {
  const results = await searchSymbols(searchTerm, options);

  return results.map((r) => `[${r.library}]${r.symbolFilename}`);
}

/**
 * Count symbols in each library
 * @param options - Search options
 * @returns Map of library name to symbol count
 */
export async function countLibrarySymbols(
  options: SymbolSearchOptions = {}
): Promise<Map<string, number>> {
  const indexes = await loadSearchIndexes(options);
  const counts = new Map<string, number>();

  for (const [libraryName, index] of indexes.entries()) {
    counts.set(libraryName, index.searchTerms.size);
  }

  return counts;
}

/**
 * Get statistics about symbol libraries
 */
export interface SymbolSearchStats {
  totalLibraries: number;
  totalSymbols: number;
  libraries: Record<
    string,
    {
      symbolCount: number;
      exampleTerms: string[];
    }
  >;
}

/**
 * Get symbol search statistics
 * @param options - Search options
 * @returns Statistics about available symbols
 */
export async function getSymbolSearchStats(
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchStats> {
  const indexes = await loadSearchIndexes(options);
  const stats: SymbolSearchStats = {
    totalLibraries: indexes.size,
    totalSymbols: 0,
    libraries: {},
  };

  for (const [libraryName, index] of indexes.entries()) {
    stats.totalSymbols += index.searchTerms.size;
    stats.libraries[libraryName] = {
      symbolCount: index.searchTerms.size,
      exampleTerms: Array.from(index.searchTerms.keys()).slice(0, 10),
    };
  }

  return stats;
}
