/**
 * Reference Data Loader
 *
 * Loads reference vocabulary lists, core lists, and sentences
 * for AAC metrics analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CoreList, CommonWordsData, SynonymsData } from '../metrics/types';

export class ReferenceLoader {
  private dataDir: string;
  private locale: string;

  constructor(dataDir: string = path.join(__dirname, 'data'), locale: string = 'en') {
    this.dataDir = dataDir;
    this.locale = locale;
  }

  /**
   * Load core vocabulary lists
   */
  loadCoreLists(): CoreList[] {
    const filePath = path.join(this.dataDir, `core_lists.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CoreList[];
  }

  /**
   * Load common words with baseline effort scores
   */
  loadCommonWords(): CommonWordsData {
    const filePath = path.join(this.dataDir, `common_words.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CommonWordsData;
  }

  /**
   * Load synonym mappings
   */
  loadSynonyms(): SynonymsData {
    const filePath = path.join(this.dataDir, `synonyms.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SynonymsData;
  }

  /**
   * Load test sentences
   */
  loadSentences(): string[][] {
    const filePath = path.join(this.dataDir, `sentences.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as string[][];
  }

  /**
   * Load fringe vocabulary
   */
  loadFringe(): string[] {
    const filePath = path.join(this.dataDir, `fringe.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as string[];
  }

  /**
   * Load base words hash map
   */
  loadBaseWords(): { [word: string]: boolean } {
    const filePath = path.join(this.dataDir, `base_words.${this.locale}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as { [word: string]: boolean };
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
