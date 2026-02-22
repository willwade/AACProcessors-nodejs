# LLM-Based Translation for AAC Files

This module provides shared utilities for translating AAC (Augmentative and Alternative Communication) files while preserving symbol-to-word associations across different formats.

## The Problem

When translating AAC files, symbols attached to words must remain with the correct translated words. This is challenging because:

1. **Word order changes** between languages (e.g., Spanish drops subject pronouns)
2. **Different grammatical structures** (e.g., French places adjectives after nouns)
3. **Multiple symbols** can be attached to a single utterance

### Example

```
English: "I want apple" with apple symbol on "apple"
Spanish: "Yo quiero manzana" with apple symbol on "manzana" (NOT "Yo" or "quiero")
```

## Solution: LLM-Based Translation

Instead of using positional word matching, we use LLMs (like Gemini 2.0 Flash or GPT-4) to:

1. Understand the meaning of words in both languages
2. Intelligently map symbols to the correct translated words
3. Handle grammatical differences automatically

## Architecture

### Shared Utilities (Format-Agnostic)

Located in `translationProcessor.ts`:

- `extractSymbolsFromButton()` - Extract symbols from any button format
- `extractAllButtonsForTranslation()` - Process all buttons in a file
- `createTranslationPrompt()` - Generate LLM prompt with instructions
- `validateTranslationResults()` - Ensure LLM response is valid
- `normalizeButtonForTranslation()` - Normalize button data

### Type Definitions

```typescript
interface SymbolInfo {
  text: string;              // Word/phrase symbol is attached to
  image?: string;            // Symbol reference (e.g., "[widgit]/food/apple.png")
  symbolLibrary?: string;    // Library name
  symbolPath?: string;       // Path within library
}

interface ButtonForTranslation {
  buttonId: string;          // Unique identifier
  pageId?: string;           // Optional page context
  pageName?: string;         // Optional page name
  label: string;             // Button label
  message: string;           // Button message
  textToTranslate: string;   // Text to translate (usually message)
  symbols: SymbolInfo[];     // Symbols attached to button
}

interface LLMLTranslationResult {
  buttonId: string;                    // Matching input buttonId
  translatedLabel?: string;            // Translated label
  translatedMessage?: string;          // Translated message
  symbols?: Array<{                    // Reattached symbols
    text: string;                      // Translated word to attach to
    image?: string;                    // Symbol reference (copied from input)
  }>;
}
```

## Usage Guide

### Step 1: Extract Buttons from Your Format

```typescript
import { extractAllButtonsForTranslation } from './translation/translationProcessor';

// For gridset format
async extractSymbolsForLLM(filePath): Promise<ButtonForTranslation[]> {
  const tree = await this.loadIntoTree(filePath);

  const allButtons: any[] = [];
  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((button) => {
      button.pageId = page.id;
      button.pageName = page.name || page.id;
      allButtons.push(button);
    });
  });

  return extractAllButtonsForTranslation(allButtons, (button) => ({
    pageId: button.pageId,
    pageName: button.pageName,
  }));
}
```

### Step 2: Create LLM Prompt

```typescript
import { createTranslationPrompt } from './translation/translationProcessor';

const buttons = processor.extractSymbolsForLLM('input.gridset');
const prompt = createTranslationPrompt(buttons, 'Spanish');
```

### Step 3: Call LLM API

```typescript
// Example with Gemini 2.0 Flash
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-goog-api-key': API_KEY,
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  })
});

const data = await response.json();
const translations = JSON.parse(data.candidates[0].content.parts[0].text);
```

### Step 4: Apply Translations

```typescript
import { validateTranslationResults } from './translation/translationProcessor';

processLLMTranslations(
  filePath: string | Buffer,
  llmTranslations: LLMLTranslationResult[],
  outputPath: string
): Promise<Buffer> {
  const tree = await this.loadIntoTree(filePath);

  // Validate using shared utility
  const buttonIds = Object.values(tree.pages).flatMap((page) =>
    page.buttons.map((b) => b.id)
  );
  validateTranslationResults(llmTranslations, buttonIds);

  // Apply translations (format-specific logic)
  const translationMap = new Map(llmTranslations.map((t) => [t.buttonId, t]));

  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((button) => {
      const translation = translationMap.get(button.id);
      if (!translation) return;

      if (translation.translatedLabel) {
        button.label = translation.translatedLabel;
      }

      if (translation.translatedMessage) {
        button.message = translation.translatedMessage;

        if (translation.symbols && translation.symbols.length > 0) {
          // Update rich text structure with symbols
          if (!button.semanticAction) {
            button.semanticAction = {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              text: translation.translatedMessage,
            };
          }

          button.semanticAction.richText = {
            text: translation.translatedMessage,
            symbols: translation.symbols,
          };
        }
      }
    });
  });

  // Save and return
  await this.saveFromTree(tree, outputPath);
  return fs.readFileSync(outputPath);
}
```

## Adding Support to Other Formats

### OBF (Open Board Format)

```typescript
// obfProcessor.ts
extractSymbolsForLLM(filePath: string | Buffer): ButtonForTranslation[] {
  const obf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const buttons = obf.buttons || [];

  return extractAllButtonsForTranslation(buttons, (button) => ({
    pageId: button.grid_id || button.pageId,
    pageName: '', // OBF doesn't always have page names
  }));
}
```

### Snap Core First

```typescript
// snapProcessor.ts
async extractSymbolsForLLM(filePath: string | Buffer): Promise<ButtonForTranslation[]> {
  const tree = await this.loadIntoTree(filePath);
  const allButtons: any[] = [];

  Object.values(tree.pages).forEach((page) => {
    page.buttons.forEach((button) => {
      button.pageId = page.id;
      button.pageName = page.name || page.id;
      allButtons.push(button);
    });
  });

  return extractAllButtonsForTranslation(allButtons, (button) => ({
    pageId: button.pageId,
    pageName: button.pageName,
  }));
}
```

## Supported Symbol Sources

The utilities automatically handle different ways symbols might be stored:

1. **semanticAction.richText.symbols** (gridset format)
2. **symbolLibrary + symbolPath** fields
3. **image field with `[library]path` format**

## Example: Complete Workflow

See `scripts/translation/gemini-translate-gridset.js` for a complete working example.

## Testing

Each format should have tests for:

1. Symbol extraction from buttons
2. Translation application
3. Symbol preservation across languages

See `test/symbolAlignment.test.ts` for comprehensive test examples.

## Benefits of This Approach

1. **Format-agnostic**: Shared utilities work across all AAC formats
2. **Intelligent**: LLM understands grammar, not just word position
3. **Maintainable**: Changes to translation logic only need to happen once
4. **Extensible**: Easy to add support for new formats
5. **Validated**: Built-in validation catches LLM errors early
