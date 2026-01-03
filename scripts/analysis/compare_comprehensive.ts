
import * as Analytics from '../../src/utilities/analytics/metrics/index';
import { ComparisonAnalyzer } from '../../src/utilities/analytics/metrics/comparison';
import { getProcessor } from '../../src/index';
import { ScanningSelectionMethod, CellScanningOrder } from '../../src/types/aac';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx ts-node compare_scanning.ts <file1> <file2> [--spelling1 <id>] [--spelling2 <id>]');
    process.exit(1);
  }

  const file1 = args[0];
  const file2 = args[1];
  let spelling1: string | undefined;
  let spelling2: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spelling1') spelling1 = args[i + 1];
    if (args[i] === '--spelling2') spelling2 = args[i + 1];
  }

  const calculator = new Analytics.MetricsCalculator();
  const comparer = new ComparisonAnalyzer();

  console.log(`\n📚 AAC Pageset Scanning analysis`);
  console.log(`=========================`);
  console.log(`Target 1: ${path.basename(file1)}`);
  console.log(`Target 2: ${path.basename(file2)}\n`);

  try {
    const p1 = getProcessor(path.extname(file1) === '.zip' ? '.ce' : path.extname(file1));
    const tree1 = p1.loadIntoTree(path.resolve(process.cwd(), file1));
    
    const p2 = getProcessor(path.extname(file2) === '.zip' ? '.ce' : path.extname(file2));
    const tree2 = p2.loadIntoTree(path.resolve(process.cwd(), file2));

    const scenarios = [
      { name: 'Direct Selection (Touch)', config: undefined },
      { 
        name: '1-Switch Auto Scan (Row/Col)', 
        config: { 
          selectionMethod: ScanningSelectionMethod.AutoScan,
          cellScanningOrder: CellScanningOrder.RowColumnScan
        } 
      },
      { 
        name: '2-Switch Step Scan (Row/Col)', 
        config: { 
          selectionMethod: ScanningSelectionMethod.StepScan2Switch,
          cellScanningOrder: CellScanningOrder.RowColumnScan
        } 
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\n📍 SCENARIO: ${scenario.name}`);
      console.log(`================================================================================`);
      
      const metrics1 = calculator.analyze(tree1, { 
        spellingPageId: spelling1,
        scanningConfig: scenario.config
      });

      const metrics2 = calculator.analyze(tree2, { 
        spellingPageId: spelling2,
        scanningConfig: scenario.config
      });

      const comparison = comparer.compare(metrics1, metrics2, { includeSentences: true });
      
      printScenarioDetails(comparison, path.basename(file1), path.basename(file2));
    }

  } catch (err) {
    console.error(`Error during comparison:`, err);
  }
}

function printScenarioDetails(comp: any, name1: string, name2: string) {
  const line = '-'.repeat(80);
  const name1Trunc = name1.substring(0, 25).padEnd(25);
  const name2Trunc = name2.substring(0, 25).padEnd(25);

  console.log(`${'Metric'.padEnd(25)} | ${name1Trunc} | ${name2Trunc}`);
  console.log(line);
  
  // Basic Metrics
  console.log(`${'Avg Global Effort'.padEnd(25)} | ${comp.target_effort_score.toFixed(3).padEnd(25)} | ${comp.comp_effort_score.toFixed(3).padEnd(25)}`);
  
  // CARE Components
  const care = comp.care_components;
  console.log(`${'CARE Score (Composite)'.padEnd(25)} | ${care.care_score.toFixed(2).padEnd(25)} | ${care.comp_care_score.toFixed(2).padEnd(25)}`);
  console.log(`${'CARE Sentence Effort'.padEnd(25)} | ${care.sentences.toFixed(3).padEnd(25)} | ${care.comp_sentences.toFixed(3).padEnd(25)}`);
  console.log(`${'Core Vocabulary Found'.padEnd(25)} | ${care.core.toString().padEnd(25)} | ${care.comp_core.toString().padEnd(25)}`);
  console.log(`${'Fringe Vocabulary Found'.padEnd(25)} | ${care.fringe.toString().padEnd(25)} | ${care.comp_fringe.toString().padEnd(25)}`);

  console.log(`\n💬 Top Sentence Examples:`);
  comp.sentences.slice(0, 5).forEach((s: any) => {
    console.log(`  "${s.sentence.substring(0, 30)}..." | T1: ${s.effort.toFixed(2).padEnd(6)} | T2: ${s.comp_effort.toFixed(2)}`);
  });

  console.log(`\n💎 Key Core Words:`);
  const coreWords = ['Yes', 'No', 'Want', 'Like', 'Help', 'I', 'You', 'More', 'Stop', 'Go', 'Come'];
  coreWords.forEach(word => {
    const tBtn = findButton(comp.buttons, word);
    if (tBtn) {
       console.log(`  "${word.padEnd(10)}" | T1: ${tBtn.effort.toFixed(2).padEnd(10)} | T2: ${tBtn.comp_effort?.toFixed(2) || 'N/A'}`);
    }
  });
  
  console.log(`\n`);
}

function findButton(buttons: any[], label: string) {
  const target = label.toLowerCase().replace(/[.?!,]/g, '');
  return buttons.find(b => {
      const btnLabel = b.label.toLowerCase().replace(/[.?!,]/g, '');
      return btnLabel === target;
  });
}

main();
