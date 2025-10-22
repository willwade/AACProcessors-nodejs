#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildVocabularySummary } = require('./extract-vocabulary');

function requireLibrary() {
  const distPath = path.resolve(__dirname, '../../dist');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(distPath);
  } catch (error) {
    console.error('Unable to load the built library from dist/. Have you run "npm run build"?');
    throw error;
  }
}

function loadVocabularySet(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }

  const { getProcessor } = requireLibrary();
  const processor = getProcessor(resolved);
  const tree = processor.loadIntoTree(resolved);
  const summary = buildVocabularySummary(tree);
  return {
    summary,
    set: new Set(summary.uniqueVocabulary),
    source: resolved,
  };
}

function diffSets(left, right) {
  return Array.from(left).filter((item) => !right.has(item)).sort((a, b) => a.localeCompare(b));
}

function main() {
  const [firstInput = path.resolve(__dirname, '../../examples/example.sps'), secondInput = path.resolve(__dirname, '../../examples/example2.grd')] = process.argv.slice(2);

  const first = loadVocabularySet(firstInput);
  const second = loadVocabularySet(secondInput);

  console.log(`Comparing vocabulary between:\n - ${first.source}\n - ${second.source}`);
  console.log(`\n${first.summary.uniqueVocabulary.length} unique terms in first file.`);
  console.log(`${second.summary.uniqueVocabulary.length} unique terms in second file.`);

  const firstOnly = diffSets(first.set, second.set);
  const secondOnly = diffSets(second.set, first.set);
  const overlap = Array.from(first.set)
    .filter((item) => second.set.has(item))
    .sort((a, b) => a.localeCompare(b));

  console.log(`\nShared vocabulary (${overlap.length}):`);
  overlap.slice(0, 20).forEach((word) => console.log(`  - ${word}`));

  console.log(`\nOnly in first file (${firstOnly.length}):`);
  firstOnly.slice(0, 20).forEach((word) => console.log(`  - ${word}`));

  console.log(`\nOnly in second file (${secondOnly.length}):`);
  secondOnly.slice(0, 20).forEach((word) => console.log(`  - ${word}`));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
