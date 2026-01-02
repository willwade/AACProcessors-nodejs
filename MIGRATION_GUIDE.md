# API Reorganization Migration Guide

## What Changed?

The AACProcessors library has been reorganized with a cleaner, more consistent API structure. **Platform-specific utilities are now properly namespaced** instead of polluting the top-level exports.

## New Structure

### ✅ What's at the Top Level (Clean & Minimal)
```typescript
// Core types (always needed)
import { AACTree, AACButton, AACPage } from 'aac-processors';

// Processor classes
import { GridsetProcessor, SnapProcessor, ObfProcessor } from 'aac-processors';

// Utility functions
import { getProcessor, getSupportedExtensions } from 'aac-processors';

// Validation
import { validateFile } from 'aac-processors';
```

### ✅ What's Namespaced (Platform-Specific)
```typescript
// Grid 3 / Gridset utilities
import { Gridset } from 'aac-processors/gridset';

// Snap utilities
import { Snap } from 'aac-processors/snap';

// Analytics & Metrics
import { Analytics } from 'aac-processors';

// Translation
import { Translation } from 'aac-processors/translation';
```

## Migration Examples

### Before (Old API - Messy)
```typescript
import {
  readGrid3History,           // Top level? Why?
  findGrid3Users,             // Pollutes global namespace
  getPageTokenImageMap,       // Which platform???
  rgbaToHex,                  // Implementation detail leaked!
  MetricsCalculator,          // Under Analytics namespace...
  collectUnifiedHistory      // Also at top level, duplicates Analytics
} from 'aac-processors';
```

### After (New API - Clean)
```typescript
// Import only what you need, properly organized
import { GridsetProcessor } from 'aac-processors';
import { Gridset } from 'aac-processors/gridset';
import { Analytics } from 'aac-processors';

// Clear where each function comes from
const history = Gridset.readGrid3History(...);
const users = Gridset.findGrid3Users(...);
const colors = Gridset.rgbaToHex(...);
const metrics = new Analytics.MetricsCalculator(...);
```

## Specific Changes by Category

### History & User Management

#### Before:
```typescript
import {
  readGrid3History,
  readSnapUsage,
  collectUnifiedHistory,
  listHistoryGrid3Users,
  listHistorySnapUsers
} from 'aac-processors';

// Wait, where did these come from? Which platform?
const gridHistory = readGrid3History(...);
const snapUsage = readSnapUsage(...);
```

#### After:
```typescript
import { Gridset } from 'aac-processors/gridset';
import { Snap } from 'aac-processors/snap';
import { Analytics } from 'aac-processors';

// Now it's clear which platform each function belongs to
const gridHistory = Gridset.readGrid3History(...);
const snapUsage = Snap.readSnapUsage(...);
const unified = Analytics.collectUnifiedHistory(...);
```

### Color Utilities

#### Before:
```typescript
import { rgbaToHex, darkenColor, normalizeColor } from 'aac-processors';
// Why are Grid 3 color utilities at top level?
```

#### After:
```typescript
import { Gridset } from 'aac-processors/gridset';

const hex = Gridset.rgbaToHex(...);
const darkened = Gridset.darkenColor(...);
```

### Symbol Libraries

#### Before:
```typescript
import {
  parseSymbolReference,
  getAvailableSymbolLibraries,
  resolveSymbolReference
} from 'aac-processors';
// Are these Grid 3 specific? Or universal? Unclear!
```

#### After:
```typescript
import { Gridset } from 'aac-processors/gridset';

const ref = Gridset.parseSymbolReference(...);
const libs = Gridset.getAvailableSymbolLibraries(...);
```

### Analytics & Metrics

#### Before:
```typescript
import {
  MetricsCalculator,
  VocabularyAnalyzer,
  collectUnifiedHistory  // Duplicate! This is in Analytics.*
} from 'aac-processors';

const calc = new MetricsCalculator(...);
```

#### After:
```typescript
import { Analytics } from 'aac-processors';

const calc = new Analytics.MetricsCalculator(...);
const analyzer = new Analytics.VocabularyAnalyzer(...);
```

## Complete Example: Grid 3 App

### Before (Old)
```typescript
import {
  GridsetProcessor,
  readGrid3History,
  findGrid3Users,
  getPageTokenImageMap,
  resolveGridsetPassword,
  MetricsCalculator,
  rgbaToHex,
  collectUnifiedHistory
} from 'aac-processors';

// Mixed together - unclear what comes from where
const processor = new GridsetProcessor();
const history = readGrid3History(...);
const users = findGrid3Users(...);
const colors = rgbaToHex(...);
const metrics = new MetricsCalculator(...);
```

### After (New)
```typescript
import { GridsetProcessor, Analytics } from 'aac-processors';
import { Gridset } from 'aac-processors/gridset';

// Clear separation of concerns
const processor = new GridsetProcessor();
const history = Gridset.readGrid3History(...);
const users = Gridset.findGrid3Users(...);
const colors = Gridset.rgbaToHex(...);
const metrics = new Analytics.MetricsCalculator(...);
```

## Complete Example: Multi-Platform App

```typescript
import { getProcessor } from 'aac-processors';
import { Gridset } from 'aac-processors/gridset';
import { Snap } from 'aac-processors/snap';
import { Analytics } from 'aac-processors';

// Get the right processor
const processor = getProcessor('vocab.gridset');

// Use platform-specific utilities with clear namespaces
if (processor instanceof GridsetProcessor) {
  const gridHistory = Gridset.readGrid3History(...);
  const users = Gridset.findGrid3Users(...);
}

if (processor instanceof SnapProcessor) {
  const snapHistory = Snap.readSnapUsage(...);
  const users = Snap.findSnapUsers(...);
}

// Analytics works across platforms
const metrics = new Analytics.MetricsCalculator(...);
```

## Benefits of the New Structure

1. **✅ Cleaner autocomplete** - Less pollution in suggestions
2. **✅ Clearer organization** - Know which platform utilities come from
3. **✅ Smaller bundle sizes** - Tree-shaking works better with namespaces
4. **✅ Better documentation** - Easier to find what you need
5. **✅ Future-proof** - Easy to add new platforms without conflicts
6. **✅ Consistent** - All platforms follow the same pattern

## Namespace Reference

| Namespace | Contains | Import Path |
|-----------|----------|-------------|
| **Analytics** | MetricsCalculator, VocabularyAnalyzer, history | `import { Analytics } from 'aac-processors'` |
| **Gridset** | All Grid 3/Gridset helpers (history, users, symbols, colors, etc.) | `import { Gridset } from 'aac-processors/gridset'` |
| **Snap** | All Snap helpers (history, users, packages) | `import { Snap } from 'aac-processors/snap'` |
| **TouchChat** | TouchChat helpers | `import { TouchChat } from 'aac-processors/touchchat'` |
| **OBF** | OBF/OBZ utilities | `import { OBF } from 'aac-processors/obf'` |
| **Translation** | LLM translation utilities | `import { Translation } from 'aac-processors/translation'` |

## Need Help?

If you're unsure where a function moved:
1. Check the namespace tables above
2. Look at the TypeScript autocomplete - it's now organized by namespace
3. Check the [README](./README.md) for updated examples
4. See [src/gridset.ts](./src/gridset.ts), [src/snap.ts](./src/snap.ts), etc. for complete exports

## Breaking Changes

This is a **breaking change** for imports, but:
- ✅ All functionality still exists
- ✅ Just better organized
- ✅ Use find/replace with the table above to migrate quickly
- ✅ TypeScript will show you exactly what needs fixing
