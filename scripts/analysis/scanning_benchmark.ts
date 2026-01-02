#!/usr/bin/env npx ts-node
/**
 * AAC Scanning & Vocabulary Benchmark Script
 * 
 * This script analyzes AAC pagesets (Snap, Grid 3, TouchChat) for:
 * 1. Scanning efficiency (steps and selections)
 * 2. Vocabulary coverage (core word lists)
 * 3. Effort scores (how hard it is to reach words)
 * 
 * Usage:
 *   npx ts-node scripts/analysis/scanning_benchmark.ts [directory_path]
 * 
 * If no directory is specified, it will look in '/tmp' as an example.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProcessor, Analytics, AACTree, isExtensionSupported } from '../../src/index';

async function runBenchmark() {
  const targetDir = process.argv[2] || './tmp';

  console.log(`\n🚀 AAC Scanning Benchmark`);
  console.log(`=========================`);
  console.log(`Target Directory: ${targetDir}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Error: Directory '${targetDir}' does not exist.`);
    console.log(`\nUsage: npx ts-node scripts/analysis/scanning_benchmark.ts [directory_path]`);
    console.log(`Hint: Provide a folder containing .gridset, .sps (Snap), or .zip (TouchChat) files.\n`);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    // Special case for TouchChat which can be .zip sometimes, or .ce
    return isExtensionSupported(ext) || ext === '.zip';
  });

  if (files.length === 0) {
    console.warn(`⚠️ No supported AAC files found in ${targetDir}.`);
    console.log(`Supported extensions: .gridset, .sps, .spb, .ce, .obfset, etc.`);
    return;
  }

  console.log(`Found ${files.length} pageset(s) to analyze.\n`);

  // Parse command line arguments for scanning costs
  let stepCost: number | undefined;
  let selectionCost: number | undefined;

  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--step-cost' && process.argv[i + 1]) {
      stepCost = parseFloat(process.argv[i + 1]);
    }
    if (process.argv[i] === '--selection-cost' && process.argv[i + 1]) {
      selectionCost = parseFloat(process.argv[i + 1]);
    }
  }

  const calculator = new Analytics.MetricsCalculator();
  const vocabAnalyzer = new Analytics.VocabularyAnalyzer();

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const ext = path.extname(file).toLowerCase();
    
    console.log(`Processing: ${file}...`);
    
    try {
      // Use standard processor factory
      const processorExt = ext === '.zip' ? '.ce' : ext;
      const processor = getProcessor(processorExt);
      
      const tree = processor.loadIntoTree(filePath);
      
      // Analyze with custom scanning costs if provided
      const metrics = calculator.analyze(tree, {
        scanStepCost: stepCost,
        scanSelectionCost: selectionCost
      });
      
      // Vocabulary analysis
      const vocabAnalysis = vocabAnalyzer.analyze(metrics);
      
      printSummary(file, metrics, vocabAnalysis);
    } catch (err) {
      console.error(`  ❌ Failed to process ${file}: ${(err as Error).message}`);
    }
    console.log(`--------------------------------------------------`);
  }
}

function printSummary(filename: string, metrics: any, vocab: any) {
  console.log(`  ✅ Analysis Complete`);
  console.log(`     Format-Specific Metric: ${metrics.grid.columns}x${metrics.grid.rows} Average Grid`);
  console.log(`     Total Unique Words: ${vocab.total_unique_words}`);
  console.log(`     Total Buttons Analyzed: ${metrics.total_buttons}`);
  
  console.log(`\n     🌟 Effort Scores (Scanning Context):`);
  const avgEffort = metrics.buttons.reduce((sum: number, b: any) => sum + b.effort, 0) / metrics.buttons.length;
  console.log(`     Average Effort: ${avgEffort.toFixed(3)}`);
  
  // Highlighting Core List Coverage
  console.log(`\n     📊 Core Vocabulary Coverage:`);
  Object.entries(vocab.core_coverage).forEach(([listId, data]: [string, any]) => {
    console.log(`     - ${data.name}: ${data.coverage_percent.toFixed(1)}% (${data.covered}/${data.total_words})`);
    console.log(`       Avg Effort to core: ${data.average_effort.toFixed(3)}`);
  });

  // Highlight specific low/high effort items
  if (vocab.low_effort_words.length > 0) {
    const top3 = vocab.low_effort_words.slice(0, 3).map((w: any) => `${w.word} (${w.effort.toFixed(2)})`).join(', ');
    console.log(`\n     ✨ Most Accessible Words: ${top3}`);
  }
}

runBenchmark().catch(err => {
  console.error(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
