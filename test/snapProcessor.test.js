const { SnapProcessor } = require('../dist/processors/snapProcessor');
const path = require('path');

describe('SnapProcessor', () => {
  const exampleFile = path.join(__dirname, '../examples/example.spb');
  const exampleSPSFile = path.join(__dirname, '../examples/example.sps');

  it('should extract all texts from a .spb file', () => {
    const processor = new SnapProcessor();
    const texts = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .sps file', () => {
    const processor = new SnapProcessor();
    const texts = processor.extractTexts(exampleSPSFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should load the tree structure from a .spb file and use UniqueId for page ids', () => {
    const processor = new SnapProcessor();
    const tree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeTruthy();
    const pageIds = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);
    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach(id => {
      expect(id).toMatch(/-/);
    });
  });

  it('should load the tree structure from a .sps file and use UniqueId for page ids', () => {
    const processor = new SnapProcessor();
    const tree = processor.loadIntoTree(exampleSPSFile);
    expect(tree).toBeTruthy();
    const pageIds = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);

    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach(id => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
      expect(id).toMatch(/-/);
    });

    // Check that navigation button targetPageIds are also UniqueIds
    for (const pageId of pageIds) {
      const page = tree.pages[pageId];
      for (const btn of page.buttons) {
        if (btn.type === 'NAVIGATE') {
          expect(typeof btn.targetPageId).toBe('string');
          expect(btn.targetPageId).toMatch(/-/);
        }
      }
    }
  });
});
