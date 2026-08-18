# AAC Vocabulary and Comparative Analysis

## Overview

The AAC metrics module now includes comprehensive vocabulary coverage analysis and comparative analysis between board sets. These features help clinicians and researchers evaluate how well an AAC board set covers core vocabulary and compare different board configurations.

## Features

### 1. Vocabulary Coverage Analysis

Analyzes how well a board set covers core vocabulary lists and identifies gaps.

**Key Features:**

- Coverage statistics for multiple core vocabulary lists
- Identification of missing core words
- High/low effort word analysis
- Extra vocabulary detection (words not in core lists)

**Usage:**

```typescript
import { ObfsetProcessor, Analytics } from "@willwade/aac-processors";

// Load board set
const processor = new ObfsetProcessor();
const tree = await processor.loadIntoTree("path/to/boardset.obfset");

// Calculate metrics
const metrics = new Analytics.MetricsCalculator().analyze(tree);

// Analyze vocabulary coverage
const vocabAnalyzer = new Analytics.VocabularyAnalyzer();
const analysis = await vocabAnalyzer.analyze(metrics);

console.log("Core Coverage:", analysis.core_coverage);
console.log("High Effort Words:", analysis.high_effort_words);
console.log("Low Effort Words:", analysis.low_effort_words);
```

**Output Structure:**

```typescript
{
  core_coverage: {
    'default': {
      name: 'Combined Core, Anderson & Bitner, 2013',
      total_words: 646,
      covered: 142,
      missing: 504,
      coverage_percent: 21.98,
      missing_words: ['more', 'i', 'you', ...],
      average_effort: 3.2456
    },
    // ... more core lists
  },
  total_unique_words: 2443,
  extra_words: [...],
  high_effort_words: [{ word: 'hello', effort: 8.5 }, ...],
  low_effort_words: [{ word: 'more', effort: 1.2 }, ...]
}
```

### 2. Sentence Construction Analysis

Calculates the effort required to construct test sentences from the board set.

**Key Features:**

- Tests 30 common sentences
- Identifies words requiring spelling (typing)
- Calculates average effort per word
- Statistics across all sentences

**Usage:**

```typescript
import { Analytics } from "@willwade/aac-processors";

const sentenceAnalyzer = new Analytics.SentenceAnalyzer();
const refLoader = new Analytics.ReferenceLoader();
const testSentences = refLoader.loadSentences();

const analyses = sentenceAnalyzer.analyzeSentences(metrics, testSentences);
const stats = sentenceAnalyzer.calculateStatistics(analyses);

console.log("Average effort:", stats.average_effort);
console.log("Typing percent:", stats.typing_percent);
```

**Output Structure:**

```typescript
[
  {
    sentence: "I like to be here with you",
    words: ["I", "like", "to", "be", "here", "with", "you"],
    effort: 3.45, // Average per word
    total_effort: 24.15, // Total for sentence
    typing: true, // Required spelling
    missing_words: ["I", "like", "to"],
    word_efforts: [
      { word: "I", effort: 12.5, typed: true },
      { word: "like", effort: 15.0, typed: true },
      // ...
    ],
  },
  // ... more sentences
];
```

### 3. Comparative Analysis

Compares two board sets to identify differences and generate CARE component scores.

**Key Features:**

- Missing/extra/overlapping word identification
- CARE component scoring (Core, sentences, fringe)
- High/low effort word comparison
- Core list coverage comparison
- Sentence construction comparison

**Usage:**

```typescript
import { Analytics } from "@willwade/aac-processors";

// Load two board sets
const targetResult = calculator.analyze(targetTree);
const compareResult = calculator.analyze(compareTree);

// Compare
const comparisonAnalyzer = new Analytics.ComparisonAnalyzer();
const comparison = await comparisonAnalyzer.compare(
  targetResult,
  compareResult,
  {
    includeSentences: true,
  },
);

console.log("Missing words:", comparison.missing_words);
console.log("CARE components:", comparison.care_components);
console.log("High effort words:", comparison.high_effort_words);
```

**Output Structure:**

