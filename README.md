# AACProcessors

[![Coverage](https://img.shields.io/badge/coverage-77%25-green.svg)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-140%20tests-brightgreen.svg)](./test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive **TypeScript library** for processing AAC (Augmentative and Alternative Communication) file formats with advanced translation support, cross-format conversion, and robust error handling.

## 🚀 Features

### **Multi-Format Support**

- **Snap/SPS** (Tobii Dynavox) - Full database support with audio
- **Grid3/Gridset** (Smartbox) - XML-based format processing
- **TouchChat** (PRC-Saltillo) - SQLite database handling
- **OBF/OBZ** (Open Board Format) - JSON and ZIP support
- **OPML** (Outline Processor Markup Language) - Hierarchical structures
- **DOT** (Graphviz) - Graph-based communication boards
- **Apple Panels** (iOS) - Plist format support

### **Advanced Capabilities**

- 🔄 **Cross-format conversion** - Convert between any supported formats
- 🌍 **Translation workflows** - Built-in i18n support with `processTexts()`
- 🧪 **Property-based testing** - Robust validation with 140+ tests
- ⚡ **Performance optimized** - Memory-efficient processing of large files
- 🛡️ **Error recovery** - Graceful handling of corrupted data
- 🔒 **Thread-safe** - Concurrent processing support
- 📊 **Comprehensive logging** - Detailed operation insights

---

## 📦 Installation

### From npm (Recommended)

```bash
npm install aac-processors
```

### From Source

```bash
git clone https://github.com/willwade/AACProcessors-nodejs.git
cd AACProcessors-nodejs
npm install
npm run build
```

### Requirements

- **Node.js** 16.0.0 or higher
- **TypeScript** 5.5+ (for development)

---

## 🔧 Quick Start

### Basic Usage (TypeScript/ES6)

```typescript
import {
  getProcessor,
  DotProcessor,
  SnapProcessor,
  AstericsGridProcessor,
} from "aac-processors";

// Auto-detect processor by file extension
const processor = getProcessor("communication-board.dot");
const tree = processor.loadIntoTree("communication-board.dot");

// Extract all text content
const texts = processor.extractTexts("communication-board.dot");
console.log("Found texts:", texts);

// Direct processor usage
const dotProcessor = new DotProcessor();
const aacTree = dotProcessor.loadIntoTree("examples/example.dot");
console.log("Pages:", Object.keys(aacTree.pages).length);
```

### Basic Usage (CommonJS)

```javascript
const { getProcessor, DotProcessor } = require("aac-processors");

const processor = getProcessor("board.dot");
const tree = processor.loadIntoTree("board.dot");
console.log(tree);
```

### Translation Workflows

All processors support built-in translation via the `processTexts()` method:

```typescript
import { DotProcessor } from "aac-processors";

const processor = new DotProcessor();

// 1. Extract all translatable text
const originalTexts = processor.extractTexts("board.dot");

// 2. Create translation map (integrate with your translation service)
const translations = new Map([
  ["Hello", "Hola"],
  ["Goodbye", "Adiós"],
  ["Food", "Comida"],
]);

// 3. Apply translations and save
const translatedBuffer = processor.processTexts(
  "board.dot",
  translations,
  "board-spanish.dot",
);

console.log("Translation complete!");
```

### Cross-Format Conversion

Convert between any supported AAC formats:

```typescript
import { DotProcessor, ObfProcessor } from "aac-processors";

// Load from DOT format
const dotProcessor = new DotProcessor();
const tree = dotProcessor.loadIntoTree("communication-board.dot");

// Save as OBF format
const obfProcessor = new ObfProcessor();
obfProcessor.saveFromTree(tree, "communication-board.obf");

// The tree structure is preserved across formats
console.log("Conversion complete!");
```

### Advanced Usage

#### Asterics Grid with Audio Support

```typescript
import { AstericsGridProcessor } from "aac-processors";

// Load Asterics Grid file with audio support
const processor = new AstericsGridProcessor({ loadAudio: true });
const tree = processor.loadIntoTree("communication-board.grd");

// Access audio recordings from buttons
tree.traverse((page) => {
  page.buttons.forEach((button) => {
    if (button.audioRecording) {
      console.log(`Button "${button.label}" has audio recording`);
      console.log(
        `Audio data size: ${button.audioRecording.data?.length} bytes`,
      );
    }
  });
});

// Add audio to specific elements
const audioData = Buffer.from(/* your audio data */);
processor.addAudioToElement(
  "board.grd",
  "element-id",
  audioData,
  JSON.stringify({ mimeType: "audio/wav", durationMs: 2000 }),
);

// Create enhanced version with multiple audio recordings
const audioMappings = new Map();
audioMappings.set("element-1", { audioData: audioBuffer1 });
audioMappings.set("element-2", { audioData: audioBuffer2 });
processor.createAudioEnhancedGridFile(
  "source.grd",
  "enhanced.grd",
  audioMappings,
);
```

#### Working with the AACTree Structure

```typescript
import { AACTree, AACPage, AACButton } from "aac-processors";

// Create a communication board programmatically
const tree = new AACTree();

const homePage = new AACPage({
  id: "home",
  name: "Home Page",
  buttons: [],
});

const helloButton = new AACButton({
  id: "btn_hello",
  label: "Hello",
  message: "Hello, how are you?",
  type: "SPEAK",
});

const foodButton = new AACButton({
  id: "btn_food",
  label: "Food",
  message: "I want food",
  type: "NAVIGATE",
  targetPageId: "food_page",
});

homePage.addButton(helloButton);
homePage.addButton(foodButton);
tree.addPage(homePage);

// Save to any format
const processor = new DotProcessor();
processor.saveFromTree(tree, "my-board.dot");
```

#### Error Handling

```typescript
import { DotProcessor } from "aac-processors";

const processor = new DotProcessor();

try {
  const tree = processor.loadIntoTree("potentially-corrupted.dot");
  console.log("Successfully loaded:", Object.keys(tree.pages).length, "pages");
} catch (error) {
  console.error("Failed to load file:", error.message);
  // Processor handles corruption gracefully and provides meaningful errors
}
```

### CLI Usage

```bash
# Extract text from any AAC file
npx aac-processors extract examples/example.dot

# Convert between formats
npx aac-processors convert input.sps output.obf

# Get file information
npx aac-processors info examples/example.gridset
```

---

## 📚 API Reference

### Core Classes

#### `getProcessor(filePathOrExtension: string): BaseProcessor`

Factory function that returns the appropriate processor for a file extension.

```typescript
const processor = getProcessor(".dot"); // Returns DotProcessor
const processor2 = getProcessor("file.obf"); // Returns ObfProcessor
```

#### `BaseProcessor`

Abstract base class for all processors with these key methods:

- `loadIntoTree(filePathOrBuffer: string | Buffer): AACTree` - Load file into tree structure
- `saveFromTree(tree: AACTree, outputPath: string): void` - Save tree to file
- `extractTexts(filePathOrBuffer: string | Buffer): string[]` - Extract all text content
- `processTexts(input: string | Buffer, translations: Map<string, string>, outputPath: string): Buffer` - Apply translations

#### `AACTree`

Core data structure representing a communication board:

```typescript
interface AACTree {
  pages: Record<string, AACPage>;
  rootId?: string;
  addPage(page: AACPage): void;
  traverse(callback: (page: AACPage) => void): void;
}
```

#### `AACPage`

Represents a single page/screen in a communication board:

```typescript
interface AACPage {
  id: string;
  name: string;
  buttons: AACButton[];
  parentId?: string;
  addButton(button: AACButton): void;
}
```

#### `AACButton`

Represents a button/cell in a communication board:

```typescript
interface AACButton {
  id: string;
  label: string;
  message?: string;
  type: "SPEAK" | "NAVIGATE";
  targetPageId?: string; // For navigation buttons
}
```

### Supported Processors

| Processor               | File Extensions | Description                   |
| ----------------------- | --------------- | ----------------------------- |
| `DotProcessor`          | `.dot`          | Graphviz DOT format           |
| `OpmlProcessor`         | `.opml`         | OPML hierarchical format      |
| `ObfProcessor`          | `.obf`, `.obz`  | Open Board Format (JSON/ZIP)  |
| `SnapProcessor`         | `.sps`, `.spb`  | Tobii Dynavox Snap format     |
| `GridsetProcessor`      | `.gridset`      | Smartbox Grid 3 format        |
| `TouchChatProcessor`    | `.ce`           | PRC-Saltillo TouchChat format |
| `ApplePanelsProcessor`  | `.plist`        | iOS Apple Panels format       |
| `AstericsGridProcessor` | `.grd`          | Asterics Grid native format   |

---

## 🧪 Testing & Quality

This library maintains **62% test coverage** with **255+ comprehensive tests** including:

- **Unit tests** for all processors and core functionality
- **Integration tests** for cross-format workflows
- **Property-based tests** using fast-check for edge case discovery
- **Performance tests** for memory usage and large file handling
- **Error handling tests** for corrupted data and edge cases

### Running Tests

```bash
# Run all tests (automatically builds first)
npm test

# Run with coverage report (automatically builds first)
npm run test:coverage

# Run tests in watch mode (automatically builds first)
npm run test:watch

# Generate detailed coverage analysis
npm run coverage:report
```

**Note**: All test commands automatically run `npm run build` first to ensure CLI tests have the required `dist/` files. CLI integration tests require the compiled JavaScript files to test the command-line interface.

### Development Commands

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run build:watch

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/willwade/AACProcessors-nodejs.git
cd AACProcessors-nodejs
npm install
npm run build
npm test
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

Created by **Will Wade** and contributors.

Inspired by the Python AACProcessors project and built for the AAC community.

### Related Projects

- [AACProcessors (Python)](https://github.com/willwade/AACProcessors) - Original Python implementation
- [Open Board Format](https://www.openboardformat.org/) - Open standard for communication boards

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/willwade/AACProcessors-nodejs/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/willwade/AACProcessors-nodejs/discussions)
- 📧 **Email**: wwade@acecentre.org.uk

---

## 📋 TODO & Roadmap

### High Priority

- [ ] **Fix SnapProcessor coverage** (currently 48.32%) - Add comprehensive audio handling, database corruption tests, and SQLite schema validation
- [ ] **Improve TouchChatProcessor coverage** (currently 57.62%) - Add comprehensive SQLite schema tests and fix UNIQUE constraint violations in real-world data processing
- [ ] **Fix database constraint violations** - Resolve UNIQUE constraint failures in Page.Id and buttons.id when processing real-world data files
- [ ] **Add missing core functionality tests** (currently 46.15% coverage) - Test analyze.ts, fileProcessor.ts, and other core utilities
- [ ] **Fix property-based test failures** - Resolve TypeScript interface compatibility issues causing test failures with button ID uniqueness and round-trip processing

### Critical Test Fixes Needed

- [ ] **Real-world data processing** - Fix SQLite constraint violations when processing example.spb, example.sps, and example.ce files
- [ ] **Audio handling edge cases** - Complete SnapProcessor audio functionality that's currently undefined
- [ ] **Memory leak detection** - Fix performance tests that are failing due to memory assertion issues
- [ ] **Property-based test generators** - Fix test data generators to ensure valid button ID uniqueness

### Recently Completed ✅

- [x] **Build integration** - Ensure `npm run build` is executed before CLI tests (Fixed: All test scripts now automatically build before running)
- [x] **CLI test infrastructure** - Fixed "Cannot find module" errors in CLI integration tests

### Medium Priority

- [ ] **Performance optimization** - Optimize memory usage for very large communication boards (1000+ buttons)
- [ ] **Add GridsetProcessor ZIP handling** - Improve support for complex Grid3 ZIP archives
- [ ] **Enhance error recovery** - Better handling of partially corrupted database files
- [ ] **Add streaming support** - Process very large files without loading entirely into memory
- [ ] **Improve translation workflows** - Add support for translation service integrations (Google Translate, Azure, etc.)
- [ ] **Add symbol library integration** - Complete implementation of PCS, ARASAAC symbol lookups

### Low Priority

- [ ] **Add more AAC formats** - Look for other common AAC formats to add
- [ ] **Plugin system** - Allow third-party processors and extensions
- [ ] **Batch processing CLI** - Process multiple files in parallel
- [ ] **Configuration file support** - Allow .aacprocessors.json config files

### Testing & Quality

- [ ] **Reach 90%+ test coverage** - Current: 77% (target: 90%+)
- [ ] **Add mutation testing** - Use Stryker.js for mutation testing
- [ ] **Add benchmark suite** - Performance regression testing
- [ ] **CI/CD improvements** - Add automated releases and npm publishing
- [ ] **Documentation improvements** - Add more real-world examples and tutorials

### Known Issues

- ⚠️ **TouchChatProcessor**: Some complex SQLite schemas not fully supported
- ⚠️ **Property-based tests**: TypeScript interface mismatches in edge cases
- ⚠️ **Memory usage**: Large files (>50MB) may cause memory pressure
- ⚠️ **Concurrent access**: Some processors not fully thread-safe for simultaneous writes

## More enhancements

- Action types on buttons. We have SPEAK, NAVIGATE, but we could also have things like "PLAY_AUDIO", "SEND_MESSAGE", "OPEN_URL", etc. This would allow us to have a more flexible structure for actions, especially if we want to support different types of actions or additional metadata in the future. This needs to be very flexible. eaach system has a very different set of actions. We could have a set of core actions that are supported by all systems, and then allow each system to define its own additional actions. This could be done by having a set of core action types that are defined in the AACSystem type, and then allowing each system to define its own additional action types in the AACPageSet or AACPage types.
- Styling information for buttons, background colors, and text colors etc
- Current language and locale information of aac pageset
- Symbols and their associated data. Now we have an optional part but I think this might need rethinking. I wonder if "Symbols" should be a separate type - alongside AACPageSet and AACPage. that then AACPageSet and AACPage can reference. This would allow us to have a more flexible structure for symbols, especially if we want to support different types of symbols or additional metadata in the future. Symbols would have: Library name, ID, Text name, Reference (URL, DB ID, etc.), and an optional part for additional metadata. We could have synoynms, antonyms, also and for different languages somehow.
- Somehow we need to deal with access. Switch scanning: Blocks probably being the main aspect. But also - we need to identify somewhere a set of core rules for each aac system. Like for example - what access methods are supported, what languages are supported, what symbols are supported, etc. This could be a set of rules that can be referenced by AACSystem - a different type altogether maybe? It could be in a JSON format maybe. (use case here being for a MCP).

### Contributing

Want to help with any of these items? See our [Contributing Guidelines](#-contributing) and pick an issue that interests you!

---

_Built with ❤️ for the AAC community_
