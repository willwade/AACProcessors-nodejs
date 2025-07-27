// Test for OBFProcessor (Open Board Format/Zip)
import fs from 'fs';
import path from 'path';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { AACButton, AACPage, AACTree } from '../src/core/treeStructure';

describe('OBFProcessor', () => {
  const obzPath: string = path.join(__dirname, '../examples/example.obz');

  it('can process .obz (zip) files with manifest', async () => {
    const processor = new ObfProcessor();
    const tree: AACTree = await processor.loadIntoTree(obzPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Navigation buttons should link to other pages
    let navFound = false;
    tree.traverse((page) => {
      page.buttons.forEach((btn) => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) navFound = true;
      });
    });
    expect(navFound).toBe(true);
    // Check image on button if present
    const rootPage = tree.getPage(tree.rootId!);
    if (rootPage) {
      const imgBtn = rootPage.buttons.find((b: any) => b.image);
      if (imgBtn) {
        expect((imgBtn as any).image).toHaveProperty('id');
      }
    }
  });
});
