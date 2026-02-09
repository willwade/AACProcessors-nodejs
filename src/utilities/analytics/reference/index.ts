/**
 * Reference Data Loader
 *
 * Loads reference vocabulary lists, core lists, and sentences
 * for AAC metrics analysis.
 */

import { CoreList, CommonWordsData, SynonymsData } from '../metrics/types';
import { defaultFileAdapter, FileAdapter, getPath } from '../../../utils/io';

export interface ReferenceDataProvider {
  loadCoreLists(): CoreList[];
  loadCommonWords(): CommonWordsData;
  loadSynonyms(): SynonymsData;
  loadSentences(): string[][];
  loadFringe(): string[];
  loadBaseWords(): { [word: string]: boolean };
  loadCommonFringe(): string[];
  loadAll(): {
    coreLists: CoreList[];
    commonWords: CommonWordsData;
    synonyms: SynonymsData;
    sentences: string[][];
    fringe: string[];
    baseWords: { [word: string]: boolean };
  };
}

export class ReferenceLoader {
  private dataDir: string;
  private locale: string;

  constructor(dataDir?: string, locale: string = 'en') {
    this.locale = locale;

    if (dataDir) {
      this.dataDir = dataDir;
    } else {
      // Resolve the data directory relative to this file's location
      // Use __dirname which works correctly after compilation
      this.dataDir = getPath().join(__dirname, 'data');
    }
  }

  /**
   * Load core vocabulary lists
   */
  loadCoreLists(fileAdapter: FileAdapter = defaultFileAdapter): CoreList[] {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `core_lists.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    return JSON.parse(String(content)) as CoreList[];
  }

  /**
   * Load common words with baseline effort scores
   */
  loadCommonWords(fileAdapter: FileAdapter = defaultFileAdapter): CommonWordsData {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `common_words.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    return JSON.parse(String(content)) as CommonWordsData;
  }

  /**
   * Load synonym mappings
   */
  loadSynonyms(fileAdapter: FileAdapter = defaultFileAdapter): SynonymsData {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `synonyms.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    return JSON.parse(String(content)) as SynonymsData;
  }

  /**
   * Load test sentences
   */
  loadSentences(fileAdapter: FileAdapter = defaultFileAdapter): string[][] {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `sentences.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    return JSON.parse(String(content)) as string[][];
  }

  /**
   * Load fringe vocabulary
   */
  loadFringe(fileAdapter: FileAdapter = defaultFileAdapter): string[] {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `fringe.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    const data = JSON.parse(String(content));

    // Flatten nested category words if needed
    if (Array.isArray(data) && data.length > 0 && data[0].categories) {
      const flattened: string[] = [];
      data.forEach((list: any) => {
        list.categories.forEach((cat: any) => {
          flattened.push(...(cat.words as string[]));
        });
      });
      return flattened;
    }

    return data as string[];
  }

  /**
   * Load base words hash map
   */
  loadBaseWords(fileAdapter: FileAdapter = defaultFileAdapter): { [word: string]: boolean } {
    const { readTextFromInput } = fileAdapter;
    const filePath = getPath().join(this.dataDir, `base_words.${this.locale}.json`);
    const content = readTextFromInput(filePath);
    return JSON.parse(String(content)) as { [word: string]: boolean };
  }

  /**
   * Load common fringe vocabulary
   * Common words that are NOT in core vocabulary lists
   * (matching Ruby loader.rb:413-420)
   */
  loadCommonFringe(): string[] {
    const commonWordsData = this.loadCommonWords();
    const commonWords = new Set(commonWordsData.words.map((w) => w.toLowerCase()));

    const coreLists = this.loadCoreLists();
    const coreWords = new Set<string>();
    coreLists.forEach((list) => {
      list.words.forEach((word) => coreWords.add(word.toLowerCase()));
    });

    // Common fringe = common words - core words
    const commonFringe = Array.from(commonWords).filter((word) => !coreWords.has(word));
    return commonFringe;
  }

  /**
   * Get all reference data at once
   */
  loadAll(): {
    coreLists: CoreList[];
    commonWords: CommonWordsData;
    synonyms: SynonymsData;
    sentences: string[][];
    fringe: string[];
    baseWords: { [word: string]: boolean };
  } {
    return {
      coreLists: this.loadCoreLists(),
      commonWords: this.loadCommonWords(),
      synonyms: this.loadSynonyms(),
      sentences: this.loadSentences(),
      fringe: this.loadFringe(),
      baseWords: this.loadBaseWords(),
    };
  }
}

/**
 * Get the default reference data path
 */
export function getReferenceDataPath(): string {
  return String(getPath().join(__dirname, 'data'));
}

/**
 * Check if reference data files exist
 */
export function hasReferenceData(fileAdapter: FileAdapter = defaultFileAdapter): boolean {
  const { pathExists } = fileAdapter;
  const dataPath = getReferenceDataPath();
  const requiredFiles = [
    'core_lists.en.json',
    'common_words.en.json',
    'sentences.en.json',
    'synonyms.en.json',
    'fringe.en.json',
  ];
  return requiredFiles.every((file) => pathExists(getPath().join(dataPath, file)));
}
