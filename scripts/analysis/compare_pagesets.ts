
import * as Analytics from '../../src/utilities/analytics/metrics/index';
import { ComparisonAnalyzer } from '../../src/utilities/analytics/metrics/comparison';
import { getProcessor } from '../../src/index';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx ts-node compare_pagesets.ts <file1> <file2> [--spelling1 <id>] [--spelling2 <id>] [--use-prediction] [--prediction-selections <n>]');
    console.log('');
    console.log('Options:');
    console.log('  --use-prediction          Use prediction instead of common word efforts for missing words');
    console.log('  --prediction-selections  Average number of prediction selections (default: 1.5)');
    console.log('');
    console.log('Note: By default, missing words use common word baseline efforts (matching Ruby aac-metrics)');
    process.exit(1);
  }

  const file1 = args[0];
  const file2 = args[1];
  let spelling1: string | undefined;
  let spelling2: string | undefined;
  let usePrediction = false;
  let predictionSelections = 1.5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spelling1') spelling1 = args[i + 1];
    if (args[i] === '--spelling2') spelling2 = args[i + 1];
    if (args[i] === '--use-prediction') usePrediction = true;
    if (args[i] === '--prediction-selections') predictionSelections = parseFloat(args[i + 1]);
  }

  const calculator = new Analytics.MetricsCalculator();
  const comparer = new ComparisonAnalyzer();

  console.log(`\n📚 AAC Pageset Comparison`);
  console.log(`=========================`);
  console.log(`Target 1: ${path.basename(file1)}`);
  console.log(`Target 2: ${path.basename(file2)}`);
  console.log(`Missing word method: ${usePrediction ? 'Prediction' : 'Common word efforts'}${usePrediction ? ` (selections: ${predictionSelections})` : ''}\n`);

  try {
    // Load and analyze 1
    const p1 = getProcessor(path.extname(file1) === '.zip' ? '.ce' : path.extname(file1));
    const tree1 = await p1.loadIntoTree(path.resolve(process.cwd(), file1));
    const metrics1 = calculator.analyze(tree1, { spellingPageId: spelling1 });

    // Load and analyze 2
    const p2 = getProcessor(path.extname(file2) === '.zip' ? '.ce' : path.extname(file2));
    const tree2 = await p2.loadIntoTree(path.resolve(process.cwd(), file2));
    const metrics2 = calculator.analyze(tree2, { spellingPageId: spelling2 });

    const comparison = comparer.compare(metrics1, metrics2, {
      includeSentences: true,
      usePrediction,
      predictionSelections
    });

    printDetailedComparison(comparison, path.basename(file1), path.basename(file2));

  } catch (err) {
    console.error(`Error during comparison:`, err);
  }
}

function printDetailedComparison(comp: any, name1: string, name2: string) {
  const line = '-'.repeat(80);
  
  console.log(`📊 GENERAL METRICS`);
  console.log(line);
  console.log(`${'Metric'.padEnd(25)} | ${name1.substring(0, 25).padEnd(25)} | ${name2.substring(0, 25).padEnd(25)}`);
  console.log(line);
  console.log(`${'Total Buttons'.padEnd(25)} | ${comp.total_buttons.toString().padEnd(25)} | ${comp.comp_buttons.toString().padEnd(25)}`);
  console.log(`${'Unique Words'.padEnd(25)} | ${comp.total_words.toString().padEnd(25)} | ${comp.comp_words.toString().padEnd(25)}`);
  console.log(`${'Avg Global Effort'.padEnd(25)} | ${comp.target_effort_score.toFixed(3).padEnd(25)} | ${comp.comp_effort_score.toFixed(3).padEnd(25)}`);
  console.log(`${'Grid Size'.padEnd(25)} | ${`${comp.grid.rows}x${comp.grid.columns}`.padEnd(25)} | ${`${comp.comp_grid.rows}x${comp.comp_grid.columns}`.padEnd(25)}`);
  console.log(`${'Spelling Effort (Base)'.padEnd(25)} | ${comp.spelling_effort_base?.toFixed(2).padEnd(25) || 'N/A'.padEnd(25)} | ${comp.comp_spelling_effort_base?.toFixed(2) || 'N/A'}`);
  console.log(`${'Spelling Effort (Letter)'.padEnd(25)} | ${comp.spelling_effort_per_letter?.toFixed(2).padEnd(25) || 'N/A'.padEnd(25)} | ${comp.comp_spelling_effort_per_letter?.toFixed(2) || 'N/A'}`);
  console.log(`${'Dynamic Dictionary'.padEnd(25)} | ${comp.has_dynamic_prediction ? 'YES (SwiftKey)'.padEnd(25) : 'No'.padEnd(25)} | ${comp.comp_has_dynamic_prediction ? 'YES (SwiftKey)' : 'No'}`);
  
  console.log(`\n💎 CORE VOCABULARY COVERAGE`);
  console.log(line);
  console.log(`${'List Name'.padEnd(25)} | ${'Coverage (T1)'.padEnd(15)} | ${'Effort (T1)'.padEnd(15)} | ${'Coverage (T2)'.padEnd(15)} | ${'Effort (T2)'.padEnd(15)}`);
  console.log(line);
  
  Object.entries(comp.cores || {}).forEach(([id, data]: [string, any]) => {
    const coverage1 = `${data.target_covered}/${data.total_words}`;
    const coverage2 = `${data.compare_covered}/${data.total_words}`;
    console.log(`${data.name.substring(0, 25).padEnd(25)} | ${coverage1.padEnd(15)} | ${data.average_effort.toFixed(3).padEnd(15)} | ${coverage2.padEnd(15)} | ${data.comp_effort.toFixed(3).padEnd(15)}`);
  });

  console.log(`\n💬 SENTENCE ANALYSIS (Average Effort)`);
  console.log(line);
  console.log(`${'Sentence'.padEnd(40)} | ${'Effort (T1)'.padEnd(15)} | ${'Effort (T2)'.padEnd(15)}`);
  console.log(line);
  
  comp.sentences.forEach((s: any) => {
    const sentText = s.sentence;
    console.log(`${(sentText.length > 37 ? sentText.substring(0, 37) + '...' : sentText).padEnd(40)} | ${s.effort.toFixed(2).padEnd(15)} | ${s.comp_effort.toFixed(2).padEnd(15)}`);
  });

  const avgT1 = comp.sentences.reduce((acc: number, s: any) => acc + s.effort, 0) / comp.sentences.length;
  const avgT2 = comp.sentences.reduce((acc: number, s: any) => acc + s.comp_effort, 0) / comp.sentences.length;
  console.log(line);
  console.log(`${'AVERAGE'.padEnd(40)} | ${avgT1.toFixed(3).padEnd(15)} | ${avgT2.toFixed(3).padEnd(15)}`);

  console.log(`\n🌟 CARE COMPONENT SUMMARY`);
  console.log(line);
  const care = comp.care_components;
  console.log(`Core Words Found:     ${care.core} (T1) vs ${care.comp_core} (T2)`);
  console.log(`Avg Sentence Effort:  ${care.sentences.toFixed(3)} (T1) vs ${care.comp_sentences.toFixed(3)} (T2)`);
  console.log(`Fringe Words Found:   ${care.fringe} (T1) vs ${care.comp_fringe} (T2)`);
  console.log(line);
  console.log(`\n📈 CARE SCORE (Composite)`);
  console.log(line);
  console.log(`T1 Score: ${care.care_score.toFixed(2)} (higher is better)`);
  console.log(`T2 Score: ${care.comp_care_score.toFixed(2)} (higher is better)`);
  console.log(line);
  console.log(`\n`);
}

main();
