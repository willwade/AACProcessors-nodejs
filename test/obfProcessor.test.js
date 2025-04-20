// Test for OBFProcessor (Open Board Format/Zip)
const fs = require('fs');
const path = require('path');
const OBFProcessor = require('../src/processors/obfProcessor');
const { AACButton, AACPage, AACTree } = require('../src/core/treeStructure');

describe('OBFProcessor', () => {
  const obzPath = path.join(__dirname, '../examples/example.obz');

  it('can process .obz (zip) files with manifest', async () => {
    const tree = await OBFProcessor.loadIntoTree(obzPath);
    expect(tree).toBeInstanceOf(AACTree);
    // Should have at least one page
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    // Navigation buttons should link to other pages
    let navFound = false;
    tree.traverse(page => {
      page.buttons.forEach(btn => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) navFound = true;
      });
    });
    expect(navFound).toBe(true);
    // Check image on button if present
    const rootPage = tree.getPage(tree.rootId);
    if (rootPage) {
      const imgBtn = rootPage.buttons.find(b => b.image);
      if (imgBtn) {
        expect(imgBtn.image).toHaveProperty('id');
      }
    }
  });
});
