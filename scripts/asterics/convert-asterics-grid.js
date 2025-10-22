#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

let processors;
try {
  processors = require('../../dist/processors');
} catch (error) {
  console.error('Unable to load compiled processors from dist/. Run `npm run build` first.');
  process.exit(1);
}

const {
  AstericsGridProcessor,
  GridsetProcessor,
  // Additional processors can be mapped in the future.
} = processors;

const AVAILABLE_FORMATS = {
  gridset: {
    description: 'Smartbox Grid 3 (.gridset)',
    extension: '.gridset',
    Processor: GridsetProcessor,
  },
};

function collectFormats(value, previous) {
  const parts = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...previous, ...parts];
}

program
  .name('convert-asterics-grid')
  .description('Convert an Asterics Grid backup (.grd) into other AAC formats')
  .option('--list-formats', 'List supported output formats and exit')
  .option('-i, --input <file>', 'Path to the source Asterics Grid .grd file')
  .option(
    '-o, --output-dir <dir>',
    'Directory for converted files',
    path.join(process.cwd(), 'output', 'conversions')
  )
  .option(
    '-f, --format <format>',
    'Target format (repeat or use comma separated values)',
    collectFormats,
    []
  )
  .option('--overwrite', 'Overwrite existing output files', false)
  .option('--report', 'Write a JSON report summarising the conversion', false);

program.parse(process.argv);

const options = program.opts();

if (options.listFormats) {
  console.log('Supported formats:');
  Object.entries(AVAILABLE_FORMATS).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(10)} ${config.description}`);
  });
  process.exit(0);
}

if (!options.input) {
  program.error('Missing required option: --input <file>');
}

const inputPath = path.resolve(options.input);
if (!fs.existsSync(inputPath)) {
  program.error(`Input file not found: ${inputPath}`);
}

const sourceStats = fs.statSync(inputPath);
if (!sourceStats.isFile()) {
  program.error('Input path must point to a file.');
}

const outputDir = path.resolve(options.outputDir);
fs.mkdirSync(outputDir, { recursive: true });

const requestedFormats = options.format.length ? options.format : ['gridset'];
const targetFormats = [...new Set(requestedFormats.map((format) => format.toLowerCase()))];

const invalidFormats = targetFormats.filter((format) => !AVAILABLE_FORMATS[format]);
if (invalidFormats.length > 0) {
  program.error(`Unsupported format(s): ${invalidFormats.join(', ')}`);
}

const processor = new AstericsGridProcessor({ loadAudio: true });
let tree;
try {
  tree = processor.loadIntoTree(inputPath);
} catch (error) {
  console.error(`Failed to load the source file: ${error.message}`);
  process.exit(1);
}

const outputBaseName = path.basename(inputPath, path.extname(inputPath));
const results = [];

console.log(`Converting "${path.basename(inputPath)}" → ${targetFormats.join(', ')}`);
console.log(`Output directory: ${outputDir}\n`);

targetFormats.forEach((formatKey) => {
  const config = AVAILABLE_FORMATS[formatKey];
  const outputFileName = `${outputBaseName}${config.extension}`;
  const outputPath = path.join(outputDir, outputFileName);

  if (!options.overwrite && fs.existsSync(outputPath)) {
    console.warn(`[warn] ${outputFileName} already exists. Skipping (use --overwrite to regenerate).`);
    results.push({
      format: formatKey,
      status: 'skipped',
      outputPath,
    });
    return;
  }

  const startTime = Date.now();
  try {
    const formatProcessor = new config.Processor();
    formatProcessor.saveFromTree(tree, outputPath);
    const stats = fs.statSync(outputPath);
    const durationMs = Date.now() - startTime;
    console.log(
      `[ok] ${outputFileName} (${(stats.size / 1024).toFixed(1)} KB, ${durationMs} ms)`
    );
    results.push({
      format: formatKey,
      status: 'success',
      outputPath,
      size: stats.size,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[fail] ${outputFileName}: ${error.message}`);
    results.push({
      format: formatKey,
      status: 'failed',
      outputPath,
      error: error.message,
      durationMs,
    });
  }
});

const successCount = results.filter((result) => result.status === 'success').length;
const failedCount = results.filter((result) => result.status === 'failed').length;
const skippedCount = results.filter((result) => result.status === 'skipped').length;

console.log('\nSummary');
console.log(`  Success : ${successCount}`);
console.log(`  Failed  : ${failedCount}`);
console.log(`  Skipped : ${skippedCount}`);

if (options.report) {
  const reportPath = path.join(outputDir, `${outputBaseName}-conversion-report.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    input: {
      path: inputPath,
      size: sourceStats.size,
    },
    outputDirectory: outputDir,
    results,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);
}

if (failedCount > 0) {
  process.exitCode = 1;
}
