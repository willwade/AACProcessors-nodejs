# AACProcessors

A TypeScript library for reading, analyzing, translating, and converting AAC
(Augmentative and Alternative Communication) file formats. The package ships
as a dual build: a full Node.js entry and a browser-safe entry.

## Install

```bash
npm install @willwade/aac-processors
```

## Dual Build Targets

### Node.js (default)
Full feature set, including filesystem access, SQLite-backed formats, and
ZIP/encrypted formats.

```ts
import { getProcessor, SnapProcessor } from '@willwade/aac-processors';

const processor = getProcessor('board.sps');
const tree = await processor.loadIntoTree('board.sps');

const snap = new SnapProcessor();
const texts = await snap.extractTexts('board.sps');
```

### Browser
Browser-safe entry that avoids Node-only dependencies. It expects `Buffer`,
`Uint8Array`, or `ArrayBuffer` inputs rather than file paths.

```ts
import { GridsetProcessor } from '@willwade/aac-processors/browser';

const processor = new GridsetProcessor();
const tree = await processor.loadIntoTree(gridsetUint8Array);
```

## Supported Formats

- Snap/SPS (Tobii Dynavox)
- Grid3/Gridset (Smartbox)
- TouchChat (PRC-Saltillo)
- OBF/OBZ (Open Board Format)
- OPML
- DOT (Graphviz)
- Apple Panels (macOS plist)
- Asterics Grid
- Excel export

## Translation Workflow

All processors implement `processTexts()` for translation use cases.

```ts
import { DotProcessor } from '@willwade/aac-processors';

const processor = new DotProcessor();
const texts = await processor.extractTexts('board.dot');

const translations = new Map([
  ['Hello', 'Hola'],
  ['Food', 'Comida'],
]);

await processor.processTexts('board.dot', translations, 'board-es.dot');
```

## Documentation

- API reference (TypeDoc): https://willwade.github.io/AACProcessors-nodejs/
- Metrics guide: `src/utilities/analytics/docs/AAC_METRICS_GUIDE.md`
- Vocabulary analysis guide: `src/utilities/analytics/docs/VOCABULARY_ANALYSIS_GUIDE.md`

## Examples and Scripts

- Code examples: `examples/`
- Utility scripts and workflows: `scripts/` (see `scripts/README.md`)

## Build, Lint, Test

```bash
npm run build:all
npm run lint
npm test
```

## Electron Note

`better-sqlite3` is a native dependency. For Electron, rebuild it against the
Electron runtime:

```bash
npx electron-rebuild
```
