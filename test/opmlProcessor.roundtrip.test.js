// Round-trip test for OPMLProcessor: load, save, reload, and compare structure
const fs = require('fs');
const path = require('path');
const OPMLProcessor = require('../src/processors/opmlProcessor');
describe('OPMLProcessor round-trip', () => {
  const opmlPath = path.join(__dirname, '../examples/example.opml');
  const outPath = path.join(__dirname, 'out.opml');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('round-trips OPML file without losing pages', () => {
    const tree1 = OPMLProcessor.loadIntoTree(opmlPath);
    OPMLProcessor.saveFromTree(tree1, outPath);
    const tree2 = OPMLProcessor.loadIntoTree(outPath);
    // Compare set of page names (labels)
    const filterArtificial = arr => arr.filter(n => n !== 'Super Root' && n !== 'Root').sort();
    const names1 = filterArtificial(Object.values(tree1.pages).map(p => p.name));
    const names2 = filterArtificial(Object.values(tree2.pages).map(p => p.name));
    expect(names2).toEqual(names1);
    // Compare root names
    expect(tree2.getPage(tree2.rootId).name).toEqual(tree1.getPage(tree1.rootId).name);
  });
});
