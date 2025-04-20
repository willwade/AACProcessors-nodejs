#!/usr/bin/env node
// Step 9: CLI interface (basic scaffold)
const FileProcessor = require('../core/fileProcessor');
const GridsetProcessor = require('../processors/gridsetProcessor');
const TouchChatProcessor = require('../processors/touchchatProcessor');
const SnapProcessor = require('../processors/snapProcessor');
const { program } = require('commander');
const path = require('path');
const { prettyPrintTree } = require('./prettyPrint');

function getProcessor(format) {
  switch (format) {
    case 'gridset':
      return new GridsetProcessor();
    case 'touchchat':
      return new TouchChatProcessor();
    case 'snap':
      return new SnapProcessor();
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function resolveFormat(file, cliFormat) {
  if (cliFormat) return cliFormat.toLowerCase();
  return FileProcessor.detectFormat(file);
}

program
  .name('aac-processors')
  .description('CLI for AAC Processors (Node.js)')
  .version('0.2.0');

program
  .command('extract <file>')
  .description('Extract all text from an AAC file (Gridset, TouchChat, etc.)')
  .option('--format <format>', 'File format: gridset, touchchat')
  .action((file, options) => {
    const format = resolveFormat(file, options.format);
    let processor;
    try {
      processor = getProcessor(format);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const texts = processor.extractTexts(file);
    console.log('Extracted texts:', texts);
  });

program
  .command('convert <input> <output>')
  .description('Convert AAC file to another format (stub)')
  .option('--format <format>', 'File format: gridset, touchchat')
  .action((input, output, options) => {
    const format = resolveFormat(input, options.format);
    let processor;
    try {
      processor = getProcessor(format);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const tree = processor.loadIntoTree(input);
    // TODO: select output processor by output extension/format
    processor.saveFromTree(tree, output);
    console.log(`Converted ${input} to ${output}`);
  });

program
  .command('analyze <file>')
  .description('Analyze the structure of an AAC file (Gridset, TouchChat, etc.)')
  .option('--format <format>', 'File format: gridset, touchchat')
  .option('--pretty', 'Pretty print tree structure')
  .action((file, options) => {
    const format = resolveFormat(file, options.format);
    let processor;
    try {
      processor = getProcessor(format);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const tree = processor.loadIntoTree(file);
    if (options.pretty) {
      console.log(prettyPrintTree(tree));
    } else {
      console.log('Tree structure:', tree);
    }
  });

program.parse(process.argv);

