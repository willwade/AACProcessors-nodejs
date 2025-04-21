// AACProcessors Demo: Showcase all engines and features
const path = require('path');

// Import processors
const { DotProcessor, OpmlProcessor, SnapProcessor, GridsetProcessor, TouchChatProcessor, ApplePanelsProcessor, ObfProcessor } = require('../dist/processors');

// Optional: pretty printer
let prettyPrint;
try {
  prettyPrint = require('../dist/viewer/prettyPrint');
} catch {}

// Optional: symbol tools
let symbolTools;
try {
  symbolTools = require('../dist/optional/symbolTools');
} catch {}

// --- DotProcessor ---
console.log('\n=== DOT Example ===');
try {
  const dotFile = path.join(__dirname, 'example.dot');
  const dotProcessor = new DotProcessor();
  const dotTree = dotProcessor.loadIntoTree(dotFile);
  console.log('DOT tree:', dotTree);
  console.log('DOT texts:', dotProcessor.extractTexts ? dotProcessor.extractTexts(dotFile) : '(no extractTexts)');
  if (prettyPrint) prettyPrint.printTree(dotTree, { showNavigation: true });
} catch (e) {
  console.warn('DOT demo error:', e.message);
}

// --- OPMLProcessor ---
console.log('\n=== OPML Example ===');
try {
  const opmlFile = path.join(__dirname, 'example.opml');
  const opmlProcessor = new OpmlProcessor();
  const opmlTree = opmlProcessor.loadIntoTree(opmlFile);
  console.log('OPML tree:', opmlTree);
  console.log('OPML texts:', opmlProcessor.extractTexts ? opmlProcessor.extractTexts(opmlFile) : '(no extractTexts)');
  if (prettyPrint) prettyPrint.printTree(opmlTree, { showNavigation: true });
} catch (e) {
  console.warn('OPML demo error:', e.message);
}



// --- SnapProcessor (SPB) ---
console.log('\n=== Snap Example (.spb) ===');
try {
  const spbFile = path.join(__dirname, 'example.spb');
  const snapProcessor = new SnapProcessor();
  const snapTree = snapProcessor.loadIntoTree(spbFile);
  console.log('Snap tree (.spb):', snapTree);
  console.log('Snap texts (.spb):', snapProcessor.extractTexts(spbFile));
  if (prettyPrint) prettyPrint.printTree(snapTree, { showNavigation: true });
} catch (e) {
  console.warn('Snap demo error (.spb):', e.message);
}

// // --- SnapProcessor (SPS) ---
// console.log('\n=== Snap Example (.sps) ===');
// try {
//   const spsFile = path.join(__dirname, 'example.sps');
//   const snapProcessor = new SnapProcessor();
//   const snapTree = snapProcessor.loadIntoTree(spsFile);
//   console.log('Snap tree (.sps):', snapTree);
//   console.log('Snap texts (.sps):', snapProcessor.extractTexts(spsFile));
//   if (prettyPrint) prettyPrint.printTree(snapTree, { showNavigation: true });
// } catch (e) {
//   console.warn('Snap demo error (.sps):', e.message);
// }

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
  const touchchatFile = path.join(__dirname, 'example.ce');
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
  // Use ObfProcessor from dist, matching others
const obfProcessor = new ObfProcessor();
  const obzFile = path.join(__dirname, 'example.obz');
  // If loadIntoTree is async, use then/catch. If not, call directly.
  let obTree;
  try {
    obTree = obfProcessor.loadIntoTree(obzFile);
    console.log('OBZ tree:', obTree);
    // Try extractTexts if available
    if (obfProcessor.extractTexts) {
      try {
        const texts = obfProcessor.extractTexts(obzFile);
        console.log('OBZ texts:', texts);
      } catch (e) {
        console.warn('OBZ extractTexts error:', e.message);
      }
    }
    if (prettyPrint) prettyPrint.printTree(obTree, { showNavigation: true });
    console.log('\nDemo complete.');
  } catch (e) {
    console.warn('OBZ demo error:', e.message);
    console.log('\nDemo complete.');
  }
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
