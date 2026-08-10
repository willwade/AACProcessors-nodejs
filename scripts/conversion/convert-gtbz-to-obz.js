#!/usr/bin/env node
/**
 * Convert a GoTalk NOW `.gtbz` communication board into an OBF `.obz` archive.
 *
 * Loads the `.gtbz` into the common AACTree via GotalkNowProcessor, embeds each
 * button's bundled image (e.g. Metacom symbols) as a base64 data URL on the
 * page's `images` array, then writes an `.obz` via ObfProcessor.
 *
 * Usage:
 *   npm run build
 *   node scripts/conversion/convert-gtbz-to-obz.js <input.gtbz> <output.obz>
 *
 * The resulting `.obz` passes the library's own ObfValidator and can be opened
 * in any OBF-compatible viewer (Cboard, OBF Viewer, etc.).
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function requireLibrary() {
  const distPath = path.resolve(__dirname, '..', '..', 'dist');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(distPath);
  } catch {
    console.error('Could not load the built library from dist/. Run `npm run build` first.');
    process.exit(1);
  }
}

/** Encode bytes as base64 without relying on Buffer (browser-portable fallback). */
function encodeBase64(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes.toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, 'binary').toString('base64');
}

/** Read width/height from a PNG's IHDR chunk (bytes 16..24). */
function pngDimensions(bytes) {
  if (bytes.length < 24) return {};
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) return {};
  const readU32 = (off) =>
    ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
  return { width: readU32(16), height: readU32(20) };
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: node scripts/conversion/convert-gtbz-to-obz.js <input.gtbz> <output.obz>');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);
  if (!fs.existsSync(inputPath)) {
    console.error('Input file not found:', inputPath);
    process.exit(1);
  }

  const { GotalkNowProcessor, ObfProcessor } = requireLibrary();

  console.log('Loading GoTalk NOW file:', inputPath);
  const gotalk = new GotalkNowProcessor();
  const tree = await gotalk.loadIntoTree(inputPath);
  console.log(
    'Loaded %d page(s). Format=%s Home=%s',
    Object.keys(tree.pages).length,
    tree.metadata.format,
    tree.metadata.defaultHomePageId
  );

  // Open the original archive to read image bytes.
  const sourceZip = new AdmZip(inputPath);
  const fileNames = new Set(
    sourceZip.getEntries().filter((e) => !e.isDirectory).map((e) => e.entryName)
  );

  let embedded = 0;
  for (const page of Object.values(tree.pages)) {
    page.images = Array.isArray(page.images) ? page.images : [];

    for (const button of page.buttons) {
      const location = button.resolvedImageEntry || button.image;
      if (!location || !fileNames.has(location)) continue;

      const entry = sourceZip.getEntry(location);
      if (!entry) continue;
      const bytes = entry.getData();
      const { width, height } = pngDimensions(bytes);
      const imageId = `img_${button.id}`;

      page.images.push({
        id: imageId,
        data: `data:image/png;base64,${encodeBase64(bytes)}`,
        content_type: 'image/png',
        width,
        height,
      });

      button.parameters = { ...(button.parameters || {}), image_id: imageId };
      embedded++;
    }
  }
  console.log('Embedded %d image(s) as data URLs.', embedded);

  // Give the board set a friendly name from the filename and tag the locale.
  tree.metadata.name = path.basename(inputPath, '.gtbz');
  if (!tree.metadata.locale) tree.metadata.locale = 'en';

  console.log('Writing OBZ:', outputPath);
  const obf = new ObfProcessor();
  await obf.saveFromTree(tree, outputPath, true);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Conversion failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
