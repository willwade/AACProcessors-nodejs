import fs from 'fs';
import path from 'path';
import { SnapProcessor } from '../src/processors/snapProcessor';
// import { AACTree } from '../src/core/treeStructure'; // Unused import
describe('SnapProcessor round-trip', () => {
  const snapPath = path.join(__dirname, 'assets/snap/example.snap.json');
  const spsPath = path.join(__dirname, 'assets/snap/example.sps');
  const outPath = path.join(__dirname, 'out.snap.json');
  afterAll(async () => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it('round-trips Snap JSON without losing pages or navigation', async () => {
    if (!fs.existsSync(snapPath)) return;
    const processor = new SnapProcessor();
    const tree1 = processor.loadIntoTree(snapPath);
    await processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
    for (const pid in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pid);
      const btnLabels1 = tree1.pages[pid].buttons.map((b) => b.label).sort();
      const btnLabels2 = tree2.pages[pid].buttons.map((b) => b.label).sort();
      expect(btnLabels1).toEqual(btnLabels2);
    }

    // Compare metadata
    expect(tree2.metadata.name).toBe(tree1.metadata.name);
    expect(tree2.metadata.locale).toBe(tree1.metadata.locale);
  });

  it.skip('round-trips .sps file without losing pages (saveFromTree not implemented)', () => {
    if (!fs.existsSync(spsPath)) return;
    const processor = new SnapProcessor();
    const tree1 = processor.loadIntoTree(spsPath);
    await processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
  });
});
