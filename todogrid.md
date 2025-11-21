
### 1. **GUID Generation** (Priority: HIGH)

**Current location:** `grid-generator/src/gridsetGenerator.ts` (lines 335-341)

**Recommendation:** Add to `aac-processors/src/processors/gridset/helpers.ts`

```typescript
/**
 * Generate a random GUID for Grid3 elements
 * Grid3 uses GUIDs for grid identification
 */
export function generateGrid3Guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

**Rationale:** Every Grid3 grid needs a unique GUID. This is fundamental Grid3 infrastructure.

---

### 2. **Settings XML Builder** (Priority: HIGH)

**Current location:** `grid-generator/src/gridsetGenerator.ts` (lines 126-141)

**Recommendation:** Add to `aac-processors/src/processors/gridset/helpers.ts`

```typescript
/**
 * Create Grid3 settings XML with start grid and common settings
 * @param startGrid - Name of the grid to start on
 * @param options - Optional settings (scan, hover, language, etc.)
 */
export function createSettingsXml(
  startGrid: string,
  options?: {
    scanEnabled?: boolean;
    scanTimeoutMs?: number;
    hoverEnabled?: boolean;
    hoverTimeoutMs?: number;
    mouseclickEnabled?: boolean;
    language?: string;
  }
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const settingsData = {
    GridSetSettings: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      StartGrid: startGrid,
      ScanEnabled: options?.scanEnabled?.toString() ?? 'false',
      ScanTimeoutMs: options?.scanTimeoutMs?.toString() ?? '2000',
      HoverEnabled: options?.hoverEnabled?.toString() ?? 'false',
      HoverTimeoutMs: options?.hoverTimeoutMs?.toString() ?? '1000',
      MouseclickEnabled: options?.mouseclickEnabled?.toString() ?? 'true',
      Language: options?.language ?? 'en-US',
    },
  };

  return builder.build(settingsData);
}
```

**Rationale:** Settings.xml is a core Grid3 file. Currently `GridsetProcessor.saveFromTree()` creates it, but there's no standalone utility.

---

### 3. **FileMap XML Builder** (Priority: MEDIUM)

**Current location:** `grid-generator/src/gridsetGenerator.ts` (lines 81-121)

**Recommendation:** Add to `aac-processors/src/processors/gridset/helpers.ts`

```typescript
/**
 * Create Grid3 FileMap.xml content
 * @param grids - Array of grid configurations with name and path
 */
