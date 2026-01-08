// Example: Resolve images from a Grid 3 gridset and print allow-list
const fs = require('fs');
const path = require('path');

// Use compiled dist outputs with new namespace structure
const { GridsetProcessor, Gridset } = require('../dist/index');

(async () => {
  try {
    const file = path.join(__dirname, '../examples/example-images.gridset');
    console.log('Loading gridset:', file);

    const proc = new GridsetProcessor();
    const tree = await proc.loadIntoTree(file);

    const pageIds = Object.keys(tree.pages);
    const rootId = tree.rootId || pageIds[0];
    console.log('Pages:', pageIds.length, 'root:', rootId);

    const map = Gridset.getPageTokenImageMap(tree, rootId);
    console.log('Resolved images on root page:', map.size);
    for (const [token, entry] of map.entries()) {
      console.log('  token', token, '=>', entry);
    }

    const allow = Gridset.getAllowedImageEntries(tree);
    console.log('Allow-list size:', allow.size);

    // Try to read the first image entry
    const first = Array.from(allow)[0];
    if (first) {
      const img = Gridset.openImage(first);
      console.log('First image:', img);
    }
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();

