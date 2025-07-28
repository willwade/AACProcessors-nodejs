import { getProcessor, analyze } from "../../src/core/analyze";
import { DotProcessor } from "../../src/processors/dotProcessor";
import { OpmlProcessor } from "../../src/processors/opmlProcessor";
import { ObfProcessor } from "../../src/processors/obfProcessor";
import { SnapProcessor } from "../../src/processors/snapProcessor";
import { GridsetProcessor } from "../../src/processors/gridsetProcessor";
import { TouchChatProcessor } from "../../src/processors/touchchatProcessor";
import { ApplePanelsProcessor } from "../../src/processors/applePanelsProcessor";
import { TreeFactory } from "../utils/testFactories";
import path from "path";
import fs from "fs";
import os from "os";

describe("analyze", () => {
  describe("getProcessor", () => {
    it('should return a DotProcessor for "dot"', () => {
      expect(getProcessor("dot")).toBeInstanceOf(DotProcessor);
    });

    it('should return a OpmlProcessor for "opml"', () => {
      expect(getProcessor("opml")).toBeInstanceOf(OpmlProcessor);
    });

    it('should return a ObfProcessor for "obf"', () => {
      expect(getProcessor("obf")).toBeInstanceOf(ObfProcessor);
    });

    it('should return a SnapProcessor for "snap"', () => {
      expect(getProcessor("snap")).toBeInstanceOf(SnapProcessor);
    });

    it('should return a SnapProcessor for "sps" extension', () => {
      expect(getProcessor("sps")).toBeInstanceOf(SnapProcessor);
    });

    it('should return a SnapProcessor for "spb" extension', () => {
      expect(getProcessor("spb")).toBeInstanceOf(SnapProcessor);
    });

    it('should return a GridsetProcessor for "gridset"', () => {
      expect(getProcessor("gridset")).toBeInstanceOf(GridsetProcessor);
    });

    it('should return a GridsetProcessor for "grd" extension', () => {
      expect(getProcessor("grd")).toBeInstanceOf(GridsetProcessor);
    });

    it('should return a TouchChatProcessor for "touchchat"', () => {
      expect(getProcessor("touchchat")).toBeInstanceOf(TouchChatProcessor);
    });

    it('should return a TouchChatProcessor for "ce" extension', () => {
      expect(getProcessor("ce")).toBeInstanceOf(TouchChatProcessor);
    });

    it('should return a ApplePanelsProcessor for "applepanels"', () => {
      expect(getProcessor("applepanels")).toBeInstanceOf(ApplePanelsProcessor);
    });

    it('should return a ApplePanelsProcessor for "panels"', () => {
      expect(getProcessor("panels")).toBeInstanceOf(ApplePanelsProcessor);
    });

    it("should be case-insensitive", () => {
      expect(getProcessor("DOT")).toBeInstanceOf(DotProcessor);
      expect(getProcessor("OPML")).toBeInstanceOf(OpmlProcessor);
      expect(getProcessor("SNAP")).toBeInstanceOf(SnapProcessor);
    });

    it("should handle empty string format", () => {
      expect(() => getProcessor("")).toThrow("Unknown format: ");
    });

    it("should handle null/undefined format", () => {
      expect(() => getProcessor(null as any)).toThrow("Unknown format: ");
      expect(() => getProcessor(undefined as any)).toThrow("Unknown format: ");
    });

    it("should throw an error for an unknown format", () => {
      expect(() => getProcessor("unknown")).toThrow("Unknown format: unknown");
      expect(() => getProcessor("xyz")).toThrow("Unknown format: xyz");
    });
  });

  describe("analyze", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "analyze-test-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should analyze a DOT file and return a tree", () => {
      const tempFile = path.join(tempDir, "test.dot");
      fs.writeFileSync(tempFile, 'digraph G { "Home" -> "Food"; }');

      const { tree } = analyze(tempFile, "dot");
      expect(tree).toBeDefined();
      expect(tree.pages).toBeDefined();
    });

    it("should analyze an OPML file and return a tree", () => {
      // Create a test OPML file using TreeFactory
      const tree = TreeFactory.createSimple();
      const processor = new OpmlProcessor();
      const tempFile = path.join(tempDir, "test.opml");
      processor.saveFromTree(tree, tempFile);

      const { tree: analyzedTree } = analyze(tempFile, "opml");
      expect(analyzedTree).toBeDefined();
      expect(analyzedTree.pages).toBeDefined();
      // OPML processor may create additional pages for circular references
      expect(Object.keys(analyzedTree.pages).length).toBeGreaterThanOrEqual(2);
    });

    it("should handle file reading errors", () => {
      const nonExistentFile = path.join(tempDir, "nonexistent.opml");

      expect(() => analyze(nonExistentFile, "opml")).toThrow();
    });

    it("should handle invalid format in analyze", () => {
      // Create a dummy file
      const tempFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(tempFile, "dummy content");

      expect(() => analyze(tempFile, "invalid")).toThrow(
        "Unknown format: invalid",
      );
    });

    it("should work with different file formats", () => {
      const tree = TreeFactory.createSimple();

      // Test DOT format
      const dotProcessor = new DotProcessor();
      const dotFile = path.join(tempDir, "test.dot");
      dotProcessor.saveFromTree(tree, dotFile);

      const dotResult = analyze(dotFile, "dot");
      expect(dotResult).toHaveProperty("tree");
      expect(dotResult.tree).toBeDefined();

      // Test OPML format
      const opmlProcessor = new OpmlProcessor();
      const opmlFile = path.join(tempDir, "test.opml");
      opmlProcessor.saveFromTree(tree, opmlFile);

      const opmlResult = analyze(opmlFile, "opml");
      expect(opmlResult).toHaveProperty("tree");
      expect(opmlResult.tree).toBeDefined();
    });

    it("should return tree with correct structure", () => {
      const tree = TreeFactory.createCommunicationBoard();
      const processor = new OpmlProcessor();
      const tempFile = path.join(tempDir, "communication.opml");
      processor.saveFromTree(tree, tempFile);

      const { tree: analyzedTree } = analyze(tempFile, "opml");
      expect(analyzedTree).toBeDefined();
      expect(analyzedTree.pages).toBeDefined();
      expect(Object.keys(analyzedTree.pages).length).toBeGreaterThan(0);
    });
  });
});
