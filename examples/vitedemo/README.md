# AAC Processors Browser Demo

A real browser demo that uses Vite to bundle AACProcessors for browser use.

## Features

- ✅ **Real file processing** - Upload and process actual AAC files
- ✅ **All browser-compatible processors** - Tests Dot, OPML, OBF/OBZ, Gridset, ApplePanels, AstericsGrid
- ✅ **Interactive UI** - Drag & drop files, view pages and buttons
- ✅ **Text-to-speech** - Click SPEAK buttons to hear messages (browser speech API)
- ✅ **Navigation** - Click NAVIGATE buttons to jump between pages
- ✅ **Compatibility tests** - Automated tests for all processors
- ✅ **Performance metrics** - Load time, page/button/text counts
- ✅ **TypeScript** - Full type safety and IntelliSense

## Quick Start

### 1. Install Dependencies

```bash
cd examples/vitedemo
npm install
```

### 2. Run Dev Server

```bash
npm run dev
```

The demo will open automatically at: http://localhost:3000

### 3. Build for Production

```bash
npm run build
npm run preview
```

Note: `npm run build` runs `tsc` with strict settings. If you hit TypeScript errors in the demo
code, use `npm run dev` for browser verification or fix the demo types before building.

## How to Use

1. **Upload a file**
   - Drag & drop an AAC file onto the upload area
   - Or click to open file picker
   - Supported formats: .dot, .opml, .obf, .obz, .gridset, .plist, .grd

2. **Process the file**
   - Click "Process File" button
   - View pages and buttons in the right panel
   - Check stats: pages, buttons, texts, load time

3. **Interact with buttons**
   - Click SPEAK buttons to hear text (uses browser speech API)
   - Click NAVIGATE buttons to jump to target pages

4. **Run compatibility tests**
   - Click "Run Compatibility Tests"
   - See test results in the left panel
   - Tests all 6 browser-compatible processors

## Supported File Types

| Format   | Extensions      | Processor               |
|----------|-----------------|-------------------------|
| DOT      | .dot            | DotProcessor            |
| OPML     | .opml           | OpmlProcessor           |
| OBF/OBZ  | .obf, .obz      | ObfProcessor            |
| Gridset  | .gridset        | GridsetProcessor        |
| Apple    | .plist          | ApplePanelsProcessor    |
| Asterics | .grd            | AstericsGridProcessor   |

## Test Files

You can use test files from the parent directory:

```bash
# From vitedemo directory
../../test/assets/dot/example.dot
../../test/assets/opml/example.opml
../../test/assets/obf/simple.obf
../../test/assets/gridset/example.gridset
../../test/assets/asterics/example.grd
```

## Technical Details

### Vite Configuration

The demo uses a custom Vite config to import from the source TypeScript:

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      'aac-processors': path.resolve(__dirname, '../../src/index.browser.ts')
    }
  }
});
```

This allows direct TypeScript import without pre-building.

### Import Example

```typescript
import { getProcessor } from 'aac-processors';

// Get processor for file type
const processor = getProcessor('.obf');

// Load file from input
const arrayBuffer = await file.arrayBuffer();
const tree = await processor.loadIntoTree(arrayBuffer);

// Extract texts
const texts = await processor.extractTexts(arrayBuffer);
```

## Troubleshooting

### Module not found errors

Make sure you're in the `examples/vitedemo` directory and have run `npm install`.

### TypeScript errors

Clear the Vite cache:
```bash
rm -rf node_modules/.vite
npm run dev
```

### File processing errors

Check the browser console (F12) for detailed error messages. Common issues:
- Invalid file format
- Corrupted file
- Unsupported file type (check extensions)

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Speech API works best in Chrome/Edge

## Next Steps

This demonstrates that AACProcessors works in browsers with a bundler. To use in your own project:

1. Install AACProcessors: `npm install @willwade/aac-processors`
2. Set up Vite/Webpack/Rollup
3. Import from `'aac-processors'`
4. Use `getProcessor()` factory function

See `docs/BROWSER_USAGE.md` for complete setup guides.
