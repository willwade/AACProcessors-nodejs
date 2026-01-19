#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

function requireLibrary() {
  const distZipPath = path.resolve(__dirname, '../dist/utils/zip.js');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(distZipPath);
  } catch (error) {
    console.error('Unable to load the built library from dist/. Have you run "npm run build"?');
    throw error;
  }
}

function parseArgs(argv) {
  const args = {
    file: '',
    backend: 'auto',
    iterations: 5,
    entry: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i + 1];
    if (argv[i] === '--file' && value) {
      args.file = value;
      i += 1;
    } else if (argv[i] === '--backend' && value) {
      args.backend = value;
      i += 1;
    } else if (argv[i] === '--iterations' && value) {
      args.iterations = Math.max(1, Number(value));
      i += 1;
    } else if (argv[i] === '--entry' && value) {
      args.entry = value;
      i += 1;
    }
  }
  return args;
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
    console.error('Usage: node scripts/bench-zip.js --file <path> [--backend admzip|jszip|yauzl] [--iterations N] [--entry <name>]');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const { openZipFromInput } = requireLibrary();
  const iterations = args.iterations;
  const timings = [];
  let entryName = args.entry;
  let entryCount = 0;

  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    const { zip } = await openZipFromInput(inputPath, { backend: args.backend });
    const entries = zip.listFiles();
    entryCount = entries.length;
    if (!entryName) {
      entryName = entries.find((name) => !name.endsWith('/')) || entries[0];
    }
    if (entryName) {
      await zip.readFile(entryName);
    }
    timings.push(performance.now() - start);
  }

  const avg = mean(timings);
  const p95 = percentile(timings, 0.95);

  console.log('Zip bench results');
  console.log(`- file: ${inputPath}`);
  console.log(`- backend: ${args.backend}`);
  console.log(`- iterations: ${iterations}`);
  console.log(`- entries: ${entryCount}`);
  console.log(`- entry: ${entryName || 'n/a'}`);
  console.log(`- avg ms: ${avg.toFixed(2)}`);
  console.log(`- p95 ms: ${p95.toFixed(2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
