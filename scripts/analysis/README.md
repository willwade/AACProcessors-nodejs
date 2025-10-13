# Analysis Scripts

All scripts in this folder share the same prerequisites:

1. Run `npm install` (once).
2. Build the library so the compiled files in `dist/` are available: `npm run build`.

They only depend on the open-source sample files stored in `/examples` and `scripts/examples`.

## Commands

### Extract vocabulary
```
node scripts/analysis/extract-vocabulary.js <inputFile> [output.json]
```
- Prints overall vocabulary counts and a per-page breakdown.
- Optionally saves a JSON report if an output path is provided.

Sample output (excerpt):
```text
Top-level vocabulary sample:
  - -
  - -'s
  - -ed
  - -en
  - -er
  - -est
  - -ing
  - -ion
  - -ly
  - -s
  - -self
  - ,

Vocabulary by page:

## Accessories (21 terms, 21 buttons)
  - accessory
  - barrette
  - belt
  - bracelet
  - contact lens
```

### Compare vocabulary
```
node scripts/analysis/compare-vocabulary.js <leftFile> <rightFile>
```
- Reports shared terms plus vocabulary unique to each file.
- Defaults to `examples/example.sps` vs `examples/example2.grd` when no paths are given.

Sample output (excerpt):
```text
Comparing vocabulary between:
 - /workspace/AACProcessors-nodejs/examples/example.sps
 - /workspace/AACProcessors-nodejs/examples/example2.grd

3673 unique terms in first file.
20 unique terms in second file.

Shared vocabulary (3):
  - he
  - I
  - you
```

### Page layout to Markdown
```
node scripts/analysis/page-layout-to-markdown.js <inputFile> [pageNameOrId] [output.md]
```
- Renders the specified page as a Markdown table so you can see button placement.
- If you omit the page identifier the root page is used.
- Provide an output path to save the Markdown instead of only printing to the console.

Sample output (excerpt):
```text
# Food & Drink

| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 | Col 9 | Col 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Home** | **breakfast** | **lunch** | **dinner** | **salad** | **soup** | **Breakfast Food** | **Lunch & Dinner** |   |   |
| **food** | **sandwich** | **pizza** | **bread** | **cheese** |   | **Vegetables** | **Fruit** |   |   |
| **water** | **milk** | **juice** |   |   |   | **Snacks & Sweets** | **Eating Out** |   |   |
```
