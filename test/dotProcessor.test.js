// Unit test for DotProcessor
const path = require('path');
const { DotProcessor } = require('../dist/processors/dotProcessor');
const { AACTree } = require('../dist/core/treeStructure');

describe('DotProcessor', () => {
  const dotPath = path.join(__dirname, '../examples/example.dot');

  it('can process .dot files and build a navigation tree', () => {
    const processor = new DotProcessor();
    const tree = processor.loadIntoTree(dotPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Root should have navigation buttons
    const rootPage = tree.getPage(tree.rootId);
    expect(rootPage.buttons.length).toBeGreaterThan(0);
    // Buttons should be NAVIGATE type
    rootPage.buttons.forEach(btn => {
      expect(btn.type).toBe('NAVIGATE');
      expect(btn.targetPageId).toBeTruthy();
    });
  });
});
