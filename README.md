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
npm install aac-processors
```

Or clone this repo and run directly:

```bash
git clone <this-repo-url>
cd aac-processors
npm install
```

---

## Usage

### Library (Node.js)

```js
const SnapProcessor = require('./src/processors/snapProcessor');
const GridsetProcessor = require('./src/processors/gridsetProcessor');
const TouchChatProcessor = require('./src/processors/touchchatProcessor');
const path = require('path');

const snapFile = path.join(__dirname, 'examples/example.sps');
const snapProcessor = new SnapProcessor();
const tree = snapProcessor.loadIntoTree(snapFile);
console.log(tree);
```

### CLI

```bash
node src/cli/index.js extract examples/example.gridset --format gridset
```

---

## Examples

See [`examples/demo.js`](examples/demo.js) for a comprehensive showcase of all engines:
- Loads and analyzes Snap, Gridset, TouchChat, OPML, DOT, OBF/OBZ files
- Prints trees, extracts texts, and demonstrates optional symbol extraction

---

## Optional Symbol Support

Symbol lookup (PCS, ARASAAC, etc.) is available via [`src/optional/symbolTools.js`](src/optional/symbolTools.js):
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
