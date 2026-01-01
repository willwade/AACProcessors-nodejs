/**
 * Comparative Analysis
 *
 * Compares two AAC board sets to identify missing/extra words,
 * analyze vocabulary differences, and generate CARE component scores.
 */

import { MetricsResult, ButtonMetrics, ComparisonResult } from "./types";
import { SentenceAnalyzer } from "./sentence";
import { VocabularyAnalyzer } from "./vocabulary";
import { ReferenceLoader } from "../reference/index";

export class ComparisonAnalyzer {
  private vocabAnalyzer: VocabularyAnalyzer;
  private sentenceAnalyzer: SentenceAnalyzer;
  private referenceLoader: ReferenceLoader;

  constructor() {
    this.vocabAnalyzer = new VocabularyAnalyzer();
    this.sentenceAnalyzer = new SentenceAnalyzer();
    this.referenceLoader = new ReferenceLoader();
  }

  /**
   * Compare two board sets
   */
  compare(
    targetResult: MetricsResult,
    compareResult: MetricsResult,
    options?: {
      includeSentences?: boolean;
      locale?: string;
    },
  ): ComparisonResult {
    // Create base result from target
    const baseResult = { ...targetResult };

    // Create word maps
    const targetWords = new Map<string, ButtonMetrics>();
    targetResult.buttons.forEach((btn) => {
      const existing = targetWords.get(btn.label);
      if (!existing || btn.effort < existing.effort) {
        targetWords.set(btn.label, btn);
      }
    });

    const compareWords = new Map<string, ButtonMetrics>();
    compareResult.buttons.forEach((btn) => {
      const existing = compareWords.get(btn.label);
      if (!existing || btn.effort < existing.effort) {
        compareWords.set(btn.label, btn);
      }
    });

    // Find missing/extra/overlapping words
    const missingWords: string[] = [];
    const extraWords: string[] = [];
    const overlappingWords: string[] = [];

    // Words in comparison but not in target
    compareWords.forEach((btn, label) => {
      if (!targetWords.has(label)) {
        missingWords.push(label);
      } else {
        overlappingWords.push(label);
      }
    });

    // Words in target but not in comparison
    targetWords.forEach((btn, label) => {
      if (!compareWords.has(label)) {
        extraWords.push(label);
      }
    });

    // Sort alphabetically
    missingWords.sort((a, b) => a.localeCompare(b));
    extraWords.sort((a, b) => a.localeCompare(b));
    overlappingWords.sort((a, b) => a.localeCompare(b));

    // Add comparison metrics to buttons
    const enrichedButtons = targetResult.buttons.map((btn) => {
      const compBtn = compareWords.get(btn.label);
      return {
        ...btn,
        comp_level: compBtn?.level,
        comp_effort: compBtn?.effort,
      };
    });

    // Calculate CARE components
    const careComponents = this.calculateCareComponents(
      targetResult,
      compareResult,
      overlappingWords,
    );

    // Analyze high/low effort words
    const highEffortWords: string[] = [];
    const lowEffortWords: string[] = [];

    targetWords.forEach((btn, label) => {
      const compBtn = compareWords.get(label);
      const compEffort = compBtn?.effort || 0;

      // Word is harder in target than comparison
      if (compEffort > 0 && btn.effort > compEffort * 1.5) {
        highEffortWords.push(label);
      }
      // Word is easier in target than comparison
      else if (compEffort > 0 && btn.effort < compEffort * 0.67) {
        lowEffortWords.push(label);
      }
    });

    highEffortWords.sort((a, b) => {
      const targetBtnA = targetWords.get(a);
      const targetBtnB = targetWords.get(b);
      const diffA =
        (targetBtnA?.effort || 0) - (compareWords.get(a)?.effort || 0);
      const diffB =
        (targetBtnB?.effort || 0) - (compareWords.get(b)?.effort || 0);
      return diffB - diffA;
    });

    lowEffortWords.sort((a, b) => {
      const targetBtnA = targetWords.get(a);
      const targetBtnB = targetWords.get(b);
      const diffA =
        (compareWords.get(a)?.effort || 0) - (targetBtnA?.effort || 0);
      const diffB =
        (compareWords.get(b)?.effort || 0) - (targetBtnB?.effort || 0);
      return diffB - diffA;
    });

    // Sentence analysis
    let sentences: any[] = [];
    if (options?.includeSentences) {
      const testSentences = this.referenceLoader.loadSentences();
      const targetSentences = this.sentenceAnalyzer.analyzeSentences(
        targetResult,
        testSentences,
      );
      const compareSentences = this.sentenceAnalyzer.analyzeSentences(
        compareResult,
        testSentences,
      );

      sentences = targetSentences.map((ts, idx) => ({
        sentence: ts.sentence,
        words: ts.words,
        effort: ts.effort,
        typing: ts.typing,
        comp_effort: compareSentences[idx]?.effort || 0,
        comp_typing: compareSentences[idx]?.typing || false,
      }));
    }

    // Core vocabulary analysis
    const coreLists = this.referenceLoader.loadCoreLists();
    const cores: { [listId: string]: any } = {};

    coreLists.forEach((list) => {
      let targetTotal = 0;
      let compareTotal = 0;
      let targetCovered = 0;
      let compareCovered = 0;

      list.words.forEach((word) => {
        const targetBtn = targetWords.get(word);
        const compareBtn = compareWords.get(word);

        if (targetBtn) {
          targetCovered++;
          targetTotal += targetBtn.effort;
        }
        if (compareBtn) {
          compareCovered++;
          compareTotal += compareBtn.effort;
        }
      });

      cores[list.id] = {
        name: list.name,
        list: list.words,
        average_effort: targetCovered > 0 ? targetTotal / targetCovered : 0,
        comp_effort: compareCovered > 0 ? compareTotal / compareCovered : 0,
      };
    });

    // Analyze missing from specific lists
    const missing: { [listId: string]: any } = {};
    coreLists.forEach((list) => {
      const listMissing: string[] = [];
      list.words.forEach((word) => {
        if (!targetWords.has(word)) {
          listMissing.push(word);
        }
      });

      if (listMissing.length > 0) {
        missing[list.id] = {
          name: list.name,
          list: listMissing,
        };
      }
    });

    // Fringe vocabulary analysis
    const fringeWords = this.analyzeFringe(targetWords, compareWords);
    const commonFringeWords = this.analyzeCommonFringe(
      targetWords,
      compareWords,
    );

    return {
      ...baseResult,
      buttons: enrichedButtons,

      // Target set metrics
      target_effort_score: this.calculateEffortScore(targetResult),

      // Comparison set metrics
      comp_boards: compareResult.total_boards,
      comp_buttons: compareResult.total_buttons,
      comp_words: compareResult.total_words,
      comp_grid: compareResult.grid,
      comp_effort_score: this.calculateEffortScore(compareResult),

      // Vocabulary comparison
      missing_words: missingWords,
      extra_words: extraWords,
      overlapping_words: overlappingWords,

      // Missing from lists
      missing,

      // High/low effort words
      high_effort_words: highEffortWords.slice(0, 100),
      low_effort_words: lowEffortWords.slice(0, 100),

      // Core analysis
      cores,

      // CARE components
      care_components: careComponents,

      // Sentences
      sentences,

      // Fringe
      fringe_words: fringeWords,
      common_fringe_words: commonFringeWords,
    };
  }

