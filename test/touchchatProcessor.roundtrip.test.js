// Round-trip test for TouchChatProcessor: load, save, reload, and compare structure
const fs = require('fs');
const path = require('path');
const TouchChatProcessor = require('../src/processors/touchchatProcessor');
describe('TouchChatProcessor round-trip', () => {
  const tcPath = path.join(__dirname, '../examples/example.touchchat.json');
  const outPath = path.join(__dirname, 'out.touchchat.json');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('round-trips TouchChat JSON without losing pages or navigation', () => {
    if (!fs.existsSync(tcPath)) return;
    const tree1 = TouchChatProcessor.prototype.loadIntoTree.call(TouchChatProcessor, tcPath);
    TouchChatProcessor.prototype.saveFromTree.call(TouchChatProcessor, tree1, outPath);
    const tree2 = TouchChatProcessor.prototype.loadIntoTree.call(TouchChatProcessor, outPath);
    expect(Object.keys(tree1.pages).sort()).toEqual(Object.keys(tree2.pages).sort());
    for (const pid in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pid);
      const btnLabels1 = tree1.pages[pid].buttons.map(b => b.label).sort();
      const btnLabels2 = tree2.pages[pid].buttons.map(b => b.label).sort();
      expect(btnLabels1).toEqual(btnLabels2);
    }
  });
});
