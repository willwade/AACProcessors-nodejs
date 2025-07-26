// Round-trip test for SnapProcessor: load, save, reload, and compare structure
const fs = require('fs');
const path = require('path');
const { SnapProcessor } = require('../dist/processors/snapProcessor');
describe('SnapProcessor round-trip', () => {
  const snapPath = path.join(__dirname, '../examples/example.snap.json');
  const spsPath = path.join(__dirname, '../examples/example.sps');
  const outPath = path.join(__dirname, 'out.snap.json');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('round-trips Snap JSON without losing pages or navigation', () => {
    if (!fs.existsSync(snapPath)) return;
    const processor = new SnapProcessor();
    const tree1 = processor.loadIntoTree(snapPath);
    processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
    for (const pid in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pid);
      const btnLabels1 = tree1.pages[pid].buttons.map(b => b.label).sort();
      const btnLabels2 = tree2.pages[pid].buttons.map(b => b.label).sort();
      expect(btnLabels1).toEqual(btnLabels2);
    }
  });

  it('round-trips .sps file without losing pages', () => {
    if (!fs.existsSync(spsPath)) return;
    const processor = new SnapProcessor();
    const tree1 = processor.loadIntoTree(spsPath);
    processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
  });
});
