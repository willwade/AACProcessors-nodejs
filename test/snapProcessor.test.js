const SnapProcessor = require('../src/processors/snapProcessor');
const path = require('path');

describe('SnapProcessor', () => {
  const exampleFile = path.join(__dirname, '../examples/example.sps');

  it('should extract all texts from a .sps file', () => {
    const processor = new SnapProcessor();
    const texts = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should load the tree structure from a .sps file', () => {
    const processor = new SnapProcessor();
    const tree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeTruthy();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });
});
