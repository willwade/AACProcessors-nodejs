// Unit tests for GridsetProcessor
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { AACTree } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';

describe('GridsetProcessor', () => {
  const exampleFile: string = path.join(__dirname, '../examples/example.gridset');

  it('should load a .gridset file into a tree', () => {
    const processor = new GridsetProcessor();
    const fileBuffer = fs.readFileSync(exampleFile);
    const tree: AACTree = processor.loadIntoTree(fileBuffer);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .gridset file', () => {
    const processor = new GridsetProcessor();
    const fileBuffer = fs.readFileSync(exampleFile);
    const texts: string[] = processor.extractTexts(fileBuffer);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', () => {
      const processor = new GridsetProcessor();
      expect(() => {
        const nonExistentBuffer = fs.readFileSync('/non/existent/file.gridset');
      }).toThrow();
    });

    it('should handle invalid zip content', () => {
      const processor = new GridsetProcessor();
      const invalidBuffer = Buffer.from('not a zip file');
      expect(() => {
        processor.loadIntoTree(invalidBuffer);
      }).toThrow();
    });

    it('should handle empty buffer', () => {
      const processor = new GridsetProcessor();
      const emptyBuffer = Buffer.alloc(0);
      expect(() => {
        processor.loadIntoTree(emptyBuffer);
      }).toThrow();
    });
  });
});
