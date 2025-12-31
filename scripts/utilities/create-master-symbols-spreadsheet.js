#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Create a master spreadsheet of all unique symbols across vocabularies
 * Aggregates data from individual vocabulary CSV files
 *
 * Output columns:
 * - symbol-id
 * - total-count: Total times symbol is used across all vocabs
 * - vocabs: List of vocabularies using this symbol
 * - pages: List of pages where symbol appears (with vocab prefix)
 * - labels: List of unique cell labels for this symbol
 * - actions: List of action types
 */

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      data.push(row);
    }
  }

  return { headers, data };
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function aggregateSymbols(csvFiles) {
  const symbolMap = new Map();

  for (const csvFile of csvFiles) {
    console.log(`Processing: ${csvFile}`);
    const { data } = parseCSV(csvFile);

    for (const row of data) {
      const symbolId = row['symbol-id'];
      if (!symbolId) continue;

      if (!symbolMap.has(symbolId)) {
        symbolMap.set(symbolId, {
          symbolId,
          totalCount: 0,
          vocabs: new Set(),
          pages: new Set(),
          labels: new Set(),
          actions: new Set(),
          byVocab: {}
        });
      }

      const entry = symbolMap.get(symbolId);
      const vocab = row['vocab'] || 'Unknown';
      const page = row['page'] || 'Unknown';
      const label = row['cell-label'] || '';
      const action = row['cell-actions'] || '';

      entry.totalCount++;
      entry.vocabs.add(vocab);

      // Add page with vocab prefix for context
      entry.pages.add(`${vocab}:${page}`);

      if (label) entry.labels.add(label);

      // Extract action type (SPEAK, NAVIGATE, OTHER)
      if (action.startsWith('SPEAK:')) {
        entry.actions.add('SPEAK');
      } else if (action.startsWith('NAVIGATE:')) {
        entry.actions.add('NAVIGATE');
      } else if (action && action !== '(none)') {
        entry.actions.add('OTHER');
      }

      // Count by vocab
      if (!entry.byVocab[vocab]) {
        entry.byVocab[vocab] = { count: 0, pages: new Set() };
      }
      entry.byVocab[vocab].count++;
      if (page) entry.byVocab[vocab].pages.add(page);
    }
  }

  return symbolMap;
}