```typescript
{
  // Target metrics
  total_boards: 212,
  total_words: 2443,
  target_effort_score: 6.5671,

  // Comparison metrics
  comp_boards: 480,
  comp_words: 4576,
  comp_effort_score: 5.4565,

  // Vocabulary comparison
  missing_words: ['word1', 'word2', ...],     // In comparison, not target
  extra_words: ['word3', 'word4', ...],        // In target, not comparison
  overlapping_words: ['word5', 'word6', ...],  // In both

  // CARE components
  care_components: {
    core: 142,              // Core words in target
    comp_core: 189,         // Core words in comparison
    sentences: 3.45,        // Avg sentence effort target
    comp_sentences: 2.98,   // Avg sentence effort comparison
    fringe: 89,             // Fringe words in target
    comp_fringe: 112,       // Fringe words in comparison
    common_fringe: 45,      // Fringe words in both
  },

  // High/low effort words
  high_effort_words: ['hello', 'goodbye', ...],  // Harder in target
  low_effort_words: ['more', 'want', ...],       // Easier in target

  // Core list analysis
  cores: {
    'default': {
      name: 'Combined Core, Anderson & Bitner, 2013',
      list: ['more', 'i', 'you', ...],
      average_effort: 3.24,
      comp_effort: 2.87
    }
  },

  // Sentence comparison
  sentences: [
    {
      sentence: 'I like to be here with you',
      effort: 3.45,
      typing: true,
      comp_effort: 2.98,
      comp_typing: false
    }
  ]
}
```

## Reference Data

The module includes reference vocabulary lists for English:

- **Core Lists**: Multiple core vocabulary definitions (Anderson & Bitner, Universal Core, UNC, etc.)
- **Common Words**: High-frequency words with baseline effort scores
- **Sentences**: 30 test sentences for construction analysis
- **Synonyms**: Word-to-synonym mappings
- **Fringe**: Extended vocabulary lists

Location: `src/optional/analytics/reference/data/`

## Testing

Run the test scripts to see the features in action:

```bash
# Vocabulary coverage analysis
npx ts-node test-vocabulary-analysis.ts

# Comparative analysis
npx ts-node test-comparison-analysis.ts
```

## Integration with Processors

All processors can now use these analysis features:

```typescript
import { ObfProcessor, Analytics } from "@willwade/aac-processors";

const processor = new ObfProcessor();
const tree = await processor.loadIntoTree("my-board.obf");

const metrics = new Analytics.MetricsCalculator().analyze(tree);

const vocabAnalyzer = new Analytics.VocabularyAnalyzer();
const coverage = await vocabAnalyzer.analyze(metrics);

// Identify gaps in core vocabulary
Object.entries(coverage.core_coverage).forEach(([id, data]) => {
  if (data.coverage_percent < 50) {
    console.log(
      `${data.name}: Only ${data.coverage_percent.toFixed(1)}% covered`,
    );
    console.log(`Missing: ${data.missing_words.slice(0, 10).join(", ")}`);
  }
});
```

## CLI Integration (Future)

These features will be integrated into the CLI:

```bash
# Analyze vocabulary coverage
aac-processors metrics my-boardset.obf --vocabulary

# Compare two board sets
aac-processors compare target.obfset comparison.obfset --output comparison.json

# Generate coverage report
aac-processors coverage my-boardset.obf --core-lists default,unc --format markdown
```

## Use Cases

1. **Clinical Evaluation**: Identify gaps in core vocabulary coverage for a client's board set
2. **Board Set Comparison**: Compare different configurations (e.g., before/after optimization)
3. **Research**: Analyze vocabulary coverage across different board sets or formats
4. **Quality Assurance**: Ensure board sets meet minimum coverage thresholds
5. **Optimization**: Identify high-effort words that could be repositioned for easier access

## Performance

- Vocabulary analysis: ~100ms for 2,400-word board set
- Sentence analysis: ~50ms for 30 sentences
- Comparative analysis: ~200ms for comparing two 2,000+ word sets

## Files

- `src/optional/analytics/metrics/vocabulary.ts` - Vocabulary coverage analysis
- `src/optional/analytics/metrics/sentence.ts` - Sentence construction analysis
- `src/optional/analytics/metrics/comparison.ts` - Comparative analysis
- `src/optional/analytics/reference/index.ts` - Reference data loader
- `test-vocabulary-analysis.ts` - Vocabulary analysis demo
- `test-comparison-analysis.ts` - Comparative analysis demo

## Vocabulary Dump (counts-only)

For longitudinal metrics work (e.g. the Grid 3 competence reports), you also
want to know **how much vocabulary the user has available** — including the
wordlists and prediction dictionaries embedded in the grid, which button-label
counts alone miss. `dumpVocabulary()` inventories every vocabulary source and
returns counts only (never word lists), with a per-source part-of-speech
breakdown, so it is safe to embed in privacy-preserving reports.

**Sources counted:**

