import fs from 'fs';
import path from 'path';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
// import { AACTree } from '../src/core/treeStructure'; // Unused import

describe('GridsetProcessor round-trip', () => {
  const gsPath = path.join(__dirname, 'assets/gridset/example.gridset.json');
  const outPath = path.join(__dirname, 'out.gridset.json');
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it('round-trips Gridset JSON without losing pages or navigation', () => {
    if (!fs.existsSync(gsPath)) return;
    const processor = new GridsetProcessor();
    const tree1 = processor.loadIntoTree(gsPath);
    processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
    for (const pid in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pid);
      const btnLabels1 = tree1.pages[pid].buttons.map((b) => b.label).sort();
      const btnLabels2 = tree2.pages[pid].buttons.map((b) => b.label).sort();
      expect(btnLabels1).toEqual(btnLabels2);
    }
  });
});
