# 🎯 AAC Processors Browser Demo - Quick Start

## 🚀 Running the Demo

The demo is already running! Open your browser to:

**http://localhost:3000**

## 📁 Test Files Included

The `test-files/` folder contains example AAC files you can use:

- `example.dot` (392 bytes) - DOT format board
- `example.opml` (495 bytes) - OPML outline
- `simple.obf` (2.1 KB) - Open Board Format
- `example.obz` (13 MB) - Compressed OBF
- `example.gridset` (1.4 MB) - Grid 3 gridset
- `example.grd` (21 KB) - Asterics Grid

## 🧪 How to Test

### Option 1: Drag & Drop
1. Open http://localhost:3000
2. Drag any file from `test-files/` onto the upload area
3. Click "Process File"
4. Explore pages and buttons!

### Option 2: File Picker
1. Click the upload area
2. Select a file from `test-files/`
3. Click "Process File"

### Option 3: Run Tests
1. Click "Run Compatibility Tests"
2. See all 9 tests pass!

## ✨ Features to Try

- **Text-to-Speech**: Click any SPEAK button to hear the message
- **Navigation**: Click NAVIGATE buttons to jump between pages
- **Stats**: See page/button/text counts and load time
- **Logs**: Watch the processing log in real-time
- **Pageset Lab**: Open the "Create & Convert" tab to generate a sample pageset or convert an upload to OBF/OBZ

## 🛠️ Development

### Restart Server
```bash
cd examples/vitedemo
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

## 📊 What's Being Tested

This demo proves AACProcessors works in browsers with:
- ✅ Vite bundling
- ✅ All 6 browser-compatible processors
- ✅ File upload (drag & drop + picker)
- ✅ ArrayBuffer handling
- ✅ Tree structure parsing
- ✅ Text extraction
- ✅ Button interaction
- ✅ Browser Speech API integration

## 🎉 Success!

If you can see the demo and process files, congratulations! You now have a working browser-based AAC processor. This can be used as a template for your own browser applications.

See `docs/BROWSER_USAGE.md` for integration guides.
