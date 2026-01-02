#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function requireLibrary() {
  const distPath = path.resolve(__dirname, '../../dist');
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(distPath);
  } catch (error) {
    console.error('Unable to load the built library from dist/. Have you run "npm run build"?');
    throw error;
  }
}

function formatButton(button) {
  if (!button) {
    return ' ';
  }

  const parts = [];
  const label = button.label?.trim();
  const message = button.message?.trim();
  const target = button.semanticAction?.targetId || button.targetPageId;

  if (label) {
    parts.push(`**${label}**`);
  } else if (message) {
    parts.push(`_${message}_`);
  } else {
    parts.push('_(empty)_');
  }

  if (message && label && message !== label) {
    parts.push(`“${message}”`);
  }

  if (target) {
    parts.push(`➡️ ${target}`);
  }

  return parts.join('<br />');
}

function normaliseGrid(grid, fallbackButtons = []) {
  if (Array.isArray(grid) && grid.length > 0) {
    const maxColumns = grid.reduce((max, row) => Math.max(max, row.length), 0);
    return grid.map((row) => {
      const padded = Array.from({ length: maxColumns }, (_, column) => row[column] || null);
      return padded;
    });
  }

  if (fallbackButtons.length === 0) {
    return [];
  }

  const width = Math.ceil(Math.sqrt(fallbackButtons.length));
  const normalised = [];
  let row = [];
  fallbackButtons.forEach((button) => {
    row.push(button);
    if (row.length === width) {
      normalised.push(row);
      row = [];
    }
  });

  if (row.length > 0) {
    while (row.length < width) {
      row.push(null);
    }
    normalised.push(row);
  }

  return normalised;
}

function buildMarkdownTable(page) {
  const grid = normaliseGrid(page.grid, page.buttons);
  if (grid.length === 0) {
    return '# Unable to infer layout for this page';
  }

  const columns = grid[0].length;
  const header = `| ${Array.from({ length: columns }, (_, index) => `Col ${index + 1}`).join(' | ')} |`;
  const separator = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`;
  const rows = grid.map((row) => `| ${row.map((cell) => formatButton(cell)).join(' | ')} |`);

  return [header, separator, ...rows].join('\n');
}

function findPage(tree, identifier) {
  if (!identifier) {
    return tree.rootId ? tree.pages[tree.rootId] : Object.values(tree.pages)[0];
  }

  const pages = Object.values(tree.pages);
  return (
    tree.pages[identifier] ||
    pages.find((page) => page.name?.toLowerCase() === identifier.toLowerCase()) ||
    pages.find((page) => page.id.toLowerCase() === identifier.toLowerCase())
  );
}

function main() {
  const [input = path.resolve(__dirname, '../../examples/example.sps'), pageIdentifier, outputPath] = process.argv.slice(2);
  const resolvedInput = path.resolve(process.cwd(), input);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  const { getProcessor } = requireLibrary();
  const processor = getProcessor(resolvedInput);
  const tree = processor.loadIntoTree(resolvedInput);
  const page = findPage(tree, pageIdentifier);

  if (!page) {
    console.error('Unable to locate the requested page. Available pages:');
    Object.values(tree.pages)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach((candidate) =>
        console.error(` - ${candidate.name || '(untitled page)'} (id: ${candidate.id})`),
      );
    process.exit(1);
  }

  const markdown = `# ${page.name || 'Untitled Page'}\n\n${buildMarkdownTable(page)}`;
  console.log(markdown);

  if (outputPath) {
    const resolvedOutput = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(resolvedOutput, `${markdown}\n`);
    console.log(`\nSaved layout to ${resolvedOutput}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
