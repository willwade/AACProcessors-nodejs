const path = require('path');
const { Command } = require('commander');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const AdmZip = require('adm-zip');

function normalizeChar(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC');
}

function isVisibleChar(value) {
  if (!value) return false;
  if (value.trim().length === 0) return false;
  if (/[\p{Cf}\p{Mn}]/u.test(value)) return false;
  return true;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getAttr(obj, keys) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  }
  return undefined;
}

function setAttr(obj, key, value) {
  obj[key] = value;
}

function buildLayerMaps(layout, extractLayers) {
  const layers = extractLayers(layout, ['base']);
  const charToCodes = new Map();
  const baseLayer = layers.base || {};

  for (const code of Object.keys(baseLayer)) {
    const raw = baseLayer[code];
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const char = normalizeChar(raw);
    if (!charToCodes.has(char)) charToCodes.set(char, []);
    charToCodes.get(char).push({ code, layer: 'base' });
  }

  return { layers, charToCodes };
}

function buildPositionMap(layout) {
  const map = new Map();
  if (!layout || !Array.isArray(layout.keys)) return map;
  for (const key of layout.keys) {
    if (!key || key.pos === undefined || key.row === undefined || key.col === undefined) continue;
    const id = `${key.row}:${key.col}`;
    map.set(id, key.pos);
  }
  return map;
}

function resolveCodeByLabel(label, sourceLayers, sourceCharMap) {
  if (!label || label.length !== 1) return null;

  const normalized = normalizeChar(label);
  const lookup = /^[A-Za-z]$/.test(normalized) ? normalized.toLowerCase() : normalized;
  const baseLayer = sourceLayers.base || {};
  for (const code of Object.keys(baseLayer)) {
    if (normalizeChar(baseLayer[code]) === lookup) {
      return { code, layer: 'base' };
    }
  }

  const entries = sourceCharMap.get(normalized);
  if (!entries || entries.length === 0) return null;
  return entries[0];
}

