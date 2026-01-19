#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

function requireLibrary() {
  const distPath = path.resolve(__dirname, '../dist');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(distPath);
  } catch (error) {
    console.error('Unable to load the built library from dist/. Have you run "npm run build"?');
    throw error;
  }
}

const ENGINE_TO_EXT = {
  dot: '.dot',
  opml: '.opml',
  obf: '.obf',
  obz: '.obz',
  obfset: '.obfset',
  gridset: '.gridset',
  gridsetx: '.gridsetx',
  snap: '.sps',
  spb: '.spb',
  touchchat: '.ce',
  excel: '.xlsx',
  applepanels: '.plist',
  asterics: '.grd',
};

function parseArgs(argv) {
  const args = {
    file: '',
    engine: '',
    mode: 'load',
    iterations: 5,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i + 1];
    if (argv[i] === '--file' && value) {
      args.file = value;
      i += 1;
    } else if (argv[i] === '--engine' && value) {
      args.engine = value;
      i += 1;
    } else if (argv[i] === '--mode' && value) {
      args.mode = value;
      i += 1;
    } else if (argv[i] === '--iterations' && value) {
      args.iterations = Math.max(1, Number(value));
      i += 1;
    }
  }
  return args;
}

function detectExtension(inputPath, engineOverride) {
  if (engineOverride) {
    const key = engineOverride.toLowerCase();
    return ENGINE_TO_EXT[key] || engineOverride;
  }
  const ext = path.extname(inputPath);
  return ext || '';
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: node scripts/bench.js --file <path> [--engine <name>] [--mode load|extract|process] [--iterations N]');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const { getProcessor } = requireLibrary();
  const extension = detectExtension(inputPath, args.engine);
  const processor = getProcessor(extension);
  const iterations = args.iterations;

  let translations = null;
  if (args.mode === 'process') {
    const texts = await processor.extractTexts(inputPath);
    translations = new Map();
    texts.slice(0, 50).forEach((text) => {
      if (typeof text === 'string' && text.trim().length > 0) {
        translations.set(text, `${text}-bench`);
      }
    });
  }

  const timings = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    if (args.mode === 'extract') {
      await processor.extractTexts(inputPath);
    } else if (args.mode === 'process') {
      const outputPath = path.join(os.tmpdir(), `aac-bench-${Date.now()}-${i}${extension}`);
      await processor.processTexts(inputPath, translations || new Map(), outputPath);
    } else {
      await processor.loadIntoTree(inputPath);
    }
    timings.push(performance.now() - start);
  }

  const avg = mean(timings);
  const p95 = percentile(timings, 0.95);

  console.log('Bench results');
  console.log(`- file: ${inputPath}`);
  console.log(`- engine: ${args.engine || extension}`);
  console.log(`- mode: ${args.mode}`);
  console.log(`- iterations: ${iterations}`);
  console.log(`- avg ms: ${avg.toFixed(2)}`);
  console.log(`- p95 ms: ${p95.toFixed(2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