| Source                  | What it is                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| `buttons`               | Labelled buttons (the static on-board vocabulary)                           |
| `wordLists`             | Grid 3 page WordLists feeding dynamic AutoContent cells (`<WordList>`)      |
| `predictionDictionaries`| Grid 3 prediction wordlists (`Prediction.PredictThis`) on prediction cells  |
| `wordForms`             | Smart-grammar inflections generated by `MetricsCalculator` (needs metrics)  |

**Usage:**

```typescript
import { GridsetProcessor } from '@willwade/aac-processors/gridset';
import { MetricsCalculator, dumpVocabulary } from '@willwade/aac-processors/metrics';

const processor = new GridsetProcessor();
const tree = await processor.loadIntoTree('my.gridset');
// analyze() BEFORE dumping: it expands morphological predictions on the tree.
const metrics = new MetricsCalculator().analyze(tree);
const dump = dumpVocabulary(tree, { metrics });

console.log(dump.summary.wordLists.lists, 'wordlists');
console.log(dump.summary.wordLists.entries, 'wordlist words');
console.log(dump.summary.predictionDictionaries.entries, 'dictionary words');
console.log(dump.summary.wordForms?.entries ?? 0, 'smart-grammar inflections');
console.log(dump.summary.combined.uniqueEntries, 'unique entries overall');
```

**Output structure (counts only, no words):**

```typescript
{
  schema: 'aac-vocabulary-dump/v1',
  generatedAt: '2026-08-18T...',
  source: { format: 'gridset', name: '...', locale: 'en-GB' },
  summary: {
    totalBoards: 38,
    totalButtons: 1147,
    buttons:              { entries, uniqueWords, uniquePhrases, byPartOfSpeech },
    wordLists:            { entries, uniqueWords, uniquePhrases, byPartOfSpeech, lists: 19 },
    predictionDictionaries: { entries, ..., byPartOfSpeech, buttonsWithDictionaries },
    wordForms:            { entries, ..., byPartOfSpeech, parentButtons } | null,
    combined: { uniqueEntries, uniqueWords, uniquePhrases },
  },
}
```

Notes:

- Entries are normalised (lowercased, whitespace-collapsed); multi-word
  entries ("thank you") are counted as phrases, not words.
- Word-form counts exclude the original dictionary words the inflections were
  generated from (no double counting); `parameters.predictions` keeps the
  originals even after `analyze()` rewrites `button.predictions`.
- Non-Grid 3 formats simply report zeros for the Grid 3-specific sources.

**CLI:**

```bash
# Counts-only vocabulary inventory as JSON
aac-processors vocabulary my.gridset --out vocabulary.json
```

The same summary is attached as `pageset.vocabulary` in the Grid 3 competence
report (`PagesetSummary.vocabulary`), and rendered in the exporter dashboard.

## Morphological Vocabulary Coverage

### Problem

Standard vocabulary coverage analysis only checks exact button label matches. For Grid 3 users, morphological inflections like "going", "went", "things", "books" are one tap away from their base form but reported as missing.

### Solution

`hasWord()` now checks both direct button labels AND smart grammar word forms:

```typescript
const analyzer = new VocabularyAnalyzer();
analyzer.hasWord("went", metrics); // true — found as inflection of "go"
analyzer.hasWord("books", metrics); // true — found as plural of "book"
```

This is auto-detected: only Grid 3 gridsets have POS tags, so for other formats the check degrades gracefully to exact-match only.

### Impact

In children's shared-reading transcript analysis against Super Core 50:

- **Regular inflections** move from "missing" to "smart_grammar": going/go, things/thing, books/book, flying/fly, watching/watch
- **Irregular forms** need the irregular table: went/go, got/get, came/come
- Words where the base itself is missing remain genuinely missing

### Cross-platform morphology

Different AAC platforms handle morphology differently:

| Platform                | Approach                                      | POS data                                       |
| ----------------------- | --------------------------------------------- | ---------------------------------------------- |
| **Grid 3**              | Runtime POS-based inflection from `verbs.zip` | `pos` parameter on buttons                     |
| **AsTeRICS Grid**       | Per-element tagged word forms                 | `{value, tags[], lang}` stored on each element |
| **TD Snap / TouchChat** | Static buttons (no morphology)                | None                                           |

The `WordFormGenerator` bridges these approaches, enabling cross-format conversion with morphology preserved. For future work, AsTeRICS Grid's tag-based approach could enable direct word-form lookups in vocabulary coverage analysis for `.grd` files.
