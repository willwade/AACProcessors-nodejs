/**
 * AAC Metrics Module
 *
 * Comprehensive metrics analysis for AAC board sets including:
 * - Effort score calculation with motor planning
 * - Vocabulary coverage analysis
 * - Sentence construction evaluation
 * - Comparative analysis between board sets
 */

export { MetricsCalculator } from './core';
export { VocabularyAnalyzer } from './vocabulary';
export { SentenceAnalyzer } from './sentence';
export { ComparisonAnalyzer } from './comparison';

export * from './types';
export * from './effort';
