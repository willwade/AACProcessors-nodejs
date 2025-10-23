# Developer Scripts and Demos

This directory contains scripts and demos that demonstrate how to use the `aac-processors` library with the sample files in `/examples`. They are intended as quick starters for people exploring the project.

## Setup

```bash
# Install script-specific dependencies
npm install
```

## Available scripts

### Core Demos

#### `demo.js`
Comprehensive demo showcasing all supported AAC formats and processors.

```bash
node demo.js
```

Demonstrates:
- DOT format loading and text extraction
- OPML format processing
- Snap format (.spb) handling
- Grid3 gridset processing
- TouchChat (.ce) format
- OBF/OBZ format handling

#### `typescript-demo.ts`
TypeScript example demonstrating the modern TypeScript API.

```bash
npx ts-node typescript-demo.ts
```

Features:
- Auto-detection of processor by file extension
- TypeScript type safety
- Modern async/await patterns

#### `unified-interface-demo.ts`
Demonstrates the unified interface across all processors.

```bash
npx ts-node unified-interface-demo.ts
```

#### `wordlist-demo.ts` / `wordlist-demo.js`
Demonstrates Grid3 wordlist functionality.

```bash
npx ts-node wordlist-demo.ts
# or
node wordlist-demo.js
```

Features:
- Extract wordlists from existing gridsets
- Create wordlists from various input formats
- Update wordlists in gridsets

#### `styling-example.ts`
Demonstrates comprehensive styling support across formats.

```bash
npx ts-node styling-example.ts
```

Output saved to `../examples/styled-output/`

#### `image-map.js`
Demonstrates image handling in Grid3 gridsets.

```bash
node image-map.js
```

### Translation Demos

#### `translate_demo.js`
Comprehensive translation demo supporting multiple translation services.

```bash
export AZURE_TRANSLATOR_KEY="your-key"
export GOOGLE_TRANSLATE_KEY="your-key"
node translate_demo.js ../examples/example.gridset --endlang fr
```

#### `translate.js`
Simple text extraction and analysis tool.

```bash
node translate.js ../examples/example.ce
```

### Analysis Scripts

### `analysis/extract-vocabulary.js`
Generate a JSON and console summary of all vocabulary in a pageset.

```bash
npm run build
node scripts/analysis/extract-vocabulary.js examples/example.sps vocabulary.json
```

Sample output (excerpt):
```text
Top-level vocabulary sample:
  - -
  - -'s
  - -ed
  - -en
  - -er
  - -est
```

### `analysis/compare-vocabulary.js`
Compare the vocabulary used in two files and highlight overlaps and differences.

```bash
npm run build
node scripts/analysis/compare-vocabulary.js examples/example.sps examples/example2.grd
```

Sample output (excerpt):
```text
Shared vocabulary (3):
  - he
  - I
  - you
```

### `analysis/page-layout-to-markdown.js`
Render a page from a pageset as a Markdown table so you can see button positioning.

```bash
npm run build
node scripts/analysis/page-layout-to-markdown.js examples/example.sps "Food & Drink" layout.md
```

Sample output (excerpt):
```text
| **Home** | **breakfast** | **lunch** | **dinner** | **salad** | **soup** | **Breakfast Food** | **Lunch & Dinner** |   |   |
| **food** | **sandwich** | **pizza** | **bread** | **cheese** |   | **Vegetables** | **Fruit** |   |   |
```

### `coverage-analysis.js`
Summarise Jest coverage output. This is mainly for maintainers but remains available.

## Example data

AAC sample files live in `../examples/`. All scripts use these files for demonstration. Feel free to copy them into a temporary location if you want to experiment without changing the originals.

## Environment Variables

For translation demos:

```bash
# Azure Translator
export AZURE_TRANSLATOR_KEY="your-key"
export AZURE_TRANSLATOR_REGION="uksouth"  # optional

# Google Translate
export GOOGLE_TRANSLATE_KEY="your-key"

# Gemini API
export GEMINI_API_KEY="your-key"
```

## Contributing

If you add another script, keep it focused on demonstrating core library features and document a working example command using the repository assets.
