#!/usr/bin/env node
import { program } from 'commander';
import { prettyPrintTree } from './prettyPrint';
import { analyze, getProcessor } from '../core/analyze';

program
  .command('analyze <file>')
  .option('--format <format>', 'Format type')
  .option('--pretty', 'Pretty print output')
  .action(async (file, options) => {
    const result = await analyze(file, options.format);
    if (options.pretty) {
      console.log(prettyPrintTree(result.tree));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });

program
  .command('extract <file>')
  .option('--format <format>', 'Format type')
  .action(async (file, options) => {
    const processor = getProcessor(options.format);
    const texts = processor.extractTexts(file);
    console.log('Extracted texts:');
    console.log(JSON.stringify(texts, null, 2));
  });

program.parse(process.argv);
