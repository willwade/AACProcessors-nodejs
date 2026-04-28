/**
 * Metrics Types and Interfaces
 *
 * Defines the data structures used for AAC metrics analysis
 */

import { ScanningConfig } from "../../../types/aac";

// import { AACTree } from '../../../types/aac';

/**
 * Button-level metrics result
 */
export interface ButtonMetrics {
  id: string;
  label: string;
  level: number; // How many boards deep from root
  effort: number; // Overall effort score (lower is easier)
  count?: number; // How many times this word appears in the set
  semantic_id?: string;
  clone_id?: string;
  temporary_home_id?: string; // For temporary home navigation
  comp_level?: number; // Comparison: level in comparison set
  comp_effort?: number; // Comparison: effort in comparison set
  // Word form metrics (for smart grammar predictions)
  is_word_form?: boolean; // True if this is a word form from predictions
  is_suggest_words?: boolean; // True if produced via Suggest Words (requires extra tap)
  parent_button_id?: string; // ID of parent button that has these predictions
  parent_button_label?: string; // Label of parent button
  pos?: string; // Part-of-speech tag from gridset (e.g., 'Verb', 'Noun')
}

/**
 * Board/page level analysis result
 */
export interface BoardAnalysis {
  boardId: string;
  level: number;
  entryX: number; // Entry point X coordinate (0-1 normalized)
  entryY: number; // Entry point Y coordinate (0-1 normalized)
  priorEffort?: number; // Cumulative effort to reach this board
  temporaryHomeId?: string; // Temporary home board ID
}

/**
 * Metrics analysis result
 */
export interface MetricsResult {
  analysis_version: string;
  locale: string;
  total_boards: number;
  total_buttons: number;
  total_words: number;
  reference_counts: { [id: string]: number }; // Frequency of semantic/clone IDs
  grid: {
    rows: number;
    columns: number;
  };
  buttons: ButtonMetrics[];
  levels: { [level: number]: ButtonMetrics[] }; // Buttons grouped by level
  alternates?: { [boardId: string]: AlternateBoardMetrics };
  spelling_effort_base?: number;
  spelling_effort_per_letter?: number;
  spelling_page_id?: string;
  has_dynamic_prediction?: boolean;
  prediction_page_id?: string;
  obfset?: any; // Full board set data (if include_obfset=true)
}

/**
 * Alternate board metrics (for temporary home navigation)
 */
export interface AlternateBoardMetrics {
  buttons: ButtonMetrics[];
  levels: { [level: number]: ButtonMetrics[] };
}

/**
 * Options for metrics calculation
 */
export interface MetricsOptions {
  /**
   * Override scanning configuration
   */
  scanningConfig?: ScanningConfig;

  /**
   * Path to core vocabulary lists to use for analysis
   */
  coreLists?: string[];

  /**
   * Test sentences for sentence-level effort analysis
   */
  testSentences?: string[];

  /**
   * Custom scanning costs
   */
  scanStepCost?: number;
  scanSelectionCost?: number;

  /**
   * Optional explicit ID of the spelling/keyboard page
   */
  spellingPageId?: string;

  /**
   * Whether to use prediction for missing words
   *
   * When true (default): Words not in the board are assumed to be accessible
   * via prediction at reduced effort (spelling_page_base + prediction_selection)
   *
   * When false: Words not in the board must be manually spelled at full effort
   * (10 + word_length * 2.5 per letter)
   *
   * Only applies when the board has prediction capability (e.g., SwiftKey)
   */
  usePrediction?: boolean;

  /**
   * Average number of selections to find a word in prediction
   *
   * When prediction is enabled, this estimates how many prediction
   * slots a user needs to check before finding their target word.
   * Default is 1.5 (checking 1-2 predictions on average).
   */
  predictionSelections?: number;

  /**
   * Whether to include smart grammar word forms in metrics
   *
   * When true: Word forms from smart grammar predictions are included
   * in the metrics. If a word exists as both a regular button and a word form,
   * the version with lower effort is used.
   *
   * When false: Smart grammar word forms are excluded from metrics. Only actual
   * buttons in the tree are analyzed.
   *
   * Auto-detected by default: if any button in the tree has a POS tag (e.g.,
   * from Grid 3's Action.InsertText), smart grammar is enabled automatically.
   * For non-Grid-3 formats (TD Snap, TouchChat, OBF), no buttons have POS tags,
   * so smart grammar is automatically disabled with zero overhead.
   *
   * Set explicitly to `true` to force-enable, or `false` to force-disable.
   */
  useSmartGrammar?: boolean;

  /**
   * Locale for morphological inflection rules
   *
   * When provided, the MorphologyEngine will generate inflected word forms
   * (e.g., "going", "went" for "go") based on the POS tags extracted from
   * the gridset. Defaults to 'en-gb'.
   *
   * Only used when useSmartGrammar is true.
   */
  morphologyLocale?: string;
}

/**
 * Comparison result between two board sets
 */
export interface ComparisonResult extends MetricsResult {
  // Target set metrics
  target_effort_score: number;

  // Comparison set metrics
  comp_boards: number;
  comp_buttons: number;
  comp_words: number;
  comp_grid: { rows: number; columns: number };
  comp_effort_score: number;
  comp_spelling_effort_base?: number;
  comp_spelling_effort_per_letter?: number;
  comp_spelling_page_id?: string;
  has_dynamic_prediction?: boolean;
  prediction_page_id?: string;
  comp_has_dynamic_prediction?: boolean;
  comp_prediction_page_id?: string;

  // Vocabulary comparison
  missing_words: string[]; // Words in comparison but not in target
  extra_words: string[]; // Words in target but not in comparison
  overlapping_words: string[]; // Words in both sets

  // Missing from specific word lists
  missing: {
    [listId: string]: {
      name: string;
      list: string[];
    };
  };

  // Words that are harder/easier than expected
  high_effort_words: string[]; // Consider making easier
  low_effort_words: string[]; // Consider less priority

  // Core vocabulary analysis
  cores: {
    [listId: string]: {
      name: string;
      list: string[];
      average_effort: number;
      comp_effort: number;
    };
  };

  // CARE components
  care_components: {
    core: number;
    comp_core: number;
    sentences: number;
    comp_sentences: number;
    fringe: number;
    comp_fringe: number;
    common_fringe: number;
    comp_common_fringe: number;
    care_score: number; // Composite CARE score (matching Ruby)
    comp_care_score: number; // Composite CARE score for comparison set
  };

  // Sentence analysis
  sentences: SentenceAnalysis[];

  // Fringe vocabulary
  fringe_words: FringeWord[];
  common_fringe_words: FringeWord[];
}

/**
 * Sentence construction analysis
 */
export interface SentenceAnalysis {
  sentence: string; // Full sentence text
  words: string[]; // Individual words
  effort: number; // Average effort per word in target set
  typing: boolean; // True if spelling fallback was used
  comp_effort: number; // Average effort per word in comparison set
  comp_typing: boolean; // True if spelling fallback in comparison
}

/**
 * Fringe vocabulary word analysis
 */
export interface FringeWord {
  word: string;
  effort: number; // Effort to access this word
  comp_effort: number; // Effort in comparison set
}

/**
 * Core vocabulary list definition
 */
export interface CoreList {
  id: string;
  name: string;
  url?: string;
  locale: string;
  words: string[];
}

/**
 * Common words reference data
 */
export interface CommonWordsData {
  version: string;
  files: string[];
  words: string[];
  efforts: { [word: string]: number }; // Baseline effort scores
}

/**
 * Synonym mappings
 */
export interface SynonymsData {
  [word: string]: string[]; // Maps word to array of synonyms
}
