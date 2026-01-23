#!/usr/bin/env node

/**
 * Merge translated board JSONs back into the original OBZ archive so that
 * we can keep the original media assets (images/sounds/etc.) alongside the new text.
 *
 * Usage:
 *   node scripts/translation/merge-translation-assets.js \
 *     original.obz translated.obz \
 *     merged-with-assets.obz
 */

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

function printUsage() {
  console.log('Usage: node scripts/translation/merge-translation-assets.js <original.obz> <translated.obz> [output.obz]');
  console.log('If no output path is supplied, the script will append "-with-assets" to the translated file name.');
}

async function main() {
  const [, , originalPath, translatedPath, outputArg] = process.argv;

  if (!originalPath || !translatedPath) {
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(originalPath)) {
    console.error(`Original file not found: ${originalPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(translatedPath)) {
    console.error(`Translated file not found: ${translatedPath}`);
    process.exit(1);
  }

  const outputPath =
    outputArg ||
    path.join(
      path.dirname(translatedPath),
      `${path.basename(translatedPath, path.extname(translatedPath))}-with-assets${path.extname(translatedPath)}`
    );

  const originalZip = new AdmZip(originalPath);
  const translatedZip = new AdmZip(translatedPath);

  const resultZip = new AdmZip();

  const normalizeName = (name) => {
    if (name.endsWith('.obf.obf')) {
      return name.replace(/\.obf\.obf$/, '.obf');
    }
    return name;
  };

  const translationEntries = translatedZip.getEntries().map((entry) => ({
    entry,
    normalizedName: normalizeName(entry.entryName),
  }));

  const translationNames = new Set(translationEntries.map((item) => item.normalizedName));

  originalZip.getEntries().forEach((entry) => {
    const normalized = normalizeName(entry.entryName);

    if (translationNames.has(normalized)) {
      return;
    }

    const data = entry.isDirectory ? Buffer.alloc(0) : entry.getData();
    resultZip.addFile(entry.entryName, data, entry.comment || '');
  });

  translationEntries.forEach(({ entry, normalizedName }) => {
    const data = entry.isDirectory ? Buffer.alloc(0) : entry.getData();
    resultZip.addFile(normalizedName, data, entry.comment || '');
  });

  resultZip.writeZip(outputPath);
  console.log(`Merged archive written to ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to merge translation assets:', error);
  process.exit(1);
});
