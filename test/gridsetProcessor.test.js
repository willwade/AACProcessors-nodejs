// Unit tests for GridsetProcessor
const { GridsetProcessor } = require('../dist/processors/gridsetProcessor');
const path = require('path');

describe('GridsetProcessor', () => {
  const exampleFile = path.join(__dirname, '../examples/example.gridset');

  it('should load a .gridset file into a tree', () => {
    const processor = new GridsetProcessor();
    const tree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .gridset file', () => {
    const processor = new GridsetProcessor();
    const texts = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });
});
