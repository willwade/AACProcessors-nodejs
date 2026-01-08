// Unit test for DotProcessor
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { AACTree } from '../src/core/treeStructure';

describe('DotProcessor', () => {
  const dotPath: string = path.join(__dirname, 'assets/dot/example.dot');

  it('can process .dot files and build a navigation tree', async () => {
    const processor = new DotProcessor();
    const tree: AACTree = processor.loadIntoTree(dotPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Root should have navigation buttons
    expect(tree.rootId).toBeTruthy();
    const rootId = tree.rootId;
    if (!rootId) {
      return;
    }
    const rootPage = tree.getPage(rootId);
    expect(rootPage).toBeDefined();
    if (!rootPage) {
      return;
    }
    expect(rootPage.buttons.length).toBeGreaterThan(0);
    // Should have navigation buttons
    const navButtons = rootPage.buttons.filter((b) => b.type === 'NAVIGATE');
    expect(navButtons.length).toBeGreaterThan(0);

    navButtons.forEach((btn) => {
      expect(btn.type).toBe('NAVIGATE');
      expect(btn.targetPageId).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      const processor = new DotProcessor();
      expect(() => {
        processor.loadIntoTree('/non/existent/file.dot');
      }).toThrow();
    });

    it('should handle malformed dot content gracefully', async () => {
      const processor = new DotProcessor();
      const malformedContent = Buffer.from('invalid dot content');
      const tree = await processor.loadIntoTree(malformedContent);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });

    it('should handle empty file gracefully', async () => {
      const processor = new DotProcessor();
      const emptyContent = Buffer.from('');
      expect(() => processor.loadIntoTree(emptyContent)).toThrow();
    });

    it('should handle content with only comments', async () => {
      const processor = new DotProcessor();
      const commentContent = Buffer.from('// This is a comment\n// Another comment');
      const tree = await processor.loadIntoTree(commentContent);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });
  });
});
