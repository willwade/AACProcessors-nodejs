/**
 * Grid3 Wordlist Helpers
 * 
 * This module provides utilities for creating and extracting wordlists
 * from Grid3 gridsets. Wordlists are Grid3-specific data structures
 * used for dynamic vocabulary content.
 * 
 * Note: Wordlists are only supported in Grid3 format. Other AAC formats
 * do not have equivalent wordlist functionality.
 */

import AdmZip from 'adm-zip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

/**
 * Represents a single item in a wordlist
 */
export interface WordListItem {
  /** The text/word/phrase */
  text: string;
  /** Optional image reference (e.g., "[WIDGIT]path/to/symbol.emf") */
  image?: string;
  /** Part of speech category (e.g., "Noun", "Verb", "Unknown") */
  partOfSpeech?: string;
}

/**
 * Represents a complete wordlist
 */
export interface WordList {
  /** Array of wordlist items */
  items: WordListItem[];
}

/**
 * Creates a WordList object from an array of words/phrases or a dictionary
 * 
 * @param input - Either an array of strings or an object with text/image/partOfSpeech properties
 * @returns A WordList object ready to be used in Grid3
 * 
 * @example
 * // From simple array
 * const wordlist = createWordlist(['hello', 'goodbye', 'thank you']);
 * 
 * @example
 * // From array of objects
 * const wordlist = createWordlist([
 *   { text: 'hello', image: '[WIDGIT]greetings/hello.emf', partOfSpeech: 'Interjection' },
 *   { text: 'goodbye', image: '[WIDGIT]greetings/goodbye.emf', partOfSpeech: 'Interjection' }
 * ]);
 */
export function createWordlist(
  input: string[] | WordListItem[] | Record<string, string | WordListItem>
): WordList {
  let items: WordListItem[] = [];

  if (Array.isArray(input)) {
    // Handle array input
    items = input.map((item) => {
      if (typeof item === 'string') {
        return { text: item };
      }
      return item;
    });
  } else if (typeof input === 'object') {
    // Handle dictionary/object input
    items = Object.entries(input).map(([key, value]) => {
      if (typeof value === 'string') {
        return { text: value };
      }
      return value;
    });
  }

  return { items };
}

/**
 * Converts a WordList object to Grid3 XML format
 * 
 * @param wordlist - The wordlist to convert
 * @returns XML string representation
 * @internal
 */
export function wordlistToXml(wordlist: WordList): string {
  const items = wordlist.items.map((item) => ({
    WordListItem: {
      Text: {
        s: {
          '@_Image': item.image || '',
          r: item.text,
        },
      },
      Image: item.image || '',
      PartOfSpeech: item.partOfSpeech || 'Unknown',
    },
  }));

  const wordlistData = {
    WordList: {
      Items: {
        WordListItem: items.length === 1 ? items[0].WordListItem : items.map((i) => i.WordListItem),
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: false,
    suppressEmptyNode: false,
  });

  return builder.build(wordlistData);
}

/**
 * Extracts all wordlists from a gridset buffer
 *
 * @param gridsetBuffer - The gridset file as a Buffer
 * @returns Map of grid names to their wordlists (if they have any)
 *
 * @example
 * const wordlists = extractWordlists(gridsetBuffer);
 * wordlists.forEach((wordlist, gridName) => {
 *   console.log(`Grid "${gridName}" has ${wordlist.items.length} items`);
 * });
 */
export function extractWordlists(gridsetBuffer: Buffer): Map<string, WordList> {
  const wordlists = new Map<string, WordList>();
  const parser = new XMLParser();

  let zip: AdmZip;
  try {
    zip = new AdmZip(gridsetBuffer);
  } catch (error: any) {
    throw new Error(`Invalid gridset buffer: ${error.message}`);
  }

  // Process each grid file
  zip.getEntries().forEach((entry) => {
    if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {
      try {
        const xmlContent = entry.getData().toString('utf8');
        const data = parser.parse(xmlContent);
        const grid = data.Grid || data.grid;

        if (!grid || !grid.WordList) {
          return;
        }

        // Extract grid name from path (e.g., "Grids/MyGrid/grid.xml" -> "MyGrid")
        const match = entry.entryName.match(/^Grids\/([^/]+)\//);
        const gridName = match ? match[1] : entry.entryName;

        // Parse wordlist items
        const wordlistData = grid.WordList;
        const itemsContainer = wordlistData.Items || wordlistData.items;

        if (!itemsContainer) {
          return;
        }

        const itemArray = Array.isArray(itemsContainer.WordListItem)
          ? itemsContainer.WordListItem
          : itemsContainer.WordListItem
            ? [itemsContainer.WordListItem]
            : [];

        const items: WordListItem[] = itemArray.map((item: any) => ({
          text: item.Text?.s?.r || item.text?.s?.r || '',
          image: item.Image || item.image || undefined,
          partOfSpeech: item.PartOfSpeech || item.partOfSpeech || 'Unknown',
        }));

        if (items.length > 0) {
          wordlists.set(gridName, { items });
        }
      } catch (error) {
        // Skip grids with parsing errors
        console.warn(`Failed to extract wordlist from ${entry.entryName}:`, error);
      }
    }
  });

  return wordlists;
}

/**
 * Updates or adds a wordlist to a specific grid in a gridset
 *
 * @param gridsetBuffer - The gridset file as a Buffer
 * @param gridName - The name of the grid to update (e.g., "Greetings")
 * @param wordlist - The wordlist to add/update
 * @returns Updated gridset as a Buffer
 *
 * @example
 * const gridsetBuffer = fs.readFileSync('my-gridset.gridset');
 * const newWordlist = createWordlist(['hello', 'hi', 'hey']);
 * const updatedGridset = updateWordlist(gridsetBuffer, 'Greetings', newWordlist);
 * fs.writeFileSync('updated-gridset.gridset', updatedGridset);
 */
export function updateWordlist(
  gridsetBuffer: Buffer,
  gridName: string,
  wordlist: WordList
): Buffer {
  const parser = new XMLParser();
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressEmptyNode: false,
  });

  let zip: AdmZip;
  try {
    zip = new AdmZip(gridsetBuffer);
  } catch (error: any) {
    throw new Error(`Invalid gridset buffer: ${error.message}`);
  }

  let found = false;

  // Find and update the grid
  zip.getEntries().forEach((entry) => {
    if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {
      const match = entry.entryName.match(/^Grids\/([^/]+)\//);
      const currentGridName = match ? match[1] : null;

      if (currentGridName === gridName) {
        try {
          const xmlContent = entry.getData().toString('utf8');
          const data = parser.parse(xmlContent);
          const grid = data.Grid || data.grid;

          if (!grid) {
            return;
          }

          // Build the new wordlist XML structure
          const items = wordlist.items.map((item) => ({
            WordListItem: {
              Text: {
                s: {
                  '@_Image': item.image || '',
                  r: item.text,
                },
              },
              Image: item.image || '',
              PartOfSpeech: item.partOfSpeech || 'Unknown',
            },
          }));

          grid.WordList = {
            Items: {
              WordListItem:
                items.length === 1 ? items[0].WordListItem : items.map((i) => i.WordListItem),
            },
          };

          // Rebuild the XML
          const updatedXml = builder.build(data);
          zip.updateFile(entry, Buffer.from(updatedXml, 'utf8'));
          found = true;
        } catch (error) {
          throw new Error(`Failed to update wordlist in grid "${gridName}": ${error}`);
        }
      }
    }
  });

  if (!found) {
    throw new Error(`Grid "${gridName}" not found in gridset`);
  }

  return zip.toBuffer();
}

