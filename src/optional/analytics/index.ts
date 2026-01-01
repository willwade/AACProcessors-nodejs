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

import path from "path";
import fs from "fs";

// Always-available exports
export * from "./metrics/types";
export * from "./metrics/effort";
export * from "./utils/idGenerator";

// Export history functionality
export * from "./history";

// Export OBL logging support
export * from "./metrics/obl-types";
export { OblUtil, OblAnonymizer } from "./metrics/obl";

// Export core metrics calculator
export { MetricsCalculator } from "./metrics/core";

// Export vocabulary and comparison analyzers
export { VocabularyAnalyzer } from "./metrics/vocabulary";
export { SentenceAnalyzer } from "./metrics/sentence";
export { ComparisonAnalyzer } from "./metrics/comparison";
export { ReferenceLoader } from "./reference";

/**
 * Get the default reference data path
 */
export function getReferenceDataPath(): string {
  return path.join(__dirname, "reference", "data");
}

/**
 * Check if reference data files exist
 */
export function hasReferenceData(): boolean {
  const dataPath = getReferenceDataPath();
  const requiredFiles = [
    "core_lists.en.json",
    "common_words.en.json",
    "sentences.en.json",
    "synonyms.en.json",
    "fringe.en.json",
  ];

  return requiredFiles.every((file) =>
    fs.existsSync(path.join(dataPath, file)),
  );
}