function generateMasterCSV(symbolMap, outputFile) {
  const headers = [
    'symbol-id',
    'total-count',
    'vocab-count',
    'vocabs',
    'page-count',
    'pages',
    'unique-labels',
    'action-types'
  ];

  const rows = [headers.join(',')];

  // Sort by total count (descending), then by symbol-id
  const sortedSymbols = Array.from(symbolMap.values()).sort((a, b) => {
    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount;
    }
    return a.symbolId.localeCompare(b.symbolId);
  });

  for (const entry of sortedSymbols) {
    const escape = (str) => {
      if (!str) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    // Limit long lists to keep spreadsheet manageable
    const vocabsList = Array.from(entry.vocabs).sort().join('; ');
    const pagesList = Array.from(entry.pages)
      .sort()
      .slice(0, 50) // Limit to first 50 pages
      .join('; ');
    const labelsList = Array.from(entry.labels)
      .sort()
      .slice(0, 20) // Limit to first 20 labels
      .join('; ');
    const actionsList = Array.from(entry.actions).sort().join('; ');

    const row = [
      escape(entry.symbolId),
      entry.totalCount,
      entry.vocabs.size,
      escape(vocabsList),
      entry.pages.size,
      escape(pagesList + (entry.pages.size > 50 ? ` ... (+${entry.pages.size - 50} more)` : '')),
      escape(labelsList + (entry.labels.size > 20 ? ` ... (+${entry.labels.size - 20} more)` : '')),
      escape(actionsList)
    ];

    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  fs.writeFileSync(outputFile, csv, 'utf8');
  console.log(`\nWrote ${sortedSymbols.length} unique symbols to ${outputFile}`);
}

function generateByVocabCSV(symbolMap, outputFile) {
  // Create a separate sheet showing symbol usage by vocabulary
  const headers = [
    'symbol-id',
    'total-count',
    ...getUniqueVocabs(symbolMap),
    'all-vocabs'
  ];

  const rows = [headers.join(',')];

  const sortedSymbols = Array.from(symbolMap.values()).sort((a, b) => {
    return b.totalCount - a.totalCount;
  });

  for (const entry of sortedSymbols) {
    const escape = (str) => {
      if (!str) return '""';
      return `"${String(str).replace(/"/g, '""')}"`;
    };

    const row = [
      escape(entry.symbolId),
      entry.totalCount
    ];

    // Add count for each vocab
    for (const vocab of headers.slice(2, -1)) {
      const count = entry.byVocab[vocab]?.count || 0;
      row.push(count);
    }

    // Add list of all vocabs
    row.push(escape(Array.from(entry.vocabs).sort().join(', ')));

    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  const byVocabFile = outputFile.replace('.csv', '-by-vocab.csv');
  fs.writeFileSync(byVocabFile, csv, 'utf8');
  console.log(`Wrote by-vocab breakdown to ${byVocabFile}`);
}

function getUniqueVocabs(symbolMap) {
  const vocabs = new Set();
  for (const entry of symbolMap.values()) {
    for (const vocab of Object.keys(entry.byVocab)) {
      vocabs.add(vocab);
    }
  }
  return Array.from(vocabs).sort();
}

function generateSummary(symbolMap) {
  const totalSymbols = symbolMap.size;
  const totalUsages = Array.from(symbolMap.values()).reduce((sum, e) => sum + e.totalCount, 0);

  const libraryCounts = {};
  const vocabCounts = {};

  for (const entry of symbolMap.values()) {
    // Count by library
    let library = 'unknown';
    if (entry.symbolId.startsWith('[')) {
      const match = entry.symbolId.match(/^\[([^\]]+)\]/);
      if (match) library = match[1];
    } else if (entry.symbolId.startsWith('embedded:')) {
      library = 'embedded';
    } else if (entry.symbolId.startsWith('image:')) {
      library = 'image-ref';
    }
    libraryCounts[library] = (libraryCounts[library] || 0) + 1;

    // Count by vocab
    for (const vocab of entry.vocabs) {
      vocabCounts[vocab] = (vocabCounts[vocab] || 0) + 1;
    }
  }

  return {
    totalSymbols,
    totalUsages,
    libraryCounts,
    vocabCounts,
    avgUsagesPerSymbol: (totalUsages / totalSymbols).toFixed(2)
  };
}

function main() {
  // Find all CSV files created by the extract script
  const csvDir = 'sheets-for-daisy';
  const csvFiles = [
    'Super Core 30-symbols-cleaned.csv',
    'Super Core 50-symbols-cleaned.csv',
    'Aphasia Duo 16-symbols-cleaned.csv',
    'Aphasia Duo 9-symbols-cleaned.csv',
    'Voco Chat-symbols-cleaned.csv'
  ].map(f => path.join(csvDir, f))
   .filter(f => fs.existsSync(f));

  if (csvFiles.length === 0) {
    console.error('No symbol CSV files found. Run extract-symbols-with-context.js first.');
    process.exit(1);
  }

  console.log(`Found ${csvFiles.length} vocabulary CSV files to aggregate\n`);

  const symbolMap = aggregateSymbols(csvFiles);

  // Generate master CSV
  const masterFile = path.join(csvDir, 'master-symbols-all-vocabs.csv');
  generateMasterCSV(symbolMap, masterFile);

  // Generate by-vocab breakdown
  generateByVocabCSV(symbolMap, masterFile);

  // Print summary
  const summary = generateSummary(symbolMap);
  console.log('\n=== Master Summary ===');
  console.log(`Total unique symbols across all vocabs: ${summary.totalSymbols}`);
  console.log(`Total symbol usages: ${summary.totalUsages}`);
  console.log(`Average usages per symbol: ${summary.avgUsagesPerSymbol}`);

  console.log('\nBy symbol library:');
  for (const [lib, count] of Object.entries(summary.libraryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lib}: ${count} symbols`);
  }

  console.log('\nBy vocabulary:');
  for (const [vocab, count] of Object.entries(summary.vocabCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${vocab}: ${count} symbols`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { aggregateSymbols, generateMasterCSV, generateSummary };
