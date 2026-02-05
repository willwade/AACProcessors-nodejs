import { SnapProcessor } from '../src/processors/snapProcessor';
import { AACTree } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';

describe('SnapProcessor', () => {
  const exampleFile: string = path.join(__dirname, 'assets/snap/example.spb');
  const exampleSPSFile: string = path.join(__dirname, 'assets/snap/example.sps');
  const exampleSubZipFile: string = path.join(__dirname, 'assets/snap/example.sub.zip');

  it('should extract all texts from a .spb file', async () => {
    const processor = new SnapProcessor();
    const texts: string[] = await processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should extract all texts from a .sps file', async () => {
    const processor = new SnapProcessor();
    const texts: string[] = await processor.extractTexts(exampleSPSFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should load the tree structure from a .spb file and use UniqueId for page ids', async () => {
    const processor = new SnapProcessor();
    const tree: AACTree = await processor.loadIntoTree(exampleFile);
    expect(tree).toBeTruthy();
    const pageIds: string[] = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);
    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach((id) => {
      expect(id).toMatch(/-/);
    });
  });

  it('should load the tree structure from a .sps file and use UniqueId for page ids', async () => {
    const processor = new SnapProcessor();
    const tree: AACTree = await processor.loadIntoTree(exampleSPSFile);
    expect(tree).toBeTruthy();
    const pageIds: string[] = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);

    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach((id) => {
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

  it('should handle .sub.zip files by extracting and processing the embedded .sps file', async () => {
    const processor = new SnapProcessor();
    // Skip test if example .sub.zip file doesn't exist
    if (!fs.existsSync(exampleSubZipFile)) {
      console.warn(`Skipping .sub.zip test - file not found: ${exampleSubZipFile}`);
      return;
    }
    const tree: AACTree = await processor.loadIntoTree(exampleSubZipFile);
    expect(tree).toBeTruthy();
    const pageIds: string[] = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      const processor = new SnapProcessor();
      await expect(processor.loadIntoTree('/non/existent/file.spb')).rejects.toThrow();
    });

    it('should handle invalid buffer input', async () => {
      const processor = new SnapProcessor();
      const invalidBuffer = Buffer.from('not a database file');
      await expect(processor.loadIntoTree(invalidBuffer)).rejects.toThrow();
    });

    it('should handle empty file path', async () => {
      const processor = new SnapProcessor();
      await expect(processor.loadIntoTree('')).rejects.toThrow();
    });
  });

  describe('Audio Options', () => {
    it('should create processor with audio loading disabled by default', async () => {
      const processor = new SnapProcessor();
      expect(processor).toBeDefined();
      // Audio loading is private, but we can test the behavior
    });

    it('should create processor with audio loading enabled', async () => {
      const processor = new SnapProcessor(null, { loadAudio: true });
      expect(processor).toBeDefined();
    });

    it('should create processor with symbol resolver', async () => {
      const mockResolver = { resolve: jest.fn() };
      const processor = new SnapProcessor(mockResolver);
      expect(processor).toBeDefined();
    });
  });
});
