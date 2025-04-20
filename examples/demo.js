// AACProcessors Demo: Showcase all engines and features
const path = require('path');

// Import processors
const { DotProcessor, OPMLProcessor, SnapProcessor, GridsetProcessor, TouchChatProcessor } = require('../src/processors');

// Optional: pretty printer
let prettyPrint;
try {
  prettyPrint = require('../src/viewer/prettyPrint');
} catch {}

// Optional: symbol tools
let symbolTools;
try {
  symbolTools = require('../src/optional/symbolTools');
} catch {}

// --- DotProcessor ---
console.log('\n=== DOT Example ===');
try {
  const dotFile = path.join(__dirname, 'example.dot');
  const dotTree = DotProcessor.loadIntoTree(dotFile);
  console.log('DOT tree:', dotTree);
  console.log('DOT texts:', DotProcessor.extractTexts ? DotProcessor.extractTexts(dotFile) : '(no extractTexts)');
  if (prettyPrint) prettyPrint.printTree(dotTree, { showNavigation: true });
} catch (e) {
  console.warn('DOT demo error:', e.message);
}

// --- OPMLProcessor ---
console.log('\n=== OPML Example ===');
try {
  const opmlFile = path.join(__dirname, 'example.opml');
  const opmlTree = OPMLProcessor.loadIntoTree(opmlFile);
  console.log('OPML tree:', opmlTree);
  console.log('OPML texts:', OPMLProcessor.extractTexts ? OPMLProcessor.extractTexts(opmlFile) : '(no extractTexts)');
  if (prettyPrint) prettyPrint.printTree(opmlTree, { showNavigation: true });
} catch (e) {
  console.warn('OPML demo error:', e.message);
}

// --- SnapProcessor ---
console.log('\n=== Snap Example ===');
try {
  const snapFile = path.join(__dirname, 'example.snap.json');
  const snapProcessor = new SnapProcessor();
  const snapTree = snapProcessor.loadIntoTree(snapFile);
  console.log('Snap tree:', snapTree);
  console.log('Snap texts:', snapProcessor.extractTexts(snapFile));
  if (prettyPrint) prettyPrint.printTree(snapTree, { showNavigation: true });
  // Optional: symbol demo
  if (symbolTools && symbolTools.SnapSymbolExtractor) {
    const extractor = new symbolTools.SnapSymbolExtractor();
    const symbolRefs = extractor.getSymbolReferences(snapFile);
    console.log('Snap symbol refs:', symbolRefs.slice(0, 5));
  }
} catch (e) {
  console.warn('Snap demo error:', e.message);
}

// --- GridsetProcessor ---
console.log('\n=== Gridset Example ===');
try {
  const gridsetFile = path.join(__dirname, 'example.gridset');
  const gridsetProcessor = new GridsetProcessor();
  const gridTree = gridsetProcessor.loadIntoTree(gridsetFile);
  console.log('Gridset tree:', gridTree);
  console.log('Gridset texts:', gridsetProcessor.extractTexts(gridsetFile));
  if (prettyPrint) prettyPrint.printTree(gridTree, { showNavigation: true });
} catch (e) {
  console.warn('Gridset demo error:', e.message);
}

// --- TouchChatProcessor ---
console.log('\n=== TouchChat Example ===');
try {
  const touchchatFile = path.join(__dirname, 'example.touchchat.json');
  const touchchatProcessor = new TouchChatProcessor();
  const tcTree = touchchatProcessor.loadIntoTree(touchchatFile);
  console.log('TouchChat tree:', tcTree);
  console.log('TouchChat texts:', touchchatProcessor.extractTexts(touchchatFile));
  if (prettyPrint) prettyPrint.printTree(tcTree, { showNavigation: true });
} catch (e) {
  console.warn('TouchChat demo error:', e.message);
}

// --- OBF/OBZ Processor ---
console.log('\n=== OBF/OBZ Example ===');
try {
  const OBFProcessor = require('../src/processors/obfProcessor');
  const obzFile = path.join(__dirname, 'example.obz');
  // loadIntoTree is async, so use then/catch
  OBFProcessor.loadIntoTree(obzFile).then(obTree => {
    console.log('OBZ tree:', obTree);
    // Try extractTexts if available
    if (OBFProcessor.extractTexts) {
      try {
        const texts = OBFProcessor.extractTexts(obzFile);
        console.log('OBZ texts:', texts);
      } catch (e) {
        console.warn('OBZ extractTexts error:', e.message);
      }
    }
    if (prettyPrint) prettyPrint.printTree(obTree, { showNavigation: true });
    console.log('\nDemo complete.');
  }).catch(e => {
    console.warn('OBZ demo error:', e.message);
    console.log('\nDemo complete.');
  });
  // Return here so the rest of the demo waits for async
  return;
} catch (e) {
  console.warn('OBZ demo error:', e.message);
}

// --- ApplePanelsProcessor (if implemented) ---
// console.log('\n=== Apple Panels Example ===');
// try {
//   const applePanelsFile = path.join(__dirname, 'example.ascconfig');
//   const applePanelsProcessor = new ApplePanelsProcessor();
//   const apTree = applePanelsProcessor.loadIntoTree(applePanelsFile);
//   console.log('Apple Panels tree:', apTree);
//   if (prettyPrint) prettyPrint.printTree(apTree, { showNavigation: true });
// } catch (e) {
//   console.warn('Apple Panels demo error:', e.message);
// }

console.log('\nDemo complete.');