  /**
   * Calculate CARE component scores
   */
  private calculateCareComponents(
    targetResult: MetricsResult,
    compareResult: MetricsResult,
    _overlappingWords: string[],
  ): ComparisonResult["care_components"] {
    // Create word maps
    const targetWords = new Map<string, ButtonMetrics>();
    targetResult.buttons.forEach((btn) => {
      const existing = targetWords.get(btn.label);
      if (!existing || btn.effort < existing.effort) {
        targetWords.set(btn.label, btn);
      }
    });

    const compareWords = new Map<string, ButtonMetrics>();
    compareResult.buttons.forEach((btn) => {
      const existing = compareWords.get(btn.label);
      if (!existing || btn.effort < existing.effort) {
        compareWords.set(btn.label, btn);
      }
    });

    // Load reference data
    const coreLists = this.referenceLoader.loadCoreLists();
    const fringe = this.referenceLoader.loadFringe();
    const sentences = this.referenceLoader.loadSentences();

    // Calculate core coverage
    let coreCount = 0;
    let compCoreCount = 0;
    const allCoreWords = new Set<string>();
    coreLists.forEach((list) => {
      list.words.forEach((word) => allCoreWords.add(word.toLowerCase()));
    });

    allCoreWords.forEach((word) => {
      if (targetWords.has(word)) coreCount++;
      if (compareWords.has(word)) compCoreCount++;
    });

    // Calculate sentence construction effort
    let sentenceEffort = 0;
    let compSentenceEffort = 0;
    let sentenceWordCount = 0;

    sentences.forEach((words) => {
      words.forEach((word) => {
        const targetBtn = targetWords.get(word);
        const compareBtn = compareWords.get(word);

        if (targetBtn) {
          sentenceEffort += targetBtn.effort;
        } else {
          sentenceEffort += 10 + word.length * 2.5; // Spelling effort
        }

        if (compareBtn) {
          compSentenceEffort += compareBtn.effort;
        } else {
          compSentenceEffort += 10 + word.length * 2.5;
        }

        sentenceWordCount++;
      });
    });

    const avgSentenceEffort =
      sentenceWordCount > 0 ? sentenceEffort / sentenceWordCount : 0;
    const compAvgSentenceEffort =
      sentenceWordCount > 0 ? compSentenceEffort / sentenceWordCount : 0;

    // Calculate fringe coverage
    let fringeCount = 0;
    let compFringeCount = 0;
    let commonFringeCount = 0;

    fringe.forEach((word) => {
      const inTarget = targetWords.has(word);
      const inCompare = compareWords.has(word);

      if (inTarget) fringeCount++;
      if (inCompare) compFringeCount++;
      if (inTarget && inCompare) commonFringeCount++;
    });

    return {
      core: coreCount,
      comp_core: compCoreCount,
      sentences: avgSentenceEffort,
      comp_sentences: compAvgSentenceEffort,
      fringe: fringeCount,
      comp_fringe: compFringeCount,
      common_fringe: commonFringeCount,
      comp_common_fringe: commonFringeCount,
    };
  }