export function createFileMapXml(
  grids: Array<{ name: string; path: string; dynamicFiles?: string[] }>
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  });

  const entries = grids.map((grid) => ({
    '@_StaticFile': grid.path,
    ...(grid.dynamicFiles && grid.dynamicFiles.length > 0
      ? { DynamicFiles: { File: grid.dynamicFiles } }
      : {}),
  }));

  const fileMapData = {
    FileMap: {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      Entries: {
        Entry: entries,
      },
    },
  };

  return builder.build(fileMapData);
}
```

**Rationale:** FileMap.xml is required for all gridsets. Currently only created inline in `grid-generator`.

---

### 4. **Color Utilities** (Priority: MEDIUM-HIGH)

**Current location:** `grid-generator/src/gridsetGenerator.ts` (lines 437-680, ~240 lines!)

**Recommendation:** Add to `aac-processors/src/processors/gridset/colorUtils.ts` (new file)

This includes:
- `getNamedColour()` - CSS color name lookup (147 named colors)
- `toHexColour()` - Parse hex, rgb(), rgba(), and named colors
- `rgbaToHex()` - Convert RGBA to hex
- `channelToHex()` - Convert color channel to hex
- `clampColourChannel()` - Clamp RGB values
- `clampAlpha()` - Clamp alpha values
- `darkenColour()` - Darken a color by amount
- `normalizeColour()` - Normalize any color format to Grid3 format

**Rationale:**
- These are 240 lines of pure utility code
- Color handling is needed by any Grid3 generator
- The CSS color name table is especially valuable
- Currently duplicated logic with `styleHelpers.ts` (which only has `darkenColor`)

---

### 5. **Grid XML Structure Builders** (Priority: LOW-MEDIUM)

**Current location:** `grid-generator/src/gridsetGenerator.ts` (various functions)

**Recommendation:** Consider adding higher-level grid builders to `aac-processors`

Functions like:
- `createHomeGridContent()` - Build navigation/home grids
- `createWordlistGrid()` - Build wordlist-based grids
- `buildCellStyle()` - Build cell style objects

**Rationale:**
- These are more opinionated/template-specific
- May not be universally useful
- Could be added later if demand exists
- `GridsetProcessor.saveFromTree()` already handles low-level grid XML generation

**Recommendation:** Keep these in `grid-generator` for now, but consider extracting if other projects need similar functionality.

---

## Implementation Plan

### Phase 1: Core Utilities (v0.0.7)
1. Add `generateGrid3Guid()` to `helpers.ts`
2. Add `createSettingsXml()` to `helpers.ts`
3. Add `createFileMapXml()` to `helpers.ts`
4. Export from `src/processors/index.ts`
5. Add unit tests for all three functions
6. Update documentation

**Estimated effort:** 2-3 hours

### Phase 2: Color Utilities (v0.0.8)
1. Create new file `src/processors/gridset/colorUtils.ts`
2. Move all color utilities from `grid-generator`
3. Consolidate with existing `darkenColor()` in `styleHelpers.ts`
4. Export from `src/processors/index.ts`
5. Add comprehensive unit tests (especially for CSS color names)
6. Update documentation

**Estimated effort:** 3-4 hours

### Phase 3: Update grid-generator (After Phase 1 & 2)
1. Update `grid-generator` to use new utilities from `aac-processors`
2. Remove duplicated code
3. Update imports
4. Verify all tests still pass

**Estimated effort:** 1-2 hours

---

## Benefits

### For `aac-processors` Library
- ✅ More complete Grid3 support
- ✅ Reusable utilities for all Grid3 projects
- ✅ Better test coverage
- ✅ More valuable to the community

### For `grid-generator` Project
- ✅ Reduced codebase size (~500 lines → ~200 lines)
- ✅ Focus on template parsing logic
- ✅ Easier maintenance
- ✅ Automatic bug fixes from library updates

### For Other Projects
- ✅ Can build Grid3 generators without reinventing the wheel
- ✅ Consistent Grid3 XML generation
- ✅ Well-tested utilities

---

## API Design Considerations

### Naming Convention
All Grid3-specific utilities should be clearly prefixed or namespaced:
- `generateGrid3Guid()` (not just `generateGuid()`)
- `createGrid3SettingsXml()` or `createSettingsXml()` in gridset namespace

### Export Strategy
```typescript
// Option 1: Named exports (current pattern)
export { generateGrid3Guid, createSettingsXml, createFileMapXml } from './gridset/helpers';

// Option 2: Namespace (alternative)
import * as Grid3 from '@willwade/aac-processors/gridset';
Grid3.generateGuid();
Grid3.createSettingsXml();
```

**Recommendation:** Use Option 1 (named exports) to match current library patterns.

---

## Testing Requirements

Each new utility should have:
1. **Unit tests** - Test all code paths
2. **Integration tests** - Test with real Grid3 files
3. **Edge case tests** - Invalid inputs, empty values, etc.

Example test coverage targets:
- `generateGrid3Guid()` - 100% (simple function)
- `createSettingsXml()` - 95%+ (test all options)
- `createFileMapXml()` - 95%+ (test single/multiple grids, with/without dynamic files)
- Color utilities - 90%+ (test all CSS color names, hex formats, rgb/rgba, edge cases)

---

## Migration Path

To avoid breaking changes:

1. **Add utilities to `aac-processors`** (new exports, no breaking changes)
2. **Update `grid-generator`** to use new utilities
3. **Deprecation notice** (if any old utilities need to be removed)
4. **Version bump** - Minor version for new features (0.0.6 → 0.0.7)

---

## Questions for Discussion

1. **Color utilities file structure** - Should color utilities be in:
   - `gridset/colorUtils.ts` (Grid3-specific)
   - `core/colorUtils.ts` (shared across all processors)
   - Current `gridset/styleHelpers.ts` (consolidate)

2. **GUID generation** - Should we use a proper UUID library (like `uuid`) or keep the simple implementation?

3. **FileMap complexity** - Should `createFileMapXml()` also handle image file discovery, or just take a simple array?

4. **Backwards compatibility** - Any concerns about adding these utilities?