async function main() {
  const program = new Command();
  program
    .name('replace-keyboard-layout')
    .usage('<gridset> [options]')
    .argument('<gridset>', 'Path to .gridset file')
    .option('--page-name <substring>', 'Only update pages whose name includes this substring')
    .option('--layout <layoutId>', 'Target keyboard layout id', 'ar-arabic-101')
    .option('--source-layout <layoutId>', 'Source keyboard layout id', 'en-us')
    .option('--output <path>', 'Output .gridset path (default: add -keyboard-replaced)')
    .option('--flip-keys-for-grid-rl', 'Mirror key positions before mapping')
    .option('--dry-run', 'Report changes without writing output')
    .parse(process.argv);

  const [gridsetPath] = program.args;
  const options = program.opts();

  if (!gridsetPath) {
    program.help();
    return;
  }

  if (!options.pageName) {
    console.error('Error: --page-name is required to avoid accidental global changes.');
    process.exit(1);
  }

  const outputPath =
    options.output || gridsetPath.replace(/\.gridset$/i, '-keyboard-replaced.gridset');

  let loadKeyboard;
  let extractLayers;
  try {
    ({ loadKeyboard, extractLayers } = require('worldalphabets'));
  } catch (error) {
    console.error('Missing dependency: worldalphabets');
    console.error('Install it for this script with: npm install --no-save worldalphabets');
    process.exit(1);
  }

  console.log('Loading layouts...');
  const sourceLayout = await loadKeyboard(options.sourceLayout);
  const targetLayout = await loadKeyboard(options.layout);
  const { layers: sourceLayers, charToCodes } = buildLayerMaps(sourceLayout, extractLayers);
  const { layers: targetLayers } = buildLayerMaps(targetLayout, extractLayers);
  const positionMap = buildPositionMap(sourceLayout);

  console.log('Loading gridset...');
  const zip = new AdmZip(gridsetPath);
  const entries = zip.getEntries();
  const nameFilter = String(options.pageName).toLowerCase();
  const parser = new XMLParser({ ignoreAttributes: false });
  const builder = new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true });

  let pagesMatched = 0;
  let buttonsUpdated = 0;
  let buttonsSkipped = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!entry.entryName.startsWith('Grids/') || !entry.entryName.endsWith('/grid.xml')) continue;
    const pageName = entry.entryName.slice('Grids/'.length, -'/grid.xml'.length);
    if (!pageName.toLowerCase().includes(nameFilter)) continue;

    pagesMatched += 1;

    const xmlText = entry.getData().toString('utf8');
    const parsed = parser.parse(xmlText);
    const grid = parsed.Grid || parsed.grid;
    if (!grid || !grid.Cells || !grid.Cells.Cell) continue;

    const cells = asArray(grid.Cells.Cell);
    let gridCols = 0;
    if (grid.ColumnDefinitions && grid.ColumnDefinitions.ColumnDefinition) {
      const cols = asArray(grid.ColumnDefinitions.ColumnDefinition);
      gridCols = cols.length;
    }

    let gridUpdated = 0;

    for (const cell of cells) {
      const content = cell.Content || cell.content;
      if (!content) continue;
      const commands = asArray(content.Commands?.Command || content.commands?.command);
      if (commands.length === 0) continue;

      let targetCommand = null;
      for (const cmd of commands) {
        const id = String(getAttr(cmd, ['@_ID', '@_Id', '@_id']) || '');
        if (id === 'Action.Letter') {
          targetCommand = cmd;
          break;
        }
      }
      if (!targetCommand) continue;

      const params = asArray(targetCommand.Parameter);
      let letterParam = null;
      for (const param of params) {
        const key = String(getAttr(param, ['@_Key', '@_key']) || '').toLowerCase();
        if (key === 'letter') {
          letterParam = param;
          break;
        }
      }
      if (!letterParam) continue;

      const original = normalizeChar(getAttr(letterParam, ['#text']) || '');
      if (!original || original.length !== 1) {
        buttonsSkipped += 1;
        continue;
      }

      let mapping = null;
      if (options.flipKeysForGridRl) {
        const x = parseInt(getAttr(cell, ['@_X', '@_x']), 10);
        const y = parseInt(getAttr(cell, ['@_Y', '@_y']), 10);
        if (!Number.isNaN(x) && !Number.isNaN(y) && gridCols > 0) {
          const mirroredCol = gridCols - 1 - x;
          const posKey = `${y}:${mirroredCol}`;
          const code = positionMap.get(posKey);
          if (code) mapping = { code, layer: 'base' };
        }
      }

      if (!mapping) {
        mapping = resolveCodeByLabel(original, sourceLayers, charToCodes);
      }

      if (!mapping) {
        buttonsSkipped += 1;
        continue;
      }

      const targetLayer = targetLayers[mapping.layer] || targetLayers.base || {};
      const updated = normalizeChar(targetLayer[mapping.code]);
      if (!isVisibleChar(updated)) {
        buttonsSkipped += 1;
        continue;
      }

      setAttr(letterParam, '#text', updated);
      if (content.CaptionAndImage && content.CaptionAndImage.Caption !== undefined) {
        const caption = normalizeChar(String(content.CaptionAndImage.Caption || ''));
        if (caption.length === 1 || caption === original) {
          content.CaptionAndImage.Caption = updated;
        }
      }

      gridUpdated += 1;
      buttonsUpdated += 1;
    }

    if (gridUpdated > 0) {
      const rebuilt = builder.build(parsed);
      zip.updateFile(entry.entryName, Buffer.from(rebuilt, 'utf8'));
    }
  }

  console.log(`Pages matched: ${pagesMatched}`);
  console.log(`Buttons updated: ${buttonsUpdated}`);
  console.log(`Buttons skipped: ${buttonsSkipped}`);

  if (options.dryRun) {
    console.log('Dry run enabled. No output written.');
    return;
  }

  zip.writeZip(outputPath);
  console.log(`Saved updated gridset: ${outputPath}`);
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
});
