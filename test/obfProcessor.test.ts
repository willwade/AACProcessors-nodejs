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

  describe('saveModifiedTree', () => {
    const tempOutputPath = path.join(__dirname, 'temp_obz_modified.obz');
    const tempSaveFromTreePath = path.join(__dirname, 'temp_obz_saveFromTree.obz');

    afterEach(async () => {
      const fs = await import('fs');
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      if (fs.existsSync(tempSaveFromTreePath)) {
        fs.unlinkSync(tempSaveFromTreePath);
      }
    });

    it('should preserve original file size better than saveFromTree for OBZ files', async () => {
      const processor = new ObfProcessor();
      const fs = await import('fs');

      // Load the original file
      const tree = await processor.loadIntoTree(obzPath);
      const originalSize = fs.statSync(obzPath).size;

      // Save using saveModifiedTree
      await processor.saveModifiedTree(obzPath, tree, tempOutputPath);
      const modifiedSize = fs.statSync(tempOutputPath).size;

      // Save using saveFromTree for comparison
      await processor.saveFromTree(tree, tempSaveFromTreePath);
      const saveFromTreeSize = fs.statSync(tempSaveFromTreePath).size;

      // saveModifiedTree should preserve file size much better than saveFromTree
      expect(modifiedSize).toBeGreaterThan(saveFromTreeSize);

      // saveModifiedTree should be at least 80% of original size (preserves most assets)
      expect(modifiedSize / originalSize).toBeGreaterThan(0.8);
    });

    it('should produce a valid loadable OBZ file', async () => {
      const processor = new ObfProcessor();
      const fs = await import('fs');

      // Load the original file
      const tree = await processor.loadIntoTree(obzPath);
      const originalPageCount = Object.keys(tree.pages).length;

      // Save using saveModifiedTree
      await processor.saveModifiedTree(obzPath, tree, tempOutputPath);

      // Load the saved file
      const savedTree = await processor.loadIntoTree(tempOutputPath);

      // Verify the saved tree has the same pages
      expect(Object.keys(savedTree.pages).length).toBe(originalPageCount);
      expect(savedTree.rootId).toBe(tree.rootId);
    });

    it('should handle empty tree by copying original', async () => {
      const processor = new ObfProcessor();
      const fs = await import('fs');

      // Create an empty tree
      const emptyTree: AACTree = {
        pages: {},
        rootId: null,
        toolbarId: null,
        dashboardId: null,
        metadata: {},
        addPage() {
          throw new Error('Not implemented');
        },
        getPage() {
          return undefined;
        },
        traverse() {
          // Empty - nothing to traverse
        },
      };

      // Save using saveModifiedTree
      await processor.saveModifiedTree(obzPath, emptyTree, tempOutputPath);

      // Verify the file was copied (same size)
      const originalSize = fs.statSync(obzPath).size;
      const copiedSize = fs.statSync(tempOutputPath).size;
      expect(copiedSize).toBe(originalSize);
    });
  });
});
