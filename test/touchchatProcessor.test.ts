// Unit tests for TouchChatProcessor
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { AACTree } from '../src/core/treeStructure';
import path from 'path';

describe('TouchChatProcessor', () => {
  const exampleFile: string = path.join(__dirname, '../examples/example.ce');

  it('should load a .ce file into a tree', () => {
    const processor = new TouchChatProcessor();
    const tree: AACTree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .ce file', () => {
    const processor = new TouchChatProcessor();
    const texts: string[] = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });
});