  /**
   * Analyze fringe vocabulary
   */
  private analyzeFringe(
    targetWords: Map<string, ButtonMetrics>,
    compareWords: Map<string, ButtonMetrics>,
  ): Array<{ word: string; effort: number; comp_effort: number }> {
    const fringe = this.referenceLoader.loadFringe();
    const result: Array<{ word: string; effort: number; comp_effort: number }> =
      [];

    fringe.forEach((word) => {
      const targetBtn = targetWords.get(word);
      const compareBtn = compareWords.get(word);

      if (targetBtn) {
        result.push({
          word,
          effort: targetBtn.effort,
          comp_effort: compareBtn?.effort || 0,
        });
      }
    });

    result.sort((a, b) => a.effort - b.effort);
    return result;
  }

  /**
   * Analyze common fringe vocabulary
   */
  private analyzeCommonFringe(
    targetWords: Map<string, ButtonMetrics>,
    compareWords: Map<string, ButtonMetrics>,
  ): Array<{ word: string; effort: number; comp_effort: number }> {
    const fringe = this.referenceLoader.loadFringe();
    const result: Array<{ word: string; effort: number; comp_effort: number }> =
      [];

    fringe.forEach((word) => {
      const targetBtn = targetWords.get(word);
      const compareBtn = compareWords.get(word);

      if (targetBtn && compareBtn) {
        result.push({
          word,
          effort: targetBtn.effort,
          comp_effort: compareBtn.effort,
        });
      }
    });

    result.sort((a, b) => a.effort - b.effort);
    return result;
  }

  /**
   * Calculate overall effort score for a metrics result
   */
  private calculateEffortScore(result: MetricsResult): number {
    if (result.buttons.length === 0) return 0;

    let totalEffort = 0;
    result.buttons.forEach((btn) => {
      totalEffort += btn.effort;
    });

    return totalEffort / result.buttons.length;
  }
}
