# AAC Pageset Quickstart (Node + Browser)

This guide shows two simple ways to generate or convert AAC pagesets using `aac-processors`:

- Node.js: full conversion between formats (read + write)
- Browser: generate or export to OBF/OBZ in-memory (downloadable)

If you need lossless conversion in the browser, use a Node/worker service for the save step (file I/O is required for most formats).

## Node.js: Convert and Generate Pagesets

### Install

```bash
npm install aac-processors
```

### Convert a Gridset to OBF

```ts
import { getProcessor, ObfProcessor } from 'aac-processors';

async function convertGridsetToObf() {
  const sourcePath = './input/example.gridset';
  const targetPath = './output/example.obf';

  const sourceProcessor = getProcessor(sourcePath); // GridsetProcessor
  const tree = await sourceProcessor.loadIntoTree(sourcePath);

  const obf = new ObfProcessor();
  await obf.saveFromTree(tree, targetPath);

  console.log('Saved:', targetPath);
}

convertGridsetToObf().catch(console.error);
```

### Generate a Simple Pageset and Save as OBZ

```ts
import { AACTree, AACPage, AACButton, ObfProcessor } from 'aac-processors';

async function generateObz() {
  const tree = new AACTree();
  tree.metadata = { name: 'Starter Demo', locale: 'en' };

  const hello = new AACButton({ id: 'hello', label: 'Hello', message: 'Hello' });
  const thanks = new AACButton({ id: 'thanks', label: 'Thanks', message: 'Thank you' });

  const home = new AACPage({
    id: 'home',
    name: 'Home',
    buttons: [hello, thanks],
    grid: [[hello, thanks]],
  });

  tree.addPage(home);
  tree.rootId = 'home';

  const obf = new ObfProcessor();
  await obf.saveFromTree(tree, './output/starter.obz');

  console.log('Saved: ./output/starter.obz');
}

generateObz().catch(console.error);
```

## Browser: Generate or Convert to OBF/OBZ

In the browser you can still parse files and build an `AACTree`, but most processors cannot write to disk (no `fs`).
The example below generates an `AACTree`, converts it to OBF JSON in-memory, and downloads it.

If you need full conversions in a browser app, do the save step in Node (server or worker).

### Generate a Pageset and Download as OBF

```ts
import { AACTree, AACPage, AACButton, ObfProcessor } from 'aac-processors';

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSampleTree() {
  const tree = new AACTree();
  tree.metadata = { name: 'Browser Demo', locale: 'en' };

  const hello = new AACButton({ id: 'hello', label: 'Hello', message: 'Hello' });
  const yes = new AACButton({ id: 'yes', label: 'Yes', message: 'Yes' });

  const home = new AACPage({
    id: 'home',
    name: 'Home',
    buttons: [hello, yes],
    grid: [[hello, yes]],
  });

  tree.addPage(home);
  tree.rootId = 'home';
  return tree;
}

async function exportObf(tree: AACTree) {
  // This mirrors the browser demo approach: create OBF JSON and download.
  // ObfProcessor.saveFromTree writes to disk, so we build a board in-memory.
  const obf = new ObfProcessor() as ObfProcessor & {
    createObfBoardFromPage?: (page: AACPage, fallbackName: string, metadata?: AACTree['metadata']) => any;
  };

  const rootPage = tree.rootId ? tree.getPage(tree.rootId) : Object.values(tree.pages)[0];
  const board = obf.createObfBoardFromPage
    ? obf.createObfBoardFromPage(rootPage!, 'Board', tree.metadata)
    : {
        format: 'open-board-0.1',
        id: rootPage?.id ?? 'board',
        name: rootPage?.name ?? 'Board',
        locale: tree.metadata?.locale || 'en',
        grid: { rows: 1, columns: rootPage?.buttons.length ?? 0, order: [] },
        buttons: (rootPage?.buttons || []).map((button) => ({
          id: button.id,
          label: button.label,
          vocalization: button.message || button.label,
        })),
      };

  const json = JSON.stringify(board, null, 2);
  downloadBlob(json, 'browser-demo.obf', 'application/json');
}

const tree = buildSampleTree();
exportObf(tree);
```

### Convert an Uploaded Pageset to OBZ (Browser)

This uses the same idea as the Vite demo: parse any supported file into a tree,
then export OBF/OBZ in-memory and download.

```ts
import { getProcessor, ObfProcessor, type AACTree, type AACPage } from 'aac-processors';
import JSZip from 'jszip';

async function convertToObz(file: File) {
  const extension = '.' + file.name.split('.').pop();
  const processor = getProcessor(extension);
  const buffer = await file.arrayBuffer();
  const tree = await processor.loadIntoTree(buffer);

  const obf = new ObfProcessor() as ObfProcessor & {
    createObfBoardFromPage?: (page: AACPage, fallbackName: string, metadata?: AACTree['metadata']) => any;
  };

  const zip = new JSZip();
  Object.values(tree.pages).forEach((page) => {
    const board = obf.createObfBoardFromPage
      ? obf.createObfBoardFromPage(page, 'Board', tree.metadata)
      : { format: 'open-board-0.1', id: page.id, name: page.name, grid: { rows: 0, columns: 0, order: [] }, buttons: [] };
    zip.file(`${page.id}.obf`, JSON.stringify(board, null, 2));
  });

  const data = await zip.generateAsync({ type: 'uint8array' });
  const blob = new Blob([data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.obz';
  a.click();
  URL.revokeObjectURL(url);
}
```

## Tips

- Use `loadIntoTree()` to normalize different AAC formats into one structure.
- In Node, `saveFromTree()` lets you write to OBF, OBZ, Gridset, etc.
- In the browser, build the output in memory and offer it for download.
- For full-fidelity conversions in the browser, use a server-side endpoint to save files.
