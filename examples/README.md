# AAC Processors Example Pagesets

This directory contains example AAC pagesets in various formats used for testing and demonstration purposes.

## Available Pagesets

### Grid3 Format (.gridset)
- **example.gridset** - Main example pageset with multiple grids and wordlists
- **example-images.gridset** - Example pageset with embedded images

### Snap Format (.spb, .sps)
- **example.spb** - Snap pageset (binary format)
- **example.sps** - Snap pageset (alternative format)

### TouchChat Format (.ce)
- **example.ce** - TouchChat pageset

### OBF/OBZ Format (.obf, .obz)
- **example.obf** - OBF pageset (JSON-based)
- **example.obz** - OBZ pageset (compressed)

**obf/** - Directory containing validation test samples from the obf-node project:
- **simple.obf** - Simple, valid OBF file for basic validation tests
- **aboutme.json** - Invalid OBF (missing locale field) for error testing
- **hash.json** - Non-OBF JSON structure for format detection tests
- **array.json** - JSON array (not object) for structure validation tests
- **links.obz** - OBZ package with links for zip archive validation

### Asterics Grid Format (.grd)
- **example.grd** - Asterics Grid pageset
- **example2.grd** - Alternative Asterics Grid pageset

### DOT Format (.dot)
- **example.dot** - Simple DOT format pageset
- **communikate.dot** - Communikate DOT format pageset

### OPML Format (.opml)
- **example.opml** - OPML pageset

### Styled Output
- **styled-output/** - Directory containing example pagesets with styling applied

## Usage

These pagesets are used by:
- Unit tests in the main test suite
- Demo scripts in the `scripts/` directory
- Integration examples

To run demo scripts that use these pagesets, see the [scripts/README.md](../scripts/README.md).

## Browser Testing

### ⚠️ Important Note

AACProcessors is built with TypeScript and outputs CommonJS modules. To use it in a browser, you **must use a bundler** (Vite, Webpack, Rollup, etc.). The browser test page below only validates the library structure - it cannot run actual processors without a bundler.

### Browser Test Page

A dedicated browser test page is available for validating the library structure:

**Start the test server:**
```bash
node examples/browser-test-server.js
```

**Open in your browser:**
```
http://localhost:8080/examples/browser-test.html
```

**What it tests:**
- ✅ Browser build files exist and are accessible
- ✅ Type definitions are present
- ✅ Processor exports are available
- ❌ **Does NOT run actual processors** (requires bundler)

### What Gets Tested

The browser test page (`browser-test.html`) verifies:

1. **Module Loading** - Can the browser load the ES modules?
2. **Factory Functions** - Do `getProcessor()` and `getSupportedExtensions()` work?
3. **Processor Instantiation** - Can processors be created?
4. **File Loading** - Can files be loaded from `<input type="file">`?
5. **Buffer Handling** - Do ArrayBuffers/Uint8Arrays work correctly?
6. **Tree Structure** - Can AACTree be created from files?
7. **Text Extraction** - Can texts be extracted from files?

### Supported File Types in Browser

The browser test page supports all browser-compatible processors:

- **DotProcessor** (.dot) - OpenSymbols Board files
- **OpmlProcessor** (.opml) - OPML outline files
- **ObfProcessor** (.obf/.obz) - Open Board Format files
- **GridsetProcessor** (.gridset) - Grid 3 gridset files (not .gridsetx)
- **ApplePanelsProcessor** (.plist) - Apple Panels files
- **AstericsGridProcessor** (.grd) - Asterics Grid files

### Manual Testing

1. Open the browser console (F12 or Cmd+Option+I)
2. Click "Select a file to test" to upload an AAC file
3. Click "Test File" to process it
4. Check the results panel for page count, button count, and extracted texts

### Automated Tests

Click "Run All Browser Tests" to run automated checks:
- Factory function tests
- Extension support tests
- Processor instantiation tests
- Buffer handling tests

### Node-Only Processors

The following processors are **not available** in the browser:
- **SnapProcessor** (.spb/.sps) - Requires SQLite
- **TouchChatProcessor** (.ce) - Requires SQLite
- **ExcelProcessor** (.xlsx) - Uses fs at top level

### Notes

- Gridset `.gridsetx` files (encrypted) are not supported in browser
- All processors work with Buffer, Uint8Array, and ArrayBuffer inputs
- File paths are not supported in browser (use file inputs or fetch)
