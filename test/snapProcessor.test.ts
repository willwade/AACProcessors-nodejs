import { SnapProcessor } from "../src/processors/snapProcessor";
import { AACTree } from "../src/core/treeStructure";
import path from "path";

describe("SnapProcessor", () => {
  const exampleFile: string = path.join(__dirname, "../examples/example.spb");
  const exampleSPSFile: string = path.join(
    __dirname,
    "../examples/example.sps",
  );

  it("should extract all texts from a .spb file", () => {
    const processor = new SnapProcessor();
    const texts: string[] = processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it("should extract all texts from a .sps file", () => {
    const processor = new SnapProcessor();
    const texts: string[] = processor.extractTexts(exampleSPSFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it("should load the tree structure from a .spb file and use UniqueId for page ids", () => {
    const processor = new SnapProcessor();
    const tree: AACTree = processor.loadIntoTree(exampleFile);
    expect(tree).toBeTruthy();
    const pageIds: string[] = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);
    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach((id) => {
      expect(id).toMatch(/-/);
    });
  });

  it("should load the tree structure from a .sps file and use UniqueId for page ids", () => {
    const processor = new SnapProcessor();
    const tree: AACTree = processor.loadIntoTree(exampleSPSFile);
    expect(tree).toBeTruthy();
    const pageIds: string[] = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);

    // All page ids should be UUID-like (contain hyphens)
    pageIds.forEach((id) => {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(10);
      expect(id).toMatch(/-/);
    });

    // Check that navigation button targetPageIds are also UniqueIds
    for (const pageId of pageIds) {
      const page = tree.pages[pageId];
      for (const btn of page.buttons) {
        if (btn.type === "NAVIGATE") {
          expect(typeof btn.targetPageId).toBe("string");
          expect(btn.targetPageId).toMatch(/-/);
        }
      }
    }
  });

  describe("Error Handling", () => {
    it("should throw error for non-existent file", () => {
      const processor = new SnapProcessor();
      expect(() => {
        processor.loadIntoTree("/non/existent/file.spb");
      }).toThrow();
    });

    it("should handle invalid buffer input", () => {
      const processor = new SnapProcessor();
      const invalidBuffer = Buffer.from("not a database file");
      expect(() => {
        processor.loadIntoTree(invalidBuffer);
      }).toThrow();
    });

    it("should handle empty file path", () => {
      const processor = new SnapProcessor();
      expect(() => {
        processor.loadIntoTree("");
      }).toThrow();
    });
  });

  describe("Audio Options", () => {
    it("should create processor with audio loading disabled by default", () => {
      const processor = new SnapProcessor();
      expect(processor).toBeDefined();
      // Audio loading is private, but we can test the behavior
    });

    it("should create processor with audio loading enabled", () => {
      const processor = new SnapProcessor(null, { loadAudio: true });
      expect(processor).toBeDefined();
    });

    it("should create processor with symbol resolver", () => {
      const mockResolver = { resolve: jest.fn() };
      const processor = new SnapProcessor(mockResolver);
      expect(processor).toBeDefined();
    });
  });
});
