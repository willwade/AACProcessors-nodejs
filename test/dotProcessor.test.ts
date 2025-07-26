// Unit test for DotProcessor
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { AACTree } from '../src/core/treeStructure';

describe('DotProcessor', () => {
  const dotPath: string = path.join(__dirname, '../examples/example.dot');

  it('can process .dot files and build a navigation tree', () => {
    const processor = new DotProcessor();
    const tree: AACTree = processor.loadIntoTree(dotPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Root should have navigation buttons
    expect(tree.rootId).toBeTruthy();
    const rootPage = tree.getPage(tree.rootId!);
    expect(rootPage).toBeDefined();
    expect(rootPage!.buttons.length).toBeGreaterThan(0);
    // Buttons should be NAVIGATE type
    rootPage!.buttons.forEach(btn => {
      expect(btn.type).toBe('NAVIGATE');
      expect(btn.targetPageId).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', () => {
      const processor = new DotProcessor();
      expect(() => {
        processor.loadIntoTree('/non/existent/file.dot');
      }).toThrow();
    });

    it('should handle malformed dot content gracefully', () => {
      const processor = new DotProcessor();
      const malformedContent = Buffer.from('invalid dot content');
      const tree = processor.loadIntoTree(malformedContent);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });

    it('should handle empty file gracefully', () => {
      const processor = new DotProcessor();
      const emptyContent = Buffer.from('');
      const tree = processor.loadIntoTree(emptyContent);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const processor = new DotProcessor();
      const commentContent = Buffer.from('// This is a comment\n// Another comment');
      const tree = processor.loadIntoTree(commentContent);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });
  });
});
