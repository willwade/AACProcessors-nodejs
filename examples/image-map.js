// Example: Resolve images from a Grid 3 gridset and print allow-list
const fs = require('fs');
const path = require('path');

// Use compiled dist outputs
const { GridsetProcessor, getPageTokenImageMap, getAllowedImageEntries, openImage } = require('../dist/processors');

(async () => {
  try {
    const file = path.join(__dirname, 'example-images.gridset');
    console.log('Loading gridset:', file);

    const proc = new GridsetProcessor();
    const tree = proc.loadIntoTree(file);

    const pageIds = Object.keys(tree.pages);
    const rootId = tree.rootId || pageIds[0];
    console.log('Pages:', pageIds.length, 'root:', rootId);

    const map = getPageTokenImageMap(tree, rootId);
    console.log('Resolved images on root page:', map.size);
    for (const [token, entry] of map.entries()) {
      console.log('  token', token, '=>', entry);
    }

    const allow = getAllowedImageEntries(tree);
    console.log('Allow-list size:', allow.size);

    // Try to read the first image entry
    const first = Array.from(allow)[0];
    if (first) {
      const buf = fs.readFileSync(file);
      const data = openImage(buf, first);
      if (data) {
        console.log('Read image bytes for', first, 'len=', data.length);
      } else {
        console.warn('Could not read image for', first);
      }
    }
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();

