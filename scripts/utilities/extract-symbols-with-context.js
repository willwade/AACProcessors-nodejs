#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { GridsetProcessor } = require('../../dist/processors');

/**
 * Extract all unique symbols with their usage context from Grid3 gridsets
 * Output: CSV with columns: symbol-id, cell-label, page, vocab, cell-actions, button-id
 *
 * Usage:
 *   node extract-symbols-with-context.js <gridset-file> [output.csv]
 *
 * Example:
 *   node extract-symbols-with-context.js "/path/to/Super Core.gridset" "super-core-symbols.csv"
 */

function getSymbolId(button) {
  // Construct symbol reference from symbol library and path
  if (button.symbolLibrary) {
    const lib = button.symbolLibrary;
    const symPath = button.symbolPath || '';
    return `[${lib}]${symPath}`;
  }
  // For embedded images, use the resolved entry path
  if (button.resolvedImageEntry) {
    return `embedded:${button.resolvedImageEntry}`;
  }
  // Fallback to image field
  if (button.image) {
    return `image:${button.image}`;
  }
  return '';
}

function getCellActions(button) {
  const actions = [];

  // Get semantic action info
  if (button.semanticAction) {
    const intent = button.semanticAction.intent || '';
    const text = button.semanticAction.text || button.message || '';

    if (intent === 'SPEAK_TEXT' || intent === 'SPEAK_IMMEDIATE') {
      actions.push(`SPEAK:${text}`);
    } else if (intent === 'NAVIGATE_TO') {
      actions.push(`NAVIGATE:${button.semanticAction.targetId || button.targetPageId || ''}`);
    } else if (intent === 'INSERT_TEXT') {
      actions.push(`INSERT:${text}`);
    } else if (intent) {
      actions.push(`${intent}:${text}`);
    }
  }

  // Fallback to legacy type/action
  if (actions.length === 0) {
    if (button.type === 'SPEAK' || button.action?.type === 'SPEAK') {
      const msg = button.message || button.action?.message || '';
      actions.push(`SPEAK:${msg}`);
    } else if (button.type === 'NAVIGATE' || button.action?.type === 'NAVIGATE') {
      const target = button.targetPageId || button.action?.targetPageId || '';
      actions.push(`NAVIGATE:${target}`);
    }
  }

  return actions.join('; ') || '(none)';
}

function extractSymbolUsage(gridsetFile, vocabName) {
  console.log(`Loading gridset: ${gridsetFile}`);

  const proc = new GridsetProcessor();
  const tree = proc.loadIntoTree(gridsetFile);

  const symbolMap = new Map(); // symbol-id -> array of usage entries

  // Also extract from wordlists stored in raw grid XML
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(gridsetFile);
  const entries = zip.getEntries();

  // Find all grid.xml files
  const gridFiles = entries.filter(e => e.entryName.endsWith('/grid.xml'));

  for (const gridEntry of gridFiles) {
    try {
      const content = zip.readAsText(gridEntry);

      // Extract page name from path
      const pathMatch = gridEntry.entryName.match(/Grids\/([^/]+)\/grid\.xml/);
      const pageName = pathMatch ? pathMatch[1] : gridEntry.entryName;

      // Parse WordList elements
      const wordListRegex = /<WordListItem>[\s\S]*?<Image>([^<]+)<\/Image>[\s\S]*?<\/WordListItem>/g;
      let match;

      while ((match = wordListRegex.exec(content)) !== null) {
        const symbolRef = match[1];
        const symbolId = symbolRef.startsWith('[') ? symbolRef : `[${symbolRef}]`;

        // Extract the word from the Text element
        const textMatch = match[0].match(/<r>([^<]+)<\/r>/);
        const word = textMatch ? textMatch[1] : '';

        // Extract part of speech if available
        const posMatch = match[0].match(/<PartOfSpeech>([^<]+)<\/PartOfSpeech>/);
        const partOfSpeech = posMatch ? posMatch[1] : '';

        const entry = {
          symbolId,
          cellLabel: word,
          page: pageName,
          vocab: vocabName,
          cellActions: partOfSpeech ? `WORDLIST:${partOfSpeech}` : 'WORDLIST',
          buttonId: `wordlist-${pageName}`,
          visibility: 'Wordlist',
          contentType: 'Wordlist'
        };

        if (!symbolMap.has(symbolId)) {
          symbolMap.set(symbolId, []);
        }
        symbolMap.get(symbolId).push(entry);
      }
    } catch (err) {
      // Skip files that can't be parsed
    }
  }

  // Extract from regular buttons
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];

    if (!page.buttons || page.buttons.length === 0) {
      continue;
    }

    for (const button of page.buttons) {
      // Skip buttons without images/symbols
      if (!button.symbolLibrary && !button.resolvedImageEntry && !button.image) {
        continue;
      }

      const symbolId = getSymbolId(button);
      if (!symbolId) {
        continue;
      }

      const entry = {
        symbolId,
        cellLabel: button.label || '',
        page: page.name || pageId,
        vocab: vocabName,
        cellActions: getCellActions(button),
        buttonId: button.id,
        visibility: button.visibility || 'Visible',
        contentType: button.contentType || 'Normal'
      };

      if (!symbolMap.has(symbolId)) {
        symbolMap.set(symbolId, []);
      }
      symbolMap.get(symbolId).push(entry);
    }
  }

  return symbolMap;
}

