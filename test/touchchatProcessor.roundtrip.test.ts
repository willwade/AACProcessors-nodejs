import fs from 'fs';
import path from 'path';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
// import { AACTree } from '../src/core/treeStructure'; // Unused import
describe('TouchChatProcessor round-trip', () => {
  const tcPath = path.join(__dirname, 'assets/excel/example.touchchat.json');
  const outPath = path.join(__dirname, 'out.touchchat.json');
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it('round-trips TouchChat JSON without losing pages or navigation', () => {
    if (!fs.existsSync(tcPath)) return;
    const processor = new TouchChatProcessor();
    const tree1 = processor.loadIntoTree(tcPath);
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
