/**
 * AAC Analytics Module (Optional)
 *
 * This module provides metrics calculation and analysis for AAC board sets.
 * The core types, utilities, and effort functions are always available.
 *
 * This module is similar to symbolTools - the functionality is here but
 * you only use it if you need it. No special installation required.
 *
 * @module
 */

import { defaultFileAdapter, FileAdapter } from '../../utils/io';

// Always-available exports
export * from './metrics/types';
export * from './metrics/effort';
export * from './utils/idGenerator';

// Export history functionality
export * from './history';

// Export OBL logging support
export * from './metrics/obl-types';
export { OblUtil, OblAnonymizer } from './metrics/obl';

// Export core metrics calculator
export { MetricsCalculator } from './metrics/core';

// Export vocabulary and comparison analyzers
export { VocabularyAnalyzer } from './metrics/vocabulary';
export { SentenceAnalyzer } from './metrics/sentence';
export { ComparisonAnalyzer } from './metrics/comparison';
export { ReferenceLoader } from './reference';

// Export linguistic-competence measures (privacy-preserving spoken-output analysis)
export * from './competence';

/**
 * Get the default reference data path
 */
export function getReferenceDataPath(fileAdapter: FileAdapter): string {
  const { join } = fileAdapter;
  return join(__dirname, 'reference', 'data');
}

/**
 * Check if reference data files exist
 */
export async function hasReferenceData(
  fileAdapter: FileAdapter = defaultFileAdapter
): Promise<boolean> {
  const { pathExists, join } = fileAdapter;
  const dataPath = getReferenceDataPath(fileAdapter);
  const requiredFiles = [
    'core_lists.en.json',
    'common_words.en.json',
    'sentences.en.json',
    'synonyms.en.json',
    'fringe.en.json',
  ];

  const existingPaths = await Promise.all(
    requiredFiles.map(async (file) => await pathExists(join(dataPath, file)))
  );
  return existingPaths.every((exists) => exists);
}
