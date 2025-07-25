# AACProcessors (Node.js Edition)

A JavaScript/Node.js library and CLI for reading, writing, and working with data structures in AAC (Augmentative and Alternative Communication) systems.

---

## Features
- **Multi-format support:**
  - Snap (Tobii Dynavox)
  - Grid 3
  - TouchChat
  - OBF/OBZ (Open Board Format/Zip)
  - OPML
  - DOT (Graphviz)
  - More coming soon!
- **Parse, analyze, and convert** between AAC board formats
- **Extract text, navigation, and symbol references**
- **Optional symbol library support** (PCS, ARASAAC, etc.)
- **Extensible:** Add your own processors or viewers easily

---

## Installation

```bash
npm install
git clone https://github.com/willwade/AACProcessors-nodejs.git
cd AACProcessors-nodejs
npm install
```

---

## Build (TypeScript)

This library is now written in TypeScript.

To build the project (output to `dist/`):

```bash
npm run build
```

---

## Usage

### Library (Node.js)

```js
const { DotProcessor, OpmlProcessor, SnapProcessor, GridsetProcessor, TouchChatProcessor, ObfProcessor } = require('./dist/processors');
const path = require('path');

const dotFile = path.join(__dirname, 'examples/example.dot');
const dotProcessor = new DotProcessor();
const tree = dotProcessor.loadIntoTree(dotFile);
console.log(tree);
```

### Audio Support (SnapProcessor)

The SnapProcessor now supports optional audio loading and manipulation:

```js
// Basic usage (no audio) - backward compatible
const processor = new SnapProcessor();
const tree = processor.loadIntoTree('pageset.sps');

// With audio support
const audioProcessor = new SnapProcessor(null, { loadAudio: true });
const audioTree = audioProcessor.loadIntoTree('pageset.sps');
// Buttons will have audioRecording property if audio exists

// Add audio to buttons
const audioData = fs.readFileSync('audio.wav');
const audioId = processor.addAudioToButton(dbPath, buttonId, audioData, 'metadata');

// Create enhanced pageset with multiple audio files
const audioMappings = new Map();
audioMappings.set(buttonId, { audioData, metadata: 'Punjabi audio' });
processor.createAudioEnhancedPageset(source, target, audioMappings);
```

### CLI

After building, you can use the CLI:

```bash
node dist/cli/index.js extract examples/example.gridset --format gridset
```

---

## Examples

See [`examples/demo.js`](examples/demo.js) for a comprehensive showcase of all engines:
- Loads and analyzes Snap, Gridset, TouchChat, OPML, DOT, OBF/OBZ files
- Prints trees, extracts texts, and demonstrates optional symbol extraction

To run the demo script (after building):

```bash
node examples/demo.js
```

---

## Optional Symbol Support

Symbol lookup (PCS, ARASAAC, etc.) is available via [`src/optional/symbolTools.ts`](src/optional/symbolTools.ts):
- Symbol extractors and resolvers for Snap, Grid 3, TouchChat
- Only loaded if needed—core library works without symbol files
- See code comments for extension points

---

## Development & Testing

- Run all tests:
  ```bash
  npm test
  ```
- Lint:
  ```bash
  npx eslint src/
  ```
- Format:
  ```bash
  npx prettier --write src/
  ```

---

## Directory Structure

- `src/` — Main library source code
- `src/processors/` — Format-specific processors
- `src/optional/` — Optional features (e.g., symbol libraries)
- `examples/` — Example files and demo scripts
- `test/` — Jest-based test suite

---

## License
MIT

---

## Credits
By Will Wade and contributors. Inspired by the Python AACProcessors project.
