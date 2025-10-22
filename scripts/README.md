# Developer Scripts

This directory contains small, documented scripts that demonstrate how to use the `aac-processors` library with the sample files in `/examples`. They are intended as quick starters for people exploring the project – every script runs against the checked-in demo assets and avoids external API keys.

## Available scripts

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

Additional AAC sample files live in `scripts/examples/` and `examples/`. The analysis scripts accept any of these files – feel free to copy them into a temporary location if you want to experiment without changing the originals.

## Contributing

If you add another script, keep it focused on demonstrating core library features and document a working example command using the repository assets.
