/**
 * Comparative Analysis
 *
 * Compares two AAC board sets to identify missing/extra words,
 * analyze vocabulary differences, and generate CARE component scores.
 */

import { MetricsResult, ButtonMetrics, ComparisonResult } from './types';
import { SentenceAnalyzer } from './sentence';
import { VocabularyAnalyzer } from './vocabulary';
import { ReferenceLoader, type ReferenceDataProvider } from '../reference/index';
import { spellingEffort, predictionEffort } from './effort';
import { MetricsOptions } from './types';

export class ComparisonAnalyzer {
  private vocabAnalyzer: VocabularyAnalyzer;
  private sentenceAnalyzer: SentenceAnalyzer;
  private referenceLoader: ReferenceDataProvider;

  constructor(referenceLoader?: ReferenceDataProvider) {
    this.vocabAnalyzer = new VocabularyAnalyzer(referenceLoader);
    this.sentenceAnalyzer = new SentenceAnalyzer();
    this.referenceLoader = referenceLoader || new ReferenceLoader();
  }

  private normalize(word: string): string {
    return word
      .toLowerCase()
      .trim()
      .replace(/[.?!,]/g, '');
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
    } & Partial<MetricsOptions>
  ): ComparisonResult {
    // Create base result from target
    const baseResult = { ...targetResult };

    // Create word maps with normalized keys
    const targetWords = new Map<string, ButtonMetrics>();
    targetResult.buttons.forEach((btn) => {
      const key = this.normalize(btn.label);
      const existing = targetWords.get(key);
      if (!existing || btn.effort < existing.effort) {
        targetWords.set(key, btn);
      }
    });

    const compareWords = new Map<string, ButtonMetrics>();
    compareResult.buttons.forEach((btn) => {
      const key = this.normalize(btn.label);
      const existing = compareWords.get(key);
      if (!existing || btn.effort < existing.effort) {
        compareWords.set(key, btn);
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
      const key = this.normalize(btn.label);
      const compBtn = compareWords.get(key);
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
      options
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
      const diffA = (targetBtnA?.effort || 0) - (compareWords.get(a)?.effort || 0);
      const diffB = (targetBtnB?.effort || 0) - (compareWords.get(b)?.effort || 0);
      return diffB - diffA;
    });

    lowEffortWords.sort((a, b) => {
      const targetBtnA = targetWords.get(a);
      const targetBtnB = targetWords.get(b);
      const diffA = (compareWords.get(a)?.effort || 0) - (targetBtnA?.effort || 0);
      const diffB = (compareWords.get(b)?.effort || 0) - (targetBtnB?.effort || 0);
      return diffB - diffA;
    });

    // Sentence analysis
    let sentences: any[] = [];
    if (options?.includeSentences) {
      const testSentences = this.referenceLoader.loadSentences();
      const targetSentences = this.sentenceAnalyzer.analyzeSentences(targetResult, testSentences);
      const compareSentences = this.sentenceAnalyzer.analyzeSentences(compareResult, testSentences);

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
        const key = this.normalize(word);
        const targetBtn = targetWords.get(key);
        const compareBtn = compareWords.get(key);

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
        target_covered: targetCovered,
        compare_covered: compareCovered,
        total_words: list.words.length,
      };
    });

    // Analyze missing from specific lists
    const missing: { [listId: string]: any } = {};
    coreLists.forEach((list) => {
      const listMissing: string[] = [];
      list.words.forEach((word) => {
        const key = this.normalize(word);
        if (!targetWords.has(key)) {
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
    const commonFringeWords = this.analyzeCommonFringe(targetWords, compareWords);

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
      comp_spelling_effort_base: compareResult.spelling_effort_base,
      comp_spelling_effort_per_letter: compareResult.spelling_effort_per_letter,
      comp_spelling_page_id: compareResult.spelling_page_id,
      has_dynamic_prediction: targetResult.has_dynamic_prediction,
      prediction_page_id: targetResult.prediction_page_id,
      comp_has_dynamic_prediction: compareResult.has_dynamic_prediction,
      comp_prediction_page_id: compareResult.prediction_page_id,

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
    options?: {
      includeSentences?: boolean;
      locale?: string;
    } & Partial<MetricsOptions>
  ): ComparisonResult['care_components'] {
    // Load common words with baseline efforts (matching Ruby line 527-534)
    const commonWordsData = this.referenceLoader.loadCommonWords();
    const commonWords = new Map<string, number>();
    commonWordsData.words.forEach((word: string) => {
      commonWords.set(word.toLowerCase(), commonWordsData.efforts[word] || 0);
    });

    // Determine prediction settings (default: use common words efforts, not prediction)
    const usePrediction = options?.usePrediction || false; // Default FALSE (use common words)
    const predictionSelections = options?.predictionSelections || 1.5;
    const debugMode = process.env.DEBUG_METRICS === 'true';

    // Helper function to calculate fallback effort
    const getFallbackEffort = (
      word: string,
      hasPrediction: boolean,
      spellingBaseEffort?: number
    ): number => {
      const wordLower = word.toLowerCase();

      // Check common words efforts first (matching Ruby line 533)
      if (commonWords.has(wordLower)) {
        const effort = commonWords.get(wordLower);
        return effort !== undefined ? effort : spellingEffort(word, 10, 2.5);
      }

      // If usePrediction is true and prediction is available, use prediction
      if (usePrediction && hasPrediction && spellingBaseEffort !== undefined) {
        return predictionEffort(spellingBaseEffort, 2.5, predictionSelections, 2);
      }

      // Fallback to manual spelling (matching Ruby spelling_effort: 10 + word.length * 2.5)
      return spellingEffort(word, 10, 2.5);
    };

    // Debug: Check settings
    const targetHasPrediction =
      targetResult.has_dynamic_prediction && targetResult.spelling_effort_base !== undefined;
    const _compareHasPrediction =
      compareResult.has_dynamic_prediction && compareResult.spelling_effort_base !== undefined;
    if (debugMode) {
      console.log(`\n🔍 DEBUG Fallback Effort Settings:`);
      console.log(`  Common words loaded: ${commonWords.size}`);
      console.log(`  usePrediction option: ${usePrediction}`);
      console.log(`  Target has prediction capability: ${targetHasPrediction}`);
      console.log(
        `  Target spelling_base: ${targetResult.spelling_effort_base?.toFixed(2) || 'undefined'}`
      );
    }
    // Create word maps with normalized keys
    const targetWords = new Map<string, ButtonMetrics>();
    targetResult.buttons.forEach((btn) => {
      const key = this.normalize(btn.label);
      const existing = targetWords.get(key);
      if (!existing || btn.effort < existing.effort) {
        targetWords.set(key, btn);
      }
    });

    const compareWords = new Map<string, ButtonMetrics>();
    compareResult.buttons.forEach((btn) => {
      const key = this.normalize(btn.label);
      const existing = compareWords.get(key);
      if (!existing || btn.effort < existing.effort) {
        compareWords.set(key, btn);
      }
    });

    // Load reference data
    const coreLists = this.referenceLoader.loadCoreLists();
    const fringe = this.referenceLoader.loadFringe();
    const commonFringe = this.referenceLoader.loadCommonFringe();
    const sentences = this.referenceLoader.loadSentences();

    // Calculate core coverage and effort (matching Ruby lines 609-647)
    let coreCount = 0;
    let compCoreCount = 0;
    let targetCoreEffort = 0;
    let compCoreEffort = 0;
    const allCoreWords = new Set<string>();
    coreLists.forEach((list) => {
      list.words.forEach((word) => allCoreWords.add(word.toLowerCase()));
    });

    allCoreWords.forEach((word) => {
      const key = this.normalize(word);
      const targetBtn = targetWords.get(key);
      const compareBtn = compareWords.get(key);

      if (targetBtn) {
        coreCount++;
        targetCoreEffort += targetBtn.effort;
      } else {
        // Fallback to spelling or prediction effort
        targetCoreEffort += getFallbackEffort(
          word,
          targetResult.has_dynamic_prediction || false,
          targetResult.spelling_effort_base
        );
      }

      if (compareBtn) {
        compCoreCount++;
        compCoreEffort += compareBtn.effort;
      } else {
        compCoreEffort += getFallbackEffort(
          word,
          compareResult.has_dynamic_prediction || false,
          compareResult.spelling_effort_base
        );
      }
    });

    const avgCoreEffort = allCoreWords.size > 0 ? targetCoreEffort / allCoreWords.size : 0;
    const avgCompCoreEffort = allCoreWords.size > 0 ? compCoreEffort / allCoreWords.size : 0;

    // Calculate core component scores (matching Ruby lines 644-647)
    const coreScore = avgCoreEffort * 5.0;
    const compCoreScore = avgCompCoreEffort * 5.0;

    // Calculate sentence construction effort (matching Ruby lines 654-668)
    const sentenceEfforts: number[] = [];
    const compSentenceEfforts: number[] = [];

    sentences.forEach((words) => {
      let targetSentenceEffort = 0;
      let compSentenceEffort = 0;

      words.forEach((word) => {
        const key = this.normalize(word);
        const targetBtn = targetWords.get(key);
        const compareBtn = compareWords.get(key);

        if (targetBtn) {
          targetSentenceEffort += targetBtn.effort;
        } else {
          targetSentenceEffort += getFallbackEffort(
            word,
            targetResult.has_dynamic_prediction || false,
            targetResult.spelling_effort_base
          );
        }

        if (compareBtn) {
          compSentenceEffort += compareBtn.effort;
        } else {
          compSentenceEffort += getFallbackEffort(
            word,
            compareResult.has_dynamic_prediction || false,
            compareResult.spelling_effort_base
          );
        }
      });

      // Average effort per sentence (matching Ruby line 657)
      sentenceEfforts.push(targetSentenceEffort / words.length);
      compSentenceEfforts.push(compSentenceEffort / words.length);
    });

    const avgSentenceEffort =
      sentenceEfforts.length > 0
        ? sentenceEfforts.reduce((a, b) => a + b, 0) / sentenceEfforts.length
        : 0;
    const compAvgSentenceEffort =
      compSentenceEfforts.length > 0
        ? compSentenceEfforts.reduce((a, b) => a + b, 0) / compSentenceEfforts.length
        : 0;

    // Sentence component scores (matching Ruby line 665-668)
    const sentenceScore = avgSentenceEffort * 3.0;
    const compSentenceScore = compAvgSentenceEffort * 3.0;

    // Calculate fringe effort (matching Ruby lines 670-687)
    const fringeEfforts: number[] = [];
    const compFringeEfforts: number[] = [];
    let fringeCount = 0;
    let compFringeCount = 0;

    fringe.forEach((word: string) => {
      const key = this.normalize(word);
      const targetBtn = targetWords.get(key);
      const compareBtn = compareWords.get(key);

      if (targetBtn) {
        fringeEfforts.push(targetBtn.effort);
        fringeCount++;
      } else {
        fringeEfforts.push(
          getFallbackEffort(
            word,
            targetResult.has_dynamic_prediction || false,
            targetResult.spelling_effort_base
          )
        );
      }

      if (compareBtn) {
        compFringeEfforts.push(compareBtn.effort);
        compFringeCount++;
      } else {
        compFringeEfforts.push(
          getFallbackEffort(
            word,
            compareResult.has_dynamic_prediction || false,
            compareResult.spelling_effort_base
          )
        );
      }
    });

    const avgFringeEffort =
      fringeEfforts.length > 0
        ? fringeEfforts.reduce((a, b) => a + b, 0) / fringeEfforts.length
        : 0;
    const avgCompFringeEffort =
      compFringeEfforts.length > 0
        ? compFringeEfforts.reduce((a, b) => a + b, 0) / compFringeEfforts.length
        : 0;

    // Fringe component scores (matching Ruby line 684-687)
    const fringeScore = avgFringeEffort * 2.0;
    const compFringeScore = avgCompFringeEffort * 2.0;

    // Calculate common fringe effort (matching Ruby lines 689-705)
    const commonFringeEfforts: number[] = [];
    const compCommonFringeEfforts: number[] = [];
    let commonFringeCount = 0;

    commonFringe.forEach((word: string) => {
      const key = this.normalize(word);
      const targetBtn = targetWords.get(key);
      const compareBtn = compareWords.get(key);

      if (targetBtn && compareBtn) {
        commonFringeEfforts.push(targetBtn.effort);
        compCommonFringeEfforts.push(compareBtn.effort);
        commonFringeCount++;
      }
    });

    const avgCommonFringeEffort =
      commonFringeEfforts.length > 0
        ? commonFringeEfforts.reduce((a, b) => a + b, 0) / commonFringeEfforts.length
        : 0;
    const avgCompCommonFringeEffort =
      compCommonFringeEfforts.length > 0
        ? compCommonFringeEfforts.reduce((a, b) => a + b, 0) / compCommonFringeEfforts.length
        : 0;

    // Common fringe component scores (matching Ruby line 702-705)
    const commonFringeScore = avgCommonFringeEffort * 1.0;
    const compCommonFringeScore = avgCompCommonFringeEffort * 1.0;

    // Calculate total CARE effort tally (matching Ruby lines 707-708)
    const PLACEHOLDER = 70;
    const targetEffortTally =
      coreScore + sentenceScore + fringeScore + commonFringeScore + PLACEHOLDER;
    const compEffortTally =
      compCoreScore + compSentenceScore + compFringeScore + compCommonFringeScore + PLACEHOLDER;

    // Calculate final CARE scores (matching Ruby line 710-711)
    // res[:target_effort_score] = [0.0, 350.0 - target_effort_tally].max
    const careScore = Math.max(0, 350.0 - targetEffortTally);
    const compCareScore = Math.max(0, 350.0 - compEffortTally);

    return {
      core: coreCount,
      comp_core: compCoreCount,
      sentences: avgSentenceEffort,
      comp_sentences: compAvgSentenceEffort,
      fringe: fringeCount,
      comp_fringe: compFringeCount,
      common_fringe: commonFringeCount,
      comp_common_fringe: commonFringeCount,
      // New composite CARE scores
      care_score: careScore,
      comp_care_score: compCareScore,
    };
  }

  /**
   * Analyze fringe vocabulary
   */
  private analyzeFringe(
    targetWords: Map<string, ButtonMetrics>,
    compareWords: Map<string, ButtonMetrics>
  ): Array<{ word: string; effort: number; comp_effort: number }> {
    const fringe = this.referenceLoader.loadFringe();
    const result: Array<{ word: string; effort: number; comp_effort: number }> = [];

    fringe.forEach((word) => {
      const key = this.normalize(word);
      const targetBtn = targetWords.get(key);
      const compareBtn = compareWords.get(key);

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
    compareWords: Map<string, ButtonMetrics>
  ): Array<{ word: string; effort: number; comp_effort: number }> {
    const fringe = this.referenceLoader.loadFringe();
    const result: Array<{ word: string; effort: number; comp_effort: number }> = [];

    fringe.forEach((word) => {
      const key = this.normalize(word);
      const targetBtn = targetWords.get(key);
      const compareBtn = compareWords.get(key);

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
