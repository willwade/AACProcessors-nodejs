/**
 * Vocabulary Coverage Analysis
 *
 * Analyzes how well an AAC board set covers core vocabulary
 * and identifies missing/extra words compared to reference lists.
 */

import { MetricsResult, CoreList } from './types';
import { ReferenceLoader } from '../reference/index';
import { spellingEffort } from './effort';

export interface VocabularyAnalysis {
  // Coverage statistics for each core list
  core_coverage: {
    [listId: string]: {
      name: string;
      total_words: number;
      covered: number;
      missing: number;
      coverage_percent: number;
      missing_words: string[];
      average_effort: number;
    };
  };

  // Overall vocabulary statistics
  total_unique_words: number;
  words_with_effort: number;
  words_requiring_spelling: number;

  // Words not in any core list (extra vocabulary)
  extra_words: string[];

  // High/low effort words
  high_effort_words: Array<{ word: string; effort: number }>;
  low_effort_words: Array<{ word: string; effort: number }>;
}

export class VocabularyAnalyzer {
  private referenceLoader: ReferenceLoader;

  constructor(referenceLoader?: ReferenceLoader) {
    this.referenceLoader = referenceLoader || new ReferenceLoader();
  }

  /**
   * Analyze vocabulary coverage against core lists
   */
  analyze(
    metrics: MetricsResult,
    options?: {
      locale?: string;
      highEffortThreshold?: number;
      lowEffortThreshold?: number;
    }
  ): VocabularyAnalysis {
    // const locale = options?.locale || metrics.locale || 'en';
    const highEffortThreshold = options?.highEffortThreshold || 5.0;
    const lowEffortThreshold = options?.lowEffortThreshold || 2.0;

    // Load reference data
    const coreLists = this.referenceLoader.loadCoreLists();

    // Create word to effort map
    const wordEffortMap = new Map<string, number>();
    metrics.buttons.forEach((btn) => {
      const existing = wordEffortMap.get(btn.label);
      if (!existing || btn.effort < existing) {
        wordEffortMap.set(btn.label, btn.effort);
      }
    });

    // Analyze each core list
    const core_coverage: VocabularyAnalysis['core_coverage'] = {};

    coreLists.forEach((list) => {
      const analysis = this.analyzeCoreList(list, wordEffortMap);
      core_coverage[list.id] = analysis;
    });

    // Find extra words (words not in any core list)
    const allCoreWords = new Set<string>();
    coreLists.forEach((list) => {
      list.words.forEach((word) => allCoreWords.add(word.toLowerCase()));
    });

    const extraWords: string[] = [];
    wordEffortMap.forEach((effort, word) => {
      if (!allCoreWords.has(word.toLowerCase())) {
        extraWords.push(word);
      }
    });
    extraWords.sort((a, b) => a.localeCompare(b));

    // Find high/low effort words
    const highEffortWords: Array<{ word: string; effort: number }> = [];
    const lowEffortWords: Array<{ word: string; effort: number }> = [];

    wordEffortMap.forEach((effort, word) => {
      if (effort > highEffortThreshold) {
        highEffortWords.push({ word, effort });
      } else if (effort < lowEffortThreshold) {
        lowEffortWords.push({ word, effort });
      }
    });

    highEffortWords.sort((a, b) => b.effort - a.effort);
    lowEffortWords.sort((a, b) => a.effort - b.effort);

    return {
      core_coverage,
      total_unique_words: wordEffortMap.size,
      words_with_effort: wordEffortMap.size,
      words_requiring_spelling: 0, // Calculated during sentence analysis
      extra_words: extraWords,
      high_effort_words: highEffortWords.slice(0, 50), // Top 50
      low_effort_words: lowEffortWords.slice(0, 50), // Bottom 50
    };
  }

  /**
   * Analyze coverage for a single core list
   */
  private analyzeCoreList(
    list: CoreList,
    wordEffortMap: Map<string, number>
  ): VocabularyAnalysis['core_coverage'][string] {
    const covered: string[] = [];
    const missing: string[] = [];
    let totalEffort = 0;

    list.words.forEach((word) => {
      const effort = wordEffortMap.get(word);
      if (effort !== undefined) {
        covered.push(word);
        totalEffort += effort;
      } else {
        missing.push(word);
      }
    });

    const averageEffort = covered.length > 0 ? totalEffort / covered.length : 0;

    return {
      name: list.name,
      total_words: list.words.length,
      covered: covered.length,
      missing: missing.length,
      coverage_percent: (covered.length / list.words.length) * 100,
      missing_words: missing,
      average_effort: averageEffort,
    };
  }

  /**
   * Calculate coverage percentage for a specific word list
   */
  calculateCoverage(
    wordList: string[],
    metrics: MetricsResult
  ): {
    covered: string[];
    missing: string[];
    coverage_percent: number;
  } {
    const wordSet = new Set(metrics.buttons.map((btn) => btn.label.toLowerCase()));

    const covered: string[] = [];
    const missing: string[] = [];

    wordList.forEach((word) => {
      if (wordSet.has(word.toLowerCase())) {
        covered.push(word);
      } else {
        missing.push(word);
      }
    });

    return {
      covered,
      missing,
      coverage_percent: (covered.length / wordList.length) * 100,
    };
  }

  /**
   * Get effort for a word, or calculate spelling effort if missing
   */
  getWordEffort(word: string, metrics: MetricsResult): number {
    const btn = metrics.buttons.find((b) => b.label.toLowerCase() === word.toLowerCase());
    if (btn) {
      return btn.effort;
    }
    return spellingEffort(word);
  }

  /**
   * Check if a word is in the board set
   */
  hasWord(word: string, metrics: MetricsResult): boolean {
    return metrics.buttons.some((b) => b.label.toLowerCase() === word.toLowerCase());
  }
}
