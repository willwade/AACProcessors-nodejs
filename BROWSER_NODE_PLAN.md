# Project Plan: Dual Node + Browser Support

## ✅ Completed Tasks

### 1. Platform Entrypoints and Exports
- ✅ Define scope and guarantees (scope captured, Node + browser targets listed)
- ✅ Create `src/index.node.ts` (current behavior, all processors)
- ✅ Create `src/index.browser.ts` (browser-safe exports only)
- ✅ Update `package.json` exports with `node` and `browser` conditions
- ✅ Ensure typings map correctly for both platforms

### 2. IO Boundary Refactoring
- ✅ Add tiny IO helpers for reading text/binary from buffers and browser objects (`src/utils/io.ts`)
- ✅ Update processors to accept `string | Buffer | ArrayBuffer | Uint8Array`
- ✅ Remove top-level `fs` imports from browser-safe processors (ObfsetProcessor, GridsetProcessor)
- ✅ Only use `fs/path` for string paths via dynamic requires

### 3. Gridset Browser Compatibility (MAJOR MILESTONE)
- ✅ **Created `src/processors/gridset/crypto.ts`** - Isolated Node-only crypto/zlib code for `.gridsetx` files
- ✅ Removed top-level `import crypto from 'crypto'` from GridsetProcessor
- ✅ Removed top-level `import zlib from 'zlib'` from GridsetProcessor
- ✅ Removed top-level `import fs from 'fs'` from GridsetProcessor
- ✅ Removed top-level `import AdmZip from 'adm-zip'` - made dynamic require via `getAdmZip()` helper
- ✅ **GridsetProcessor now works in browser for `.gridset` files!**
- ⚠️ `.gridsetx` files (encrypted) require Node environment for crypto operations
- ✅ All tests passing (615 tests, 74.18% coverage)
- ✅ Build succeeds, lint clean

### 4. Validator Updates
- ✅ Validators now use JSZip (done in previous commit)

## 🚧 In Progress / Remaining Tasks

### 1. Migrate ZIP Usage to JSZip (HIGH PRIORITY)
- ⚠️ **OBF/OBZ processors still use adm-zip** via dynamic require
- ⚠️ **Gridset processor still uses adm-zip** via dynamic require
- 🔄 Need to replace `adm-zip` with `jszip` in:
  - `src/processors/obfProcessor.ts`
  - `src/processors/gridsetProcessor.ts`
- ⚠️ **API Breaking Change Required**: JSZip is async, adm-zip is sync
  - Must update BaseProcessor interface to support async methods
  - Options:
    - **A)** Make methods async (breaking change, cleanest API)
    - **B)** Add parallel async methods (e.g., `loadIntoTreeAsync()`)
    - **C)** Use Promise-returning methods that work in both contexts
- Update tests and fixtures to validate zip handling in both environments
- Ensure Node and browser both use the same zip abstraction

### 2. Update BaseProcessor Interface (BLOCKED ON ABOVE)
- Need to decide on async approach before implementing
- Current methods are synchronous:
  - `loadIntoTree(filePathOrBuffer: ProcessorInput): AACTree`
  - `extractTexts(filePathOrBuffer: ProcessorInput): string[]`
  - `processTexts(...): Uint8Array`
  - `saveFromTree(...): void`
- JSZip requires async operations
- Must choose migration strategy and update all processors

### 3. Make Remaining Processors Browser-Compatible
- ⚠️ Gridset: `.gridsetx` requires crypto (Node-only) - **ACCEPTED LIMITATION**
- ❌ Snap: Requires sqlite (deferred - needs wasm sqlite)
- ❌ TouchChat: Requires sqlite (deferred - needs wasm sqlite)
- ❌ Excel: Uses fs at top level - needs audit
- ✅ OPML, DOT, ApplePanels, AstericsGrid: Already browser-safe

### 4. Validate Browser-Safe Processors
- Ensure OPML, DOT, ApplePanels, AstericsGrid work in both environments
- Add OBF/OBZ to browser exports once JSZip migration complete
- Add Gridset to browser exports (with `.gridsetx` limitation documented)
- Document any gaps (e.g., "Snap/TouchChat require Node environment for sqlite")

### 5. Documentation and Examples
- Create CHANGELOG.md entry documenting breaking changes
- Add browser usage examples (e.g., File/Blob inputs)
- Add Node usage examples (string paths)
- Document `.gridsetx` crypto limitation
- Migrate `scripts/*` to use new entrypoints and buffer-based IO

### 6. Testing
- ✅ All existing tests passing (615 tests, 74.18% coverage)
- Add targeted tests for browser code paths (buffer/ArrayBuffer inputs)
- Add tests for async zip operations once JSZip migration complete
- Test in actual browser environment

## 📊 Current Status

### Browser-Compatible Processors (in `src/index.browser.ts`)
- ✅ DotProcessor
- ✅ OpmlProcessor
- ⚠️ ObfProcessor (uses adm-zip - needs JSZip migration)
- ✅ ApplePanelsProcessor
- ✅ AstericsGridProcessor
- ⚠️ GridsetProcessor (uses adm-zip - needs JSZip migration, `.gridsetx` needs crypto)

### Node-Only Processors (deferred)
- ❌ SnapProcessor (sqlite - needs wasm)
- ❌ TouchChatProcessor (sqlite - needs wasm)
- ❌ ExcelProcessor (uses fs at top level - needs audit)

## 🔥 Critical Path

1. **Decide on async API strategy** for BaseProcessor interface
2. **Migrate OBF/OBZ to JSZip** (will unblock full browser support)
3. **Migrate Gridset to JSZip** (for non-encrypted `.gridset` files)
4. **Document breaking changes** in CHANGELOG.md
5. **Add browser tests** for async zip operations

## 📝 Notes

- Breaking changes are acceptable - just need to document them
- Keep tests green throughout (currently passing!)
- Run `npm run lint:fix` regularly (currently clean with 2 acceptable warnings)
- The goal is dual support - not 100% feature parity in browser
- Some Node-only features are acceptable (crypto, sqlite) if documented properly

## 🎯 Next Immediate Steps

1. Create CHANGELOG.md entry for Gridset crypto separation
2. Decide on async API approach for BaseProcessor
3. Migrate OBF/OBZ to JSZip with async methods
4. Update BaseProcessor interface to support async
5. Add browser entrypoint tests
