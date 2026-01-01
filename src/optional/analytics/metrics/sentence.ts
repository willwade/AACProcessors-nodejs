/**
 * Sentence Construction Analysis
 *
 * Calculates the effort required to construct test sentences
 * from the AAC board set, including spelling fallback for missing words.
 */

import { MetricsResult } from "./types";
import { spellingEffort } from "./effort";

export interface SentenceAnalysis {
  sentence: string; // Full sentence text
  words: string[]; // Individual words
  effort: number; // Average effort per word in target set
  total_effort: number; // Total effort for entire sentence
  typing: boolean; // True if spelling fallback was used
  missing_words: string[]; // Words that required spelling
  word_efforts: Array<{ word: string; effort: number; typed: boolean }>;
}

export class SentenceAnalyzer {
  /**
   * Analyze effort to construct a set of test sentences
   */
  analyzeSentences(
    metrics: MetricsResult,
    sentences: string[][],
  ): SentenceAnalysis[] {
    return sentences.map((words) => this.analyzeSentence(metrics, words));
  }

  /**
   * Analyze effort to construct a single sentence
   */
  analyzeSentence(metrics: MetricsResult, words: string[]): SentenceAnalysis {
    const wordEfforts: Array<{ word: string; effort: number; typed: boolean }> =
      [];
    let totalEffort = 0;
    let typing = false;
    const missingWords: string[] = [];

    // Create word lookup map
    const wordMap = new Map<string, { effort: number }>();
    metrics.buttons.forEach((btn) => {
      const existing = wordMap.get(btn.label.toLowerCase());
      if (!existing || btn.effort < existing.effort) {
        wordMap.set(btn.label.toLowerCase(), { effort: btn.effort });
      }
    });

    // Calculate effort for each word
    words.forEach((word) => {
      const lowerWord = word.toLowerCase();
      const found = wordMap.get(lowerWord);

      if (found) {
        wordEfforts.push({ word, effort: found.effort, typed: false });
        totalEffort += found.effort;
      } else {
        // Word not found - use spelling effort
        const spellEffort = spellingEffort(word);
        wordEfforts.push({ word, effort: spellEffort, typed: true });
        totalEffort += spellEffort;
        typing = true;
        missingWords.push(word);
      }
    });

    const averageEffort = totalEffort / words.length;

    // Reconstruct sentence for display
    const sentence = this.reconstructSentence(words);

    return {
      sentence,
      words,
      effort: averageEffort,
      total_effort: totalEffort,
      typing,
      missing_words: missingWords,
      word_efforts: wordEfforts,
    };
  }

  /**
   * Reconstruct sentence from word array
   */
  private reconstructSentence(words: string[]): string {
    return words
      .map((word, idx) => {
        // Capitalize first word
        if (idx === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toLowerCase();
      })
      .join(" ");
  }

  /**
   * Calculate statistics across all sentences
   */
  calculateStatistics(analyses: SentenceAnalysis[]): {
    total_sentences: number;
    sentences_requiring_typing: number;
    sentences_without_typing: number;
    average_effort: number;
    min_effort: number;
    max_effort: number;
    median_effort: number;
    total_words: number;
    words_requiring_typing: number;
    typing_percent: number;
  } {
    const totalSentences = analyses.length;
    const sentencesRequiringTyping = analyses.filter((a) => a.typing).length;
    const sentencesWithoutTyping = totalSentences - sentencesRequiringTyping;

    const efforts = analyses.map((a) => a.effort);
    const averageEffort =
      efforts.reduce((sum, e) => sum + e, 0) / efforts.length;
    const minEffort = Math.min(...efforts);
    const maxEffort = Math.max(...efforts);

    // Calculate median
    const sortedEfforts = [...efforts].sort((a, b) => a - b);
    const medianEffort =
      sortedEfforts.length % 2 === 0
        ? (sortedEfforts[sortedEfforts.length / 2 - 1] +
            sortedEfforts[sortedEfforts.length / 2]) /
          2
        : sortedEfforts[Math.floor(sortedEfforts.length / 2)];

    const totalWords = analyses.reduce((sum, a) => sum + a.words.length, 0);
    const wordsRequiringTyping = analyses.reduce(
      (sum, a) => sum + a.missing_words.length,
      0,
    );
    const typingPercent = (wordsRequiringTyping / totalWords) * 100;

    return {
      total_sentences: totalSentences,
      sentences_requiring_typing: sentencesRequiringTyping,
      sentences_without_typing: sentencesWithoutTyping,
      average_effort: averageEffort,
      min_effort: minEffort,
      max_effort: maxEffort,
      median_effort: medianEffort,
      total_words: totalWords,
      words_requiring_typing: wordsRequiringTyping,
      typing_percent: typingPercent,
    };
  }
}
