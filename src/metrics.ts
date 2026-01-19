/**
 * Metrics Namespace
 *
 * Pageset-focused metrics and analytics (board structure, effort, vocabulary).
 * Use this for analyzing AAC trees, not end-user usage logs.
 */

export * from './utilities/analytics/metrics/types';
export * from './utilities/analytics/metrics/effort';
export * from './utilities/analytics/metrics/obl-types';
export { OblUtil, OblAnonymizer } from './utilities/analytics/metrics/obl';
export { MetricsCalculator } from './utilities/analytics/metrics/core';
export { VocabularyAnalyzer } from './utilities/analytics/metrics/vocabulary';
export { SentenceAnalyzer } from './utilities/analytics/metrics/sentence';
export { ComparisonAnalyzer } from './utilities/analytics/metrics/comparison';
export { ReferenceLoader } from './utilities/analytics/reference';
export {
  InMemoryReferenceLoader,
  createBrowserReferenceLoader,
  loadReferenceDataFromUrl,
  type ReferenceData,
} from './utilities/analytics/reference/browser';
export * from './utilities/analytics/utils/idGenerator';
