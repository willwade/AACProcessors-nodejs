// Unit tests for TouchChatProcessor
const { TouchChatProcessor } = require('../dist/processors/touchchatProcessor');
const path = require('path');

describe('TouchChatProcessor', () => {
  const exampleFile = path.join(__dirname, '../examples/example.ce');

  it('should load a .ce file into a tree', () => {
    const processor = new TouchChatProcessor();
    const tree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .ce file', () => {
    const processor = new TouchChatProcessor();
    const texts = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });
});
