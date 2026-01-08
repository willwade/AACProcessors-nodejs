// Test for OBFProcessor (Open Board Format/Zip)
// Test for OBFProcessor (Open Board Format/Zip)
import path from 'path';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { AACTree } from '../src/core/treeStructure';

jest.setTimeout(30000);

describe('OBFProcessor', () => {
  const obzPath: string = path.join(__dirname, 'assets/obz/example.obz');

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
    const rootId = tree.rootId;
    const rootPage = rootId ? tree.getPage(rootId) : undefined;
    if (rootPage) {
      const imgBtn = rootPage.buttons.find((b: any) => b.image);
      if (imgBtn) {
        // Image should now be a data URL string (from embedded OBZ images)
        expect(typeof imgBtn.image).toBe('string');
        expect(imgBtn.image).toMatch(/^data:image\//);
        // resolvedImageEntry should also be set
        expect(imgBtn.resolvedImageEntry).toBe(imgBtn.image);
      }
    }
  });
});
