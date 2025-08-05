// Unit test for OPMLProcessor
import path from 'path';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { AACTree } from '../src/core/treeStructure';

describe('OPMLProcessor', () => {
  const opmlPath: string = path.join(__dirname, '../examples/example.opml');

  it('can process .opml files and build a navigation tree', () => {
    const processor = new OpmlProcessor();
    const tree: AACTree = processor.loadIntoTree(opmlPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Super root should have a navigation button to root
    const superRoot = tree.getPage(tree.rootId!);
    expect(superRoot).toBeDefined();
    expect(superRoot!.buttons.length).toBeGreaterThan(0);
    // There should be at least one navigation button in the tree
    let navFound = false;
    tree.traverse((page) => {
      page.buttons.forEach((btn) => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) navFound = true;
      });
    });
    expect(navFound).toBe(true);
  });
});
