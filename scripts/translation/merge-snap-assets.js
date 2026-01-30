#!/usr/bin/env node

/**
 * Merge translated text from a Snap .sps/.spb into the original database
 * while preserving original assets (images/audio/layout metadata).
 *
 * Usage:
 *   node scripts/translation/merge-snap-assets.js \
 *     original.sps translated.sps \
 *     merged-with-assets.sps
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function printUsage() {
  console.log(
    'Usage: node scripts/translation/merge-snap-assets.js <original.sps> <translated.sps> [output.sps]'
  );
  console.log(
    'If no output path is supplied, the script will append "-with-assets" to the translated file name.'
  );
}

function getTableColumns(db, tableName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(rows.map((row) => row.name));
  } catch {
    return new Set();
  }
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

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.copyFileSync(originalPath, outputPath);

  const outDb = new Database(outputPath, { readonly: false });
  const transDb = new Database(translatedPath, { readonly: true });

  try {
    const outPageCols = getTableColumns(outDb, 'Page');
    const transPageCols = getTableColumns(transDb, 'Page');
    const outButtonCols = getTableColumns(outDb, 'Button');
    const transButtonCols = getTableColumns(transDb, 'Button');
    const outPropsCols = getTableColumns(outDb, 'PageSetProperties');
    const transPropsCols = getTableColumns(transDb, 'PageSetProperties');

    const canUpdatePage =
      outPageCols.size > 0 &&
      transPageCols.size > 0 &&
      outPageCols.has('Name') &&
      transPageCols.has('Name');
    const canUpdatePageTitle = outPageCols.has('Title') && transPageCols.has('Title');
    const canUpdatePageByUniqueId = outPageCols.has('UniqueId') && transPageCols.has('UniqueId');

    const canUpdateButtonLabel =
      outButtonCols.has('Label') && transButtonCols.has('Label') && outButtonCols.has('Id');
    const canUpdateButtonMessage =
      outButtonCols.has('Message') && transButtonCols.has('Message') && outButtonCols.has('Id');

    const tx = outDb.transaction(() => {
      if (canUpdatePage) {
        if (canUpdatePageByUniqueId) {
          const translatedPages = transDb
            .prepare('SELECT UniqueId, Name, Title FROM Page')
            .all();
          const updatePage = outDb.prepare(
            'UPDATE Page SET Name = ?, Title = ? WHERE UniqueId = ?'
          );
          translatedPages.forEach((row) => {
            const name = row.Name ?? '';
            const title = canUpdatePageTitle ? row.Title ?? name : name;
            updatePage.run(name, title, row.UniqueId);
          });
        } else {
          const translatedPages = transDb.prepare('SELECT Id, Name, Title FROM Page').all();
          const updatePage = outDb.prepare('UPDATE Page SET Name = ?, Title = ? WHERE Id = ?');
          translatedPages.forEach((row) => {
            const name = row.Name ?? '';
            const title = canUpdatePageTitle ? row.Title ?? name : name;
            updatePage.run(name, title, row.Id);
          });
        }
      }

      if (canUpdateButtonLabel) {
        const translatedButtons = transDb.prepare('SELECT Id, Label FROM Button').all();
        const updateLabel = outDb.prepare('UPDATE Button SET Label = ? WHERE Id = ?');
        translatedButtons.forEach((row) => {
          updateLabel.run(row.Label ?? '', row.Id);
        });
      }

      if (canUpdateButtonMessage) {
        const translatedButtons = transDb.prepare('SELECT Id, Message FROM Button').all();
        const updateMessage = outDb.prepare('UPDATE Button SET Message = ? WHERE Id = ?');
        translatedButtons.forEach((row) => {
          updateMessage.run(row.Message ?? '', row.Id);
        });
      }

      if (outPropsCols.size > 0 && transPropsCols.size > 0) {
        const props = transDb.prepare('SELECT * FROM PageSetProperties LIMIT 1').get();
        if (props) {
          const updates = [];
          const values = [];
          ['Name', 'Description', 'Author', 'Locale'].forEach((key) => {
            if (outPropsCols.has(key) && transPropsCols.has(key) && props[key] !== undefined) {
              updates.push(`${key} = ?`);
              values.push(props[key]);
            }
          });
          if (updates.length > 0) {
            outDb.prepare(`UPDATE PageSetProperties SET ${updates.join(', ')}`).run(...values);
          }
        }
      }
    });

    tx();
  } finally {
    outDb.close();
    transDb.close();
  }

  console.log(`Merged Snap file written to ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to merge Snap assets:', error);
  process.exit(1);
});
