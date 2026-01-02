# AACProcessors

[![Coverage](https://img.shields.io/badge/coverage-74%25-green.svg)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-495%20tests-brightgreen.svg)](./test)
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
- **Apple Panels** (MacOS) - Plist format support
- **Asterics Grid** - Native Asterics Grid format with audio
- **Excel** - Export to Microsoft Excel for vocabulary analysis
- **Analyics & Metrics** - High-parity AAC effort metrics and clinical analysis tools

### **Advanced Capabilities**

- 🔄 **Cross-format conversion** - Convert between any supported formats
- 🌍 **Translation workflows** - Built-in i18n support with `processTexts()`
- 🎨 **Comprehensive styling support** - Preserve visual appearance across formats
- 🧪 **Property-based testing** - Robust validation with 140+ tests
- ✅ **Format validation** - Spec-based validation for all supported formats
- 📊 **Clinical Metrics** - High-parity AAC effort algorithm (v0.2) and vocabulary coverage analysis
- ⚡ **Performance optimized** - Memory-efficient processing of large files
- 🛡️ **Error recovery** - Graceful handling of corrupted data
- 🔒 **Thread-safe** - Concurrent processing support
- 📊 **Comprehensive logging** - Detailed operation insights

---

## 📦 Installation

### From npm (Recommended)

```bash
npm install @willwade/aac-processors
```

### From Source

```bash
git clone https://github.com/willwade/AACProcessors-nodejs.git
cd AACProcessors-nodejs
npm install
npm run build
```

### Requirements

- **Node.js** 20.0.0 or higher
- **TypeScript** 5.5+ (for development)

---

## Using with Electron

`better-sqlite3` is a native module and must be rebuilt against Electron's Node.js runtime. If you see a `NODE_MODULE_VERSION` mismatch error, rebuild after installing dependencies:

```bash
npm install
npx electron-rebuild
```

Or add a postinstall hook so the rebuild happens automatically:

```json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps"
  }
}
```

This step is only required for Electron apps; regular Node.js consumers do not need it.

---

## Windows Data Paths

- **Grid 3 history**: `C:\Users\Public\Documents\Smartbox\Grid 3\Users\{username}\{langCode}\Phrases\history.sqlite`
- **Grid 3 vocabularies**: `C:\Users\Public\Documents\Smartbox\Grid 3\Users\{username}\Grid Sets\`
- **Snap vocabularies**: `C:\Users\{username}\AppData\Roaming\Tobii Dynavox\Snap Scene\Users\{userId}\` (`.sps`/`.spb`)

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

### Button Filtering System

AACProcessors includes an intelligent filtering system to handle navigation bars and system buttons that are common in AAC applications but may not be appropriate when converting between formats.

#### **Default Behavior**

By default, the following buttons are filtered out during conversion:

- **Navigation buttons**: Home, Back (toolbar navigation)
- **System buttons**: Delete, Clear, Copy (text editing functions)
- **Label-based filtering**: Buttons with common navigation terms

#### **Configuration Options**

```typescript
import { GridsetProcessor } from "aac-processors";

// Default: exclude navigation/system buttons (recommended)
const processor = new GridsetProcessor();

// Preserve all buttons (legacy behavior)
const processor = new GridsetProcessor({ preserveAllButtons: true });

// Custom filtering
const processor = new GridsetProcessor({
  excludeNavigationButtons: true,
  excludeSystemButtons: false,
  customButtonFilter: (button) => !button.label.includes("Settings"),
});
```

#### **Why Filter Buttons?**

- **Cleaner conversions**: Navigation bars don't clutter converted vocabularies
- **Format-appropriate**: Each AAC app handles navigation/system functions in their own UI
- **Semantic-aware**: Uses proper semantic action detection, not just label matching

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

### 🤖 LLM-Based Translation with Symbol Preservation

For advanced AI-powered translation that preserves symbol-to-word associations across languages, see the **[Translation Utilities Guide](./src/utilities/translation/README.md)**.

**Features:**
- 🧠 **Intelligent symbol mapping**: LLMs understand grammar, not just word position
- 🎯 **Cross-format support**: Works with Gridset, OBF/OBZ, TouchChat, and Snap
- 🔗 **Symbol preservation**: Symbols stay attached to correct translated words
- ✅ **Validated output**: Built-in validation catches translation errors

**Quick Demo:**
```bash
# Translate a Grid 3 file to Spanish using Gemini 2.0 Flash
export GEMINI_API_KEY="your-key-here"
node scripts/translation/gemini-translate-gridset.js "./tmp/Voco Chat.gridset" Spanish
```

**Complete Example:**
```typescript
import { GridsetProcessor } from "@willwade/aac-processors";

const processor = new GridsetProcessor();

// 1. Extract buttons with symbol information
const buttons = processor.extractSymbolsForLLM("board.gridset");

// 2. Create LLM prompt (or call your LLM API directly)
// See: src/utilities/translation/README.md

// 3. Apply translations with preserved symbols
processor.processLLMTranslations(
  "board.gridset",
  llmTranslations,
  "board-spanish.gridset"
);
```

See **[scripts/translation/](./scripts/translation/)** for complete working examples with Gemini, GPT-4, and other LLMs.

### 📊 AAC Analytics & Clinical Metrics

The library includes an optional high-performance analytics engine for evaluating AAC board sets based on the **AAC Effort Algorithm (v0.2)**.

#### **Key Metrics Features**

- **Effort Scores**: Calculate the physical/cognitive cost of any word (Distance, Field Size, Motor Planning).
- **Vocabulary Coverage**: Compare board sets against core vocabulary lists (e.g., Anderson & Bitner).
- **Sentence Analysis**: Measure the effort required to construct common test sentences.
- **Comparative Analysis**: Identify gaps and improvements between two pageset versions.

For detailed documentation, see the **[AAC Metrics Guide](./src/utilities/analytics/docs/AAC_METRICS_GUIDE.md)** and **[Vocabulary Analysis Guide](./src/utilities/analytics/docs/VOCABULARY_ANALYSIS_GUIDE.md)**.

```typescript
import { ObfsetProcessor, Analytics } from "@willwade/aac-processors";

const processor = new ObfsetProcessor();
const tree = processor.loadIntoTree("my_pageset.obfset");

// Run clinical effort analysis
const result = new Analytics.MetricsCalculator().analyze(tree);
console.log(`Average Effort: ${result.total_words}`);
```

### Format Validation

Validate AAC files against format specifications to ensure data integrity:

```typescript
import { ObfProcessor, GridsetProcessor } from "aac-processors";

// Validate OBF/OBZ files
const obfProcessor = new ObfProcessor();
const result = await obfProcessor.validate("board.obf");

console.log(`Valid: ${result.valid}`);
console.log(`Errors: ${result.errors}`);
console.log(`Warnings: ${result.warnings}`);

// Detailed validation results
if (!result.valid) {
  result.results
    .filter((check) => !check.valid)
    .forEach((check) => {
      console.log(`✗ ${check.description}: ${check.error}`);
    });
}

// Validate Gridset files (with optional password for encrypted files)
const gridsetProcessor = new GridsetProcessor({
  gridsetPassword: "optional-password",
});
const gridsetResult = await gridsetProcessor.validate("vocab.gridsetx");
```

#### Using the CLI

```bash
# Validate a file
aacprocessors validate board.obf

# JSON output
aacprocessors validate board.obf --json

# Quiet mode (just valid/invalid)
aacprocessors validate board.gridset --quiet

# Validate encrypted Gridset file
aacprocessors validate board.gridsetx --gridset-password <password>
```

#### What Gets Validated?

- **OBF/OBZ**: Spec compliance (Open Board Format)
  - Required fields (format, id, locale, buttons, grid, images, sounds)
  - Grid structure (rows, columns, order)
  - Button references (image_id, sound_id, load_board paths)
  - Color formats (RGB/RGBA)
  - Cross-reference validation

- **Gridset**: XML structure
  - Required elements (gridset, pages, cells)
  - FixedCellSize configuration
  - Page and cell attributes
  - Image references

- **Snap**: Package structure
  - ZIP package validity
  - Settings file format
  - Page/button configurations

- **TouchChat**: XML structure
  - PageSet hierarchy
  - Button definitions
  - Navigation links

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

#### Excel Export for Vocabulary Analysis

```typescript
import { ExcelProcessor, getProcessor } from "aac-processors";

// Convert any AAC format to Excel for analysis
const sourceProcessor = getProcessor("communication-board.gridset");
const tree = sourceProcessor.loadIntoTree("communication-board.gridset");

// Export to Excel with visual styling and navigation
const excelProcessor = new ExcelProcessor();
excelProcessor.saveFromTree(tree, "vocabulary-analysis.xlsx");

// Each AAC page becomes an Excel worksheet tab
// Buttons are represented as cells with:
// - Cell value = button label
// - Cell background = button background color
// - Cell font color = button font color
// - Cell comments = button message/vocalization
// - Hyperlinks for navigation between worksheets

// Optional: Navigation row with standard AAC buttons
// (Home, Message Bar, Delete, Back, Clear) appears on each worksheet
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

### Styling Support

The library now provides comprehensive styling support across all AAC formats, preserving visual appearance when converting between formats.

#### Supported Styling Properties

```typescript
interface AACStyle {
  backgroundColor?: string; // Button/page background color
  fontColor?: string; // Text color
  borderColor?: string; // Border color
  borderWidth?: number; // Border thickness
  fontSize?: number; // Font size in pixels
  fontFamily?: string; // Font family name
  fontWeight?: string; // "normal" | "bold"
  fontStyle?: string; // "normal" | "italic"
  textUnderline?: boolean; // Text underline
  labelOnTop?: boolean; // Label position (TouchChat)
  transparent?: boolean; // Transparent background
}
```

#### Creating Styled AAC Content

```typescript
import { AACTree, AACPage, AACButton } from "aac-processors";

// Create a page with styling
const page = new AACPage({
  id: "main-page",
  name: "Main Communication Board",
  grid: [],
  buttons: [],
  parentId: null,
  style: {
    backgroundColor: "#f0f8ff",
    fontFamily: "Arial",
    fontSize: 16,
  },
});

// Create buttons with comprehensive styling
const speakButton = new AACButton({
  id: "speak-btn-1",
  label: "Hello",
  message: "Hello, how are you?",
  type: "SPEAK",
  action: null,
  style: {
    backgroundColor: "#4CAF50",
    fontColor: "#ffffff",
    borderColor: "#45a049",
    borderWidth: 2,
    fontSize: 18,
    fontFamily: "Helvetica",
    fontWeight: "bold",
    labelOnTop: true,
  },
});

const navButton = new AACButton({
  id: "nav-btn-1",
  label: "More",
  message: "Navigate to more options",
  type: "NAVIGATE",
  targetPageId: "more-page",
  action: {
    type: "NAVIGATE",
    targetPageId: "more-page",
  },
  style: {
    backgroundColor: "#2196F3",
    fontColor: "#ffffff",
    borderColor: "#1976D2",
    borderWidth: 1,
    fontSize: 16,
    fontStyle: "italic",
    transparent: false,
  },
});

page.addButton(speakButton);
page.addButton(navButton);

const tree = new AACTree();
tree.addPage(page);

// Save with styling preserved
import { SnapProcessor } from "aac-processors";
const processor = new SnapProcessor();
processor.saveFromTree(tree, "styled-board.spb");
```

#### Format-Specific Styling Support

| Format            | Background | Font         | Border  | Advanced                        |
| ----------------- | ---------- | ------------ | ------- | ------------------------------- |
| **Snap/SPS**      | ✅ Full    | ✅ Full      | ✅ Full | ✅ All properties               |
| **TouchChat**     | ✅ Full    | ✅ Full      | ✅ Full | ✅ Label position, transparency |
| **OBF/OBZ**       | ✅ Yes     | ❌ No        | ✅ Yes  | ❌ Basic only                   |
| **Grid3**         | ✅ Yes     | ✅ Yes       | ✅ Yes  | ✅ Style references             |
| **Asterics Grid** | ✅ Yes     | ✅ Yes       | ✅ Yes  | ✅ Metadata-based               |
| **Apple Panels**  | ✅ Yes     | ✅ Size only | ❌ No   | ✅ Display weight               |
| **Dot**           | ❌No       | ❌ Yes       | ❌ No   | ❌ Basic only                   |
| **OPML**          | ❌No       | ❌ Yes       | ❌ No   | ❌ Basic only                   |
| **Excel**         | ✅ Yes     | ✅ Size only | ❌ No   | ✅ Display weight               |

#### Cross-Format Styling Conversion

```typescript
import { getProcessor } from "aac-processors";

// Load styled content from TouchChat
const touchChatProcessor = getProcessor("input.ce");
const styledTree = touchChatProcessor.loadIntoTree("input.ce");

// Convert to Snap format while preserving styling
const snapProcessor = getProcessor("output.spb");
snapProcessor.saveFromTree(styledTree, "output.spb");

// Styling information is automatically mapped between formats
console.log("Styling preserved across formats!");
```

### CLI Usage

The CLI provides three main commands for working with AAC files:

#### **Extract Text Content**

```bash
# Extract all text from an AAC file
npx aac-processors extract examples/example.dot

# With format specification and verbose output
npx aac-processors extract examples/example.sps --format snap --verbose
```

#### **Convert Between Formats**

```bash
# Convert from one format to another (format auto-detected from input extension)
npx aac-processors convert input.sps output.obf --format obf

# Convert TouchChat to Snap format
npx aac-processors convert communication.ce backup.spb --format snap

# Convert any AAC format to Excel for vocabulary analysis
npx aac-processors convert input.gridset vocabulary-analysis.xlsx --format xlsx

# Convert with button filtering options
npx aac-processors convert input.gridset output.grd --format grd --preserve-all-buttons
npx aac-processors convert input.ce output.spb --format snap --exclude-buttons "settings,menu"
npx aac-processors convert input.obf output.gridset --format gridset --no-exclude-system
```

#### **Analyze File Structure**

```bash
# Get detailed file information in JSON format
npx aac-processors analyze examples/example.ce

# Get human-readable file information
npx aac-processors analyze examples/example.gridset --pretty
```

#### **Available Options**

**General Options:**

- `--format <format>` - Specify format type (auto-detected if not provided)
- `--pretty` - Human-readable output (analyze command)
- `--verbose` - Detailed output (extract command)
- `--quiet` - Minimal output (extract command)
- `--gridset-password <password>` - Password for encrypted Grid 3 archives (`.gridsetx`)

**Button Filtering Options:**

- `--preserve-all-buttons` - Preserve all buttons including navigation/system buttons
- `--no-exclude-navigation` - Don't exclude navigation buttons (Home, Back)
- `--no-exclude-system` - Don't exclude system buttons (Delete, Clear, etc.)
- `--exclude-buttons <list>` - Comma-separated list of button labels/terms to exclude

**Examples:**

```bash
# Extract text with all buttons preserved
npx aac-processors extract input.ce --preserve-all-buttons --verbose

# Convert excluding only custom buttons
npx aac-processors convert input.gridset output.grd --format grd --exclude-buttons "settings,help,menu"

# Analyze with navigation buttons excluded but system buttons preserved
npx aac-processors analyze input.spb --no-exclude-system --pretty
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

| Processor               | File Extensions         | Description                   |
| ----------------------- | ----------------------- | ----------------------------- |
| `DotProcessor`          | `.dot`                  | Graphviz DOT format           |
| `OpmlProcessor`         | `.opml`                 | OPML hierarchical format      |
| `ObfProcessor`          | `.obf`, `.obz`          | Open Board Format (JSON/ZIP)  |
| `SnapProcessor`         | `.sps`, `.spb`          | Tobii Dynavox Snap format     |
| `GridsetProcessor`      | `.gridset`, `.gridsetx` | Smartbox Grid 3 format        |
| `TouchChatProcessor`    | `.ce`                   | PRC-Saltillo TouchChat format |
| `ApplePanelsProcessor`  | `.plist`                | iOS Apple Panels format       |
| `AstericsGridProcessor` | `.grd`                  | Asterics Grid native format   |
| `ExcelProcessor`        | `.xlsx`                 | Microsoft Excel format        |

---

## 🧪 Testing & Quality

This library maintains **65% test coverage** with **111 comprehensive tests** including:

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

### 🛠️ Utility Scripts

A wide range of utility scripts for batch processing, audio generation, and advanced analysis are available in the **[scripts/](./scripts/README.md)** directory. These include:

- **Analysis**: Pageset reporting and vocabulary extraction.
- **Audio**: Automated TTS generation and audio-enhanced pageset creation.
- **Conversion**: TSV-to-Gridset and other format-shifting tools.
- **Translation**: Batch translation workflows using Google, Azure, and Gemini.

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

We welcome contributions! Please read our [Contributor License Agreement (CLA)](CLA.md) before you get started.

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

### Environment Variables

- Copy the template: `cp .envrc.example .envrc`
- Fill in your own API keys locally; `.envrc` is ignored to prevent accidental commits
- If you rotate keys, update only your local `.envrc`—never commit real secrets

### Publishing to npm

- The repository keeps `package.json` at `0.0.0-development`; release tags control the published version.
- Create a GitHub release with a semantic tag (e.g. `v2.1.0`). Publishing only runs for non-prerelease tags.
- The workflow (`.github/workflows/publish.yml`) automatically installs dependencies, rewrites the package version from the tag, and runs the standard publish pipeline.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

Created by **Will Wade** and contributors.

Inspired by the Python AACProcessors project

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

### 🔥 Critical Priority (Immediate Action Required)

- [ ] **Road Testing** - Perform comprehensive layout and formatting validation across diverse pagesets to verify conversion fidelity.
- [ ] **Fix audio persistence issues** - Resolve functional audio recording persistence in `SnapProcessor` save/load cycle (5 failing tests remaining).
- [x] **Access Method Modeling** - Support for switch scanning (linear, row-column, block) integrated into AAC metrics.

### 🚨 High Priority (Next Sprint)

- [ ] **Complete SnapProcessor coverage** (currently ~60%) - Reach >75% coverage by adding comprehensive audio handling and database corruption tests.
- [ ] **Symbol System Rethink** - Explore treating "Symbols" as a first-class entity (alongside Pages/Buttons) to support richer metadata (library IDs, synonyms, multi-lang names).
- [ ] **Language & Locale Persistence** - Ensure current language and locale information is correctly preserved and bubbled up to the `AACTree` level.

### ⚠️ Medium Priority

- [ ] **Adaptive Metrics** - Expand scanning analysis to include dwell times and more complex switch logic configurations.

### Low Priority

- [ ] **Batch processing CLI** - Process multiple files/directories in parallel.

### Contributing

Want to help with any of these items? See our [Contributing Guidelines](#-contributing) and pick an issue that interests you!
