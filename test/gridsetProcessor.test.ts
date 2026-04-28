// Unit tests for GridsetProcessor
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { AACTree } from "../src/core/treeStructure";
import path from "path";
import fs from "fs";

describe("GridsetProcessor", () => {
  const exampleFile: string = path.join(
    __dirname,
    "assets/gridset/example.gridset",
  );

  it("should load a .gridset file into a tree", async () => {
    const processor = new GridsetProcessor();
    const fileBuffer = fs.readFileSync(exampleFile);
    const tree: AACTree = await processor.loadIntoTree(fileBuffer);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it("should extract all texts from a .gridset file", async () => {
    const processor = new GridsetProcessor();
    const fileBuffer = fs.readFileSync(exampleFile);
    const texts: string[] = await processor.extractTexts(fileBuffer);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  describe("Error Handling", () => {
    it("should throw error for non-existent file", async () => {
      expect(() => {
        fs.readFileSync("/non/existent/file.gridset");
      }).toThrow();
    });

    it("should handle invalid zip content", async () => {
      const processor = new GridsetProcessor();
      const invalidBuffer = Buffer.from("not a zip file");
      await expect(processor.loadIntoTree(invalidBuffer)).rejects.toThrow();
    });

    it("should handle empty buffer", async () => {
      const processor = new GridsetProcessor();
      const emptyBuffer = Buffer.alloc(0);
      await expect(processor.loadIntoTree(emptyBuffer)).rejects.toThrow();
    });
  });

  describe("Home Page Preservation", () => {
    const tempOutputPath = path.join(__dirname, "temp_gridset_test.gridset");

    afterEach(async () => {
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
    });

    it("should preserve home page (tree.rootId) through roundtrip", async () => {
      const processor = new GridsetProcessor();

      // Load the original file
      const fileBuffer = fs.readFileSync(exampleFile);
      const initialTree = await processor.loadIntoTree(fileBuffer);

      // Store the initial rootId (if present)
      const initialRootId = initialTree.rootId;

      // Save to a new file
      await processor.saveFromTree(initialTree, tempOutputPath);

      // Load the saved file
      const savedBuffer = fs.readFileSync(tempOutputPath);
      const finalTree = await processor.loadIntoTree(savedBuffer);

      // Verify rootId is preserved
      expect(finalTree.rootId).toBe(initialRootId);

      // If rootId exists, verify the home page is accessible and matches
      if (finalTree.rootId && initialTree.rootId) {
        const initialHomePage = initialTree.getPage(initialTree.rootId);
        const finalHomePage = finalTree.getPage(finalTree.rootId);

        expect(initialHomePage).toBeDefined();
        expect(finalHomePage).toBeDefined();
        expect(finalHomePage?.name).toBe(initialHomePage?.name);
      }
    });
  });

  describe("saveModifiedTree", () => {
    const tempOutputPath = path.join(
      __dirname,
      "temp_gridset_modified.gridset",
    );
    const tempSaveFromTreePath = path.join(
      __dirname,
      "temp_gridset_saveFromTree.gridset",
    );

    afterEach(async () => {
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      if (fs.existsSync(tempSaveFromTreePath)) {
        fs.unlinkSync(tempSaveFromTreePath);
      }
    });

    it("should preserve original file size better than saveFromTree", async () => {
      const processor = new GridsetProcessor();

      // Load the original file
      const fileBuffer = fs.readFileSync(exampleFile);
      const tree = await processor.loadIntoTree(fileBuffer);
      const originalSize = fileBuffer.length;

      // Save using saveModifiedTree
      await processor.saveModifiedTree(exampleFile, tree, tempOutputPath);
      const modifiedSize = fs.statSync(tempOutputPath).size;

      // Save using saveFromTree for comparison
      await processor.saveFromTree(tree, tempSaveFromTreePath);
      const saveFromTreeSize = fs.statSync(tempSaveFromTreePath).size;

      // saveModifiedTree should preserve file size much better than saveFromTree
      expect(modifiedSize).toBeGreaterThan(saveFromTreeSize);

      // saveModifiedTree should be at least 80% of original size (preserves most assets)
      expect(modifiedSize / originalSize).toBeGreaterThan(0.8);
    });

    it("should produce a valid loadable gridset", async () => {
      const processor = new GridsetProcessor();

      // Load the original file
      const fileBuffer = fs.readFileSync(exampleFile);
      const tree = await processor.loadIntoTree(fileBuffer);
      const originalPageCount = Object.keys(tree.pages).length;

      // Save using saveModifiedTree
      await processor.saveModifiedTree(exampleFile, tree, tempOutputPath);

      // Load the saved file
      const savedBuffer = fs.readFileSync(tempOutputPath);
      const savedTree = await processor.loadIntoTree(savedBuffer);

      // Verify the saved tree has the same pages
      expect(Object.keys(savedTree.pages).length).toBe(originalPageCount);
      expect(savedTree.rootId).toBe(tree.rootId);
    });

    it("should handle empty tree by copying original", async () => {
      const processor = new GridsetProcessor();

      // Create an empty tree
      const emptyTree: AACTree = {
        pages: {},
        rootId: null,
        toolbarId: null,
        dashboardId: null,
        metadata: {},
        addPage() {
          throw new Error("Not implemented");
        },
        getPage() {
          return undefined;
        },
        traverse() {
          // Empty - nothing to traverse
        },
      };

      // Save using saveModifiedTree
      await processor.saveModifiedTree(exampleFile, emptyTree, tempOutputPath);

      // Verify the file was copied (same size)
      const originalSize = fs.statSync(exampleFile).size;
      const copiedSize = fs.statSync(tempOutputPath).size;
      expect(copiedSize).toBe(originalSize);
    });
  });
});
