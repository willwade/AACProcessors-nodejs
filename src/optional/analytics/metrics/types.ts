/**
 * Metrics Types and Interfaces
 *
 * Defines the data structures used for AAC metrics analysis
 */

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
