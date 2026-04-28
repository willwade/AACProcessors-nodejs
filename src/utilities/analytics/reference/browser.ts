/**
 * Browser-friendly reference data loader using fetch.
 */

import type { CoreList, CommonWordsData, SynonymsData } from "../metrics/types";
import type { ReferenceDataProvider } from "./index";

export interface ReferenceData {
  coreLists: CoreList[];
  commonWords: CommonWordsData;
  synonyms: SynonymsData;
  sentences: string[][];
  fringe: string[];
  baseWords: { [word: string]: boolean };
}

export class InMemoryReferenceLoader implements ReferenceDataProvider {
  private data: ReferenceData;

  constructor(data: ReferenceData) {
    this.data = data;
  }

  async loadCoreLists(): Promise<CoreList[]> {
    return Promise.resolve(this.data.coreLists);
  }

  async loadCommonWords(): Promise<CommonWordsData> {
    return Promise.resolve(this.data.commonWords);
  }

  async loadSynonyms(): Promise<SynonymsData> {
    return Promise.resolve(this.data.synonyms);
  }

  async loadSentences(): Promise<string[][]> {
    return Promise.resolve(this.data.sentences);
  }

  async loadFringe(): Promise<string[]> {
    return Promise.resolve(this.data.fringe);
  }

  async loadBaseWords(): Promise<{ [word: string]: boolean }> {
    return Promise.resolve(this.data.baseWords);
  }

  async loadCommonFringe(): Promise<string[]> {
    const commonWords = new Set(
      this.data.commonWords.words.map((w) => w.toLowerCase()),
    );
    const coreWords = new Set<string>();
    this.data.coreLists.forEach((list) => {
      list.words.forEach((word) => coreWords.add(word.toLowerCase()));
    });
    return Promise.resolve(
      Array.from(commonWords).filter((word) => !coreWords.has(word)),
    );
  }

  async loadAll(): Promise<ReferenceData> {
    return Promise.resolve(this.data);
  }
}

export async function loadReferenceDataFromUrl(
  baseUrl: string,
  locale = "en",
): Promise<ReferenceData> {
  const root = baseUrl.replace(/\/$/, "");
  const fetchJson = async <T>(name: string): Promise<T> => {
    const res = await fetch(`${root}/${name}.${locale}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load ${name}.${locale}.json`);
    }
    return (await res.json()) as T;
  };

  const [coreLists, commonWords, synonyms, sentences, fringe, baseWords] =
    await Promise.all([
      fetchJson<CoreList[]>("core_lists"),
      fetchJson<CommonWordsData>("common_words"),
      fetchJson<SynonymsData>("synonyms"),
      fetchJson<string[][]>("sentences"),
      fetchJson<string[]>("fringe"),
      fetchJson<{ [word: string]: boolean }>("base_words"),
    ]);

  return {
    coreLists,
    commonWords,
    synonyms,
    sentences,
    fringe,
    baseWords,
  };
}

export async function createBrowserReferenceLoader(
  baseUrl: string,
  locale = "en",
): Promise<InMemoryReferenceLoader> {
  const data = await loadReferenceDataFromUrl(baseUrl, locale);
  return new InMemoryReferenceLoader(data);
}