function generateCSV(symbolMap, outputFile) {
  const headers = ['symbol-id', 'cell-label', 'page', 'vocab', 'cell-actions', 'button-id', 'visibility', 'content-type'];
  const rows = [headers.join(',')];

  // Sort by symbol-id
  const sortedSymbols = Array.from(symbolMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [symbolId, usages] of sortedSymbols) {
    for (const usage of usages) {
      // Escape CSV fields
      const escape = (str) => {
        if (!str) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const row = [
        escape(usage.symbolId),
        escape(usage.cellLabel),
        escape(usage.page),
        escape(usage.vocab),
        escape(usage.cellActions),
        escape(usage.buttonId),
        escape(usage.visibility),
        escape(usage.contentType)
      ];

      rows.push(row.join(','));
    }
  }

  const csv = rows.join('\n');
  fs.writeFileSync(outputFile, csv, 'utf8');
  console.log(`\nWrote ${sortedSymbols.length} unique symbols (${rows.length - 1} total usages) to ${outputFile}`);
}

function generateSummary(symbolMap) {
  const summary = {
    totalUniqueSymbols: symbolMap.size,
    totalUsages: 0,
    byLibrary: {},
    byVocab: {},
    byAction: { SPEAK: 0, NAVIGATE: 0, OTHER: 0 }
  };

  for (const [symbolId, usages] of symbolMap.entries()) {
    summary.totalUsages += usages.length;

    // Count by library
    let library = 'unknown';
    if (symbolId.startsWith('[')) {
      const match = symbolId.match(/^\[([^\]]+)\]/);
      if (match) library = match[1];
    } else if (symbolId.startsWith('embedded:')) {
      library = 'embedded';
    } else if (symbolId.startsWith('image:')) {
      library = 'image-ref';
    }
    summary.byLibrary[library] = (summary.byLibrary[library] || 0) + 1;

    // Count by vocab
    for (const usage of usages) {
      summary.byVocab[usage.vocab] = (summary.byVocab[usage.vocab] || 0) + 1;

      // Count by action type
      if (usage.cellActions.startsWith('SPEAK:')) {
        summary.byAction.SPEAK++;
      } else if (usage.cellActions.startsWith('NAVIGATE:')) {
        summary.byAction.NAVIGATE++;
      } else {
        summary.byAction.OTHER++;
      }
    }
  }

  return summary;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node extract-symbols-with-context.js <gridset-file> [output.csv] [vocab-name]

Arguments:
  gridset-file   Path to the .gridset file to process
  output.csv     Optional output CSV filename (default: symbols-output.csv)
  vocab-name     Optional vocabulary name (default: extracted from filename)

Examples:
  node extract-symbols-with-context.js "/tmp/Super Core.gridset"
  node extract-symbols-with-context.js "/tmp/Aphasia Duo.gridset" "aphasia-duo-symbols.csv"
  node extract-symbols-with-context.js "/tmp/Voco Chat.gridset" "voco-chat-symbols.csv" "VocoChat"
`);
    process.exit(1);
  }

  const gridsetFile = args[0];
  const defaultVocab = path.basename(gridsetFile, '.gridset');
  const outputFile = args[1] || `${defaultVocab}-symbols.csv`;
  const vocabName = args[2] || defaultVocab;

  // Check if file exists
  if (!fs.existsSync(gridsetFile)) {
    console.error(`Error: Gridset file not found: ${gridsetFile}`);
    process.exit(1);
  }

  try {
    const symbolMap = extractSymbolUsage(gridsetFile, vocabName);
    generateCSV(symbolMap, outputFile);

    const summary = generateSummary(symbolMap);
    console.log('\n=== Summary ===');
    console.log(`Unique symbols: ${summary.totalUniqueSymbols}`);
    console.log(`Total usages: ${summary.totalUsages}`);
    console.log('\nBy symbol library:');
    for (const [lib, count] of Object.entries(summary.byLibrary).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${lib}: ${count}`);
    }
    console.log('\nBy action type:');
    console.log(`  SPEAK: ${summary.byAction.SPEAK}`);
    console.log(`  NAVIGATE: ${summary.byAction.NAVIGATE}`);
    console.log(`  OTHER: ${summary.byAction.OTHER}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractSymbolUsage, generateCSV, generateSummary };
