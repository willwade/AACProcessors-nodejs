// Test SnapProcessor export/saveFromTree
const fs = require('fs');
const path = require('path');
const SnapProcessor = require('../src/processors/snapProcessor');
describe('SnapProcessor.saveFromTree', () => {
  const snapPath = path.join(__dirname, '../examples/example.snap.json');
  const spsPath = path.join(__dirname, '../examples/example.sps');
  const outPath = path.join(__dirname, 'out.snap.json');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('exports tree to Snap JSON', () => {
    // If no example.snap.json, skip
    if (!fs.existsSync(snapPath)) return;
    const tree = require('../src/processors/snapProcessor').prototype.loadIntoTree.call(SnapProcessor, snapPath);
    SnapProcessor.prototype.saveFromTree.call(SnapProcessor, tree, outPath);
    const exported = fs.readFileSync(outPath, 'utf8');
    expect(exported).toContain('pages');
    expect(exported).toContain('rootId');
  });

  it('loads tree from .sps file and returns pages', () => {
    if (!fs.existsSync(spsPath)) return;
    const tree = require('../src/processors/snapProcessor').prototype.loadIntoTree.call(SnapProcessor, spsPath);
    expect(tree).toBeTruthy();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });
});
