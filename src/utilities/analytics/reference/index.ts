/**
 * Reference Data Loader
 *
 * Loads reference vocabulary lists, core lists, and sentences
 * for AAC metrics analysis.
 */

import { CoreList, CommonWordsData, SynonymsData } from "../metrics/types";
import { defaultFileAdapter, FileAdapter } from "../../../utils/io";

export interface ReferenceDataProvider {
  loadCoreLists(): Promise<CoreList[]>;
  loadCommonWords(): Promise<CommonWordsData>;
  loadSynonyms(): Promise<SynonymsData>;
  loadSentences(): Promise<string[][]>;
  loadFringe(): Promise<string[]>;
  loadBaseWords(): Promise<{ [word: string]: boolean }>;
  loadCommonFringe(): Promise<string[]>;
  loadAll(): Promise<{
    coreLists: CoreList[];
    commonWords: CommonWordsData;
    synonyms: SynonymsData;
    sentences: string[][];
    fringe: string[];
    baseWords: { [word: string]: boolean };
  }>;
}

export class ReferenceLoader {
  private dataDir: string;
  private locale: string;
  private fileAdapter: FileAdapter;

  constructor(
    dataDir?: string,
    locale: string = "en",
    fileAdapter: FileAdapter = defaultFileAdapter,
  ) {
    this.locale = locale;
    this.fileAdapter = fileAdapter;

    if (dataDir) {
      this.dataDir = dataDir;
    } else {
      // Resolve the data directory relative to this file's location
      // Use __dirname which works correctly after compilation
      this.dataDir = this.fileAdapter.join(__dirname, "data");
    }
  }

  /**
   * Load core vocabulary lists
   */
  async loadCoreLists(): Promise<CoreList[]> {
    const { readTextFromInput } = this.fileAdapter;
    const filePath = this.fileAdapter.join(
      this.dataDir,
      `core_lists.${this.locale}.json`,
    );
    const content = await readTextFromInput(filePath);
    return JSON.parse(String(content)) as CoreList[];
  }

  /**
   * Load common words with baseline effort scores
   */
  async loadCommonWords(): Promise<CommonWordsData> {
    const { readTextFromInput, join } = this.fileAdapter;
    const filePath = join(this.dataDir, `common_words.${this.locale}.json`);
    const content = await readTextFromInput(filePath);
    return JSON.parse(String(content)) as CommonWordsData;
  }

  /**
   * Load synonym mappings
   */
  async loadSynonyms(): Promise<SynonymsData> {
    const { readTextFromInput, join } = this.fileAdapter;
    const filePath = join(this.dataDir, `synonyms.${this.locale}.json`);
    const content = await readTextFromInput(filePath);
    return JSON.parse(String(content)) as SynonymsData;
  }

  /**
   * Load test sentences
   */
  async loadSentences(): Promise<string[][]> {
    const { readTextFromInput, join } = this.fileAdapter;
    const filePath = join(this.dataDir, `sentences.${this.locale}.json`);
    const content = await readTextFromInput(filePath);
    return JSON.parse(String(content)) as string[][];
  }

  /**
   * Load fringe vocabulary
   */
  async loadFringe(): Promise<string[]> {
    const { readTextFromInput, join } = this.fileAdapter;
    const filePath = join(this.dataDir, `fringe.${this.locale}.json`);
    const content = await readTextFromInput(filePath);
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
  async loadBaseWords(): Promise<{ [word: string]: boolean }> {
    const { readTextFromInput, join } = this.fileAdapter;
    const filePath = join(this.dataDir, `base_words.${this.locale}.json`);
    const content = await readTextFromInput(filePath);
    return JSON.parse(String(content)) as { [word: string]: boolean };
  }

  /**
   * Load common fringe vocabulary
   * Common words that are NOT in core vocabulary lists
   * (matching Ruby loader.rb:413-420)
   */
  async loadCommonFringe(): Promise<string[]> {
    const commonWordsData = await this.loadCommonWords();
    const commonWords = new Set(
      commonWordsData.words.map((w) => w.toLowerCase()),
    );

    const coreLists = await this.loadCoreLists();
    const coreWords = new Set<string>();
    coreLists.forEach((list) => {
      list.words.forEach((word) => coreWords.add(word.toLowerCase()));
    });

    // Common fringe = common words - core words
    const commonFringe = Array.from(commonWords).filter(
      (word) => !coreWords.has(word),
    );
    return commonFringe;
  }

  /**
   * Get all reference data at once
   */
  async loadAll(): Promise<{
    coreLists: CoreList[];
    commonWords: CommonWordsData;
    synonyms: SynonymsData;
    sentences: string[][];
    fringe: string[];
    baseWords: { [word: string]: boolean };
  }> {
    return {
      coreLists: await this.loadCoreLists(),
      commonWords: await this.loadCommonWords(),
      synonyms: await this.loadSynonyms(),
      sentences: await this.loadSentences(),
      fringe: await this.loadFringe(),
      baseWords: await this.loadBaseWords(),
    };
  }
}

/**
 * Get the default reference data path
 */
export function getReferenceDataPath(
  fileAdapter: FileAdapter = defaultFileAdapter,
): string {
  return String(fileAdapter.join(__dirname, "data"));
}

/**
 * Check if reference data files exist
 */
export async function hasReferenceData(
  fileAdapter: FileAdapter = defaultFileAdapter,
): Promise<boolean> {
  const { pathExists, join } = fileAdapter;
  const dataPath = getReferenceDataPath();
  const requiredFiles = [
    "core_lists.en.json",
    "common_words.en.json",
    "sentences.en.json",
    "synonyms.en.json",
    "fringe.en.json",
  ];
  const existingPaths = await Promise.all(
    requiredFiles.map(async (file) => await pathExists(join(dataPath, file))),
  );
  return existingPaths.every((exists) => exists);
}
