#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

function collectPageVocabulary(page) {
  const vocabulary = new Set();

  page.buttons.forEach((button) => {
    if (button.label && button.label.trim()) {
      vocabulary.add(button.label.trim());
    }
    if (button.message && button.message.trim() && button.message.trim() !== button.label?.trim()) {
      vocabulary.add(button.message.trim());
    }
  });

  return Array.from(vocabulary).sort((a, b) => a.localeCompare(b));
}

function buildVocabularySummary(tree) {
  const pages = [];
  const overall = new Set();

  tree.traverse((page) => {
    const words = collectPageVocabulary(page);
    words.forEach((word) => overall.add(word));
    pages.push({
      id: page.id,
      name: page.name || '(untitled page)',
      vocabulary: words,
      buttonCount: page.buttons.length,
    });
  });

  pages.sort((a, b) => a.name.localeCompare(b.name));

  return {
    pageCount: pages.length,
    uniqueVocabulary: Array.from(overall).sort((a, b) => a.localeCompare(b)),
    pages,
  };
}

function main() {
  const inputPath = process.argv[2] || path.resolve(__dirname, '../../examples/example.sps');
  const outputPath = process.argv[3];

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  const { getProcessor } = requireLibrary();
  const processor = getProcessor(resolvedInput);
  const tree = processor.loadIntoTree(resolvedInput);
  const summary = buildVocabularySummary(tree);

  console.log(`\n📄 Pages analysed: ${summary.pageCount}`);
  console.log(`🗂️  Unique vocabulary items: ${summary.uniqueVocabulary.length}`);
  console.log('\nTop-level vocabulary sample:');
  summary.uniqueVocabulary.slice(0, 20).forEach((word) => console.log(`  - ${word}`));

  console.log('\nVocabulary by page:');
  summary.pages.forEach((page) => {
    console.log(`\n## ${page.name} (${page.vocabulary.length} terms, ${page.buttonCount} buttons)`);
    page.vocabulary.forEach((word) => console.log(`  - ${word}`));
  });

  if (outputPath) {
    const resolvedOutput = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(resolvedOutput, JSON.stringify(summary, null, 2));
    console.log(`\nSaved vocabulary report to ${resolvedOutput}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildVocabularySummary };
