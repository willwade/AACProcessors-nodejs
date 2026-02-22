# Browser Usage Guide

This guide explains how to use AACProcessors in browser environments.

## ⚠️ Important: Bundler Required

**AACProcessors uses TypeScript and outputs CommonJS modules, which requires a bundler for browser use.**

You **cannot** directly import from `dist/index.browser.js` in a browser without a bundler.

### Recommended Bundlers

- **Vite** (recommended, easiest setup)
- **Webpack**
- **Rollup**
- **esbuild**
- **Parcel**

## Installation

```bash
npm install @willwade/aac-processors
```

## Quick Start with Vite

### 1. Create a Vite Project

```bash
npm create vite@latest my-aac-app -- --template vanilla-ts
cd my-aac-app
npm install
```

### 2. Install AACProcessors

```bash
npm install @willwade/aac-processors
```

### 3. Configure Vite

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'aac-processors': path.resolve(__dirname, 'node_modules/@willwade/aac-processors/src/index.browser.ts')
    }
  }
});
```

### 4. Use in Your Code

```typescript
// src/main.ts
import { getProcessor } from 'aac-processors';

async function loadFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const processor = getProcessor('.obf');
  const tree = await processor.loadIntoTree(arrayBuffer);
  console.log('Loaded tree:', tree);
}

// Use with file input
document.getElementById('fileInput')?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    await loadFile(file);
  }
});
```

### 5. Run the Dev Server

```bash
npm run dev
```

## Quick Start with Webpack

### 1. Install Dependencies

```bash
npm install @willwade/aac-processors webpack webpack-cli ts-loader
```

### 2. Configure Webpack

Create `webpack.config.js`:

```javascript
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'aac-processors': path.resolve(__dirname, 'node_modules/@willwade/aac-processors/src/index.browser.ts')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  }
};
```

### 3. Use in Your Code

```typescript
// src/index.ts
import { getProcessor } from 'aac-processors';

// Same usage as Vite example above
```

## Using with CDN (Not Recommended)

While you can use the library via CDN, it's **not recommended** because:

1. The library is not currently published as an ESM bundle
2. You'll need to use a compatibility layer like SystemJS
3. TypeScript types won't work properly

For production use, **always use a bundler**.

## Basic Usage

### Loading a File from File Input

The most common browser use case is loading files from an `<input type="file">` element:

```html
<input type="file" id="fileInput" accept=".obf,.obz,.gridset,.dot,.opml">
<script type="module">
  import { getProcessor } from 'aac-processors';

  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Get file extension
      const extension = '.' + file.name.split('.').pop();

      // Get appropriate processor
      const processor = getProcessor(extension);

      if (!processor) {
        console.error('No processor found for:', extension);
        return;
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load into tree
      const tree = await processor.loadIntoTree(arrayBuffer);

      console.log('Loaded tree:', tree);
      console.log('Pages:', Object.keys(tree.pages));
      console.log('Root page:', tree.pages[tree.rootId]);

    } catch (error) {
      console.error('Error loading file:', error);
    }
  });
</script>
```

### Extracting Texts from a File

```html
<script type="module">
  import { ObfProcessor } from 'aac-processors';

  async function extractTextsFromFile(file) {
    const processor = new ObfProcessor();
    const arrayBuffer = await file.arrayBuffer();
    const texts = await processor.extractTexts(arrayBuffer);

    console.log(`Extracted ${texts.length} texts:`, texts);
    return texts;
  }

  // Usage
  document.getElementById('extractButton').addEventListener('click', async () => {
    const file = document.getElementById('fileInput').files[0];
    const texts = await extractTextsFromFile(file);
    displayTexts(texts);
  });
</script>
```

## Supported File Types

### Browser-Compatible Processors

These processors work in browser environments:

| Processor       | Extensions      | Description                      |
|-----------------|-----------------|----------------------------------|
| DotProcessor    | `.dot`          | OpenSymbols Board files          |
| OpmlProcessor   | `.opml`         | OPML outline files               |
| ObfProcessor    | `.obf`, `.obz`  | Open Board Format files          |
| GridsetProcessor| `.gridset`      | Grid 3 gridset files (not .gridsetx) |
| ApplePanelsProcessor | `.plist` | Apple Panels files               |
| AstericsGridProcessor | `.grd`    | Asterics Grid files              |

### Node-Only Processors

These processors require Node.js and **do not work** in browser:

- **SnapProcessor** (.spb, .sps) - Requires SQLite
- **TouchChatProcessor** (.ce) - Requires SQLite
- **ExcelProcessor** (.xlsx) - Uses fs at top level

## Factory Functions

### getProcessor(extension)

Get a processor instance for a file extension:

```javascript
import { getProcessor } from 'aac-processors';

const processor = getProcessor('.obf');
console.log(processor.constructor.name); // 'ObfProcessor'
```

### getSupportedExtensions()

Get list of supported file extensions:

```javascript
import { getSupportedExtensions } from 'aac-processors';

const extensions = getSupportedExtensions();
// ['.dot', '.opml', '.obf', '.obz', '.gridset', '.plist', '.grd']
```

### isExtensionSupported(extension)

Check if an extension is supported:

```javascript
import { isExtensionSupported } from 'aac-processors';

console.log(isExtensionSupported('.obf')); // true
console.log(isExtensionSupported('.pdf')); // false
```

## Working with Tree Structure

### Accessing Pages

```javascript
const tree = await processor.loadIntoTree(arrayBuffer);

// Get all page IDs
const pageIds = Object.keys(tree.pages);
console.log('Pages:', pageIds);

// Get root page
const rootPage = tree.pages[tree.rootId];
console.log('Root page:', rootPage.name);

// Get specific page
const page = tree.pages['page-id'];
console.log('Page buttons:', page.buttons.length);
```

### Accessing Buttons

```javascript
const page = tree.pages['page-id'];

// Iterate through buttons
page.buttons.forEach(button => {
  console.log('Button:', button.label);
  console.log('Message:', button.message);
  console.log('Type:', button.type);

  // Check for navigation
  if (button.type === 'NAVIGATE') {
    console.log('Navigates to:', button.targetPageId);
  }
});

// Get buttons with specific type
const speakButtons = page.buttons.filter(b => b.type === 'SPEAK');
```

### Accessing Images

```javascript
// For OBF/OBZ files with embedded images
const button = page.buttons[0];
if (button.imagePath) {
  console.log('Image path:', button.imagePath);

  // Extract image as data URL (browser-compatible)
  const processor = new ObfProcessor();
  const dataUrl = await processor.extractImageAsDataUrl(arrayBuffer, button.imagePath);
  console.log('Data URL:', dataUrl);

  // Use in img tag
  const img = document.createElement('img');
  img.src = dataUrl;
  document.body.appendChild(img);
}
```

## Complete Example: AAC File Viewer

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AAC File Viewer</title>
    <style>
        .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
            padding: 20px;
        }
        .aac-button {
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            background: #f0f0f0;
        }
        .aac-button:hover {
            background: #e0e0e0;
        }
    </style>
</head>
<body>
    <h1>AAC File Viewer</h1>
    <input type="file" id="fileInput" accept=".obf,.obz,.gridset,.dot,.opml,.plist,.grd">
    <div id="content"></div>

    <script type="module">
        import { getProcessor } from 'aac-processors';

        const fileInput = document.getElementById('fileInput');
        const contentDiv = document.getElementById('content');

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const extension = '.' + file.name.split('.').pop();
            const processor = getProcessor(extension);
            const arrayBuffer = await file.arrayBuffer();
            const tree = await processor.loadIntoTree(arrayBuffer);

            displayPage(tree.rootId);
        });

        function displayPage(pageId) {
            const page = tree.pages[pageId];
            contentDiv.innerHTML = `<h2>${page.name}</h2>`;

            const grid = document.createElement('div');
            grid.className = 'button-grid';

            page.buttons.forEach(button => {
                const btnDiv = document.createElement('div');
                btnDiv.className = 'aac-button';
                btnDiv.textContent = button.label;
                btnDiv.addEventListener('click', () => {
                    if (button.type === 'NAVIGATE') {
                        displayPage(button.targetPageId);
                    } else {
                        console.log('Button clicked:', button.label, button.message);
                    }
                });
                grid.appendChild(btnDiv);
            });

            contentDiv.appendChild(grid);
        }
    </script>
</body>
</html>
```

## Browser-Specific Considerations

### No File Paths

Browsers don't have access to file paths. Always use:

- `File` objects from `<input type="file">`
- `ArrayBuffer` or `Uint8Array` from `fetch()` or `FileReader`
- `Blob` objects

### CORS for Remote Files

When loading files from remote URLs, ensure CORS is enabled:

```javascript
async function loadFromUrl(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const processor = getProcessor('.obf');
  const tree = await processor.loadIntoTree(arrayBuffer);
  return tree;
}

// This will fail if the server doesn't send proper CORS headers
loadFromUrl('https://example.com/file.obf');
```

### Memory Management

Large files can consume significant memory. Consider:

1. **Process files one at a time** - Avoid loading multiple files simultaneously
2. **Revoke object URLs** - `URL.revokeObjectURL(url)` when done with blobs
3. **Clear references** - Set variables to `null` when done

```javascript
let currentTree = null;

async function loadFile(file) {
  // Clear previous
  currentTree = null;

  // Load new
  const processor = getProcessor('.obf');
  const arrayBuffer = await file.arrayBuffer();
  currentTree = await processor.loadIntoTree(arrayBuffer);
}

function clearTree() {
  currentTree = null;
  // Trigger garbage collection hint
  if (window.gc) window.gc();
}
```

### Performance Tips

1. **Use Web Workers** for large files:
```javascript
// worker.js
import { getProcessor } from 'aac-processors';

self.onmessage = async (event) => {
  const { file } = event.data;
  const processor = getProcessor('.obf');
  const arrayBuffer = await file.arrayBuffer();
  const tree = await processor.loadIntoTree(arrayBuffer);
  self.postMessage({ tree });
};
```

2. **Show progress indicators**:
```javascript
function showLoading(message) {
  document.getElementById('status').textContent = message;
}

async function loadWithProgress(file) {
  showLoading('Loading file...');
  const arrayBuffer = await file.arrayBuffer();
  showLoading('Processing file...');
  const tree = await processor.loadIntoTree(arrayBuffer);
  showLoading('Done!');
  return tree;
}
```

## Error Handling

Always wrap processor calls in try/catch:

```javascript
async function safeLoadFile(file) {
  try {
    const extension = '.' + file.name.split('.').pop();
    const processor = getProcessor(extension);

    if (!processor) {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const tree = await processor.loadIntoTree(arrayBuffer);

    return tree;
  } catch (error) {
    console.error('Failed to load file:', error);
    alert(`Error: ${error.message}`);
    return null;
  }
}
```

## Testing

Use the Vite demo in `examples/vitedemo` for interactive browser testing.

## Troubleshooting

### Module Not Found

**Problem:** `Cannot resolve 'aac-processors'`

**Solution:** Ensure you're importing from the correct path:
```javascript
// For npm installs
import { getProcessor } from 'aac-processors';

// For local development
import { getProcessor } from './dist/index.browser.js';
```

### Buffer vs ArrayBuffer

**Problem:** Type mismatch between Buffer and ArrayBuffer

**Solution:** Browsers use ArrayBuffer/Uint8Array, not Buffer:
```javascript
// Browser
const arrayBuffer = await file.arrayBuffer();
const uint8Array = new Uint8Array(arrayBuffer);

// Both work with processors
await processor.loadIntoTree(arrayBuffer);
await processor.loadIntoTree(uint8Array);
```

### Gridset .gridsetx Files

**Problem:** `.gridsetx` files fail to load

**Solution:** Encrypted `.gridsetx` files require Node.js crypto. Use regular `.gridset` files in browser.

## Additional Resources

- [API Documentation](./API.md)
- [Examples](../examples/)
- [Vite Browser Demo](../examples/vitedemo)
