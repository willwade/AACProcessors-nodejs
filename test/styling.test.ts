import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";
import os from "os";
import { ObfProcessor } from "../src/processors/obfProcessor";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { AstericsGridProcessor } from "../src/processors/astericsGridProcessor";
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { ApplePanelsProcessor } from "../src/processors/applePanelsProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";

describe("Styling Support Tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "styling-test-"));
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper function to create a test tree with styling
  const createStyledTestTree = (): AACTree => {
    const tree = new AACTree();

    const page = new AACPage({
      id: "test-page-1",
      name: "Test Page",
      grid: [],
      buttons: [],
      parentId: null,
      style: {
        backgroundColor: "#f0f0f0",
        borderColor: "#cccccc",
        fontFamily: "Arial",
        fontSize: 16,
      },
    });

    const button1 = new AACButton({
      id: "btn-1",
      label: "Hello",
      message: "Hello World",
      type: "SPEAK",
      action: null,
      style: {
        backgroundColor: "#ff0000",
        fontColor: "#ffffff",
        borderColor: "#990000",
        borderWidth: 2,
        fontSize: 18,
        fontFamily: "Helvetica",
        fontWeight: "bold",
        fontStyle: "normal",
        textUnderline: false,
        labelOnTop: true,
        transparent: false,
      },
    });

    const button2 = new AACButton({
      id: "btn-2",
      label: "Navigate",
      message: "Go to page 2",
      type: "NAVIGATE",
      targetPageId: "test-page-2",
      action: {
        type: "NAVIGATE",
        targetPageId: "test-page-2",
      },
      style: {
        backgroundColor: "#00ff00",
        fontColor: "#000000",
        borderColor: "#009900",
        borderWidth: 1,
        fontSize: 14,
        fontFamily: "Times",
        fontWeight: "normal",
        fontStyle: "italic",
        textUnderline: true,
        labelOnTop: false,
        transparent: true,
      },
    });

    page.addButton(button1);
    page.addButton(button2);
    tree.addPage(page);

    return tree;
  };

  describe("OBF Processor Styling", () => {
    it("should preserve background and border colors in round-trip", async () => {
      const processor = new ObfProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.obf");

      // Save tree to OBF
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from OBF
      const loadedTree = await processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBe("#ff0000");
      expect(loadedButton.style?.borderColor).toBe("#990000");
    });
  });

  describe("Snap Processor Styling", () => {
    it("should preserve comprehensive styling in round-trip", async () => {
      const processor = new SnapProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.spb");

      // Save tree to Snap
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Snap
      const loadedTree = await processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify comprehensive styling is preserved
      expect(loadedButton.style?.backgroundColor).toBe("#ff0000");
      expect(loadedButton.style?.fontColor).toBe("#ffffff");
      expect(loadedButton.style?.borderColor).toBe("#990000");
      expect(loadedButton.style?.borderWidth).toBe(2);
      expect(loadedButton.style?.fontSize).toBe(18);
      expect(loadedButton.style?.fontFamily).toBe("Helvetica");
      expect(loadedPage.style?.backgroundColor).toBe("#f0f0f0");
    });
  });

  describe("TouchChat Processor Styling", () => {
    it("should preserve button and page styles in round-trip", async () => {
      const processor = new TouchChatProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.ce");

      // Save tree to TouchChat
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from TouchChat
      const loadedTree = await processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBeDefined();
      expect(loadedButton.style?.fontColor).toBeDefined();
      expect(loadedButton.style?.borderColor).toBeDefined();
      expect(loadedButton.style?.fontWeight).toBeDefined();
      expect(loadedButton.style?.labelOnTop).toBeDefined();
      expect(loadedButton.style?.transparent).toBeDefined();
    });
  });

  describe("Asterics Grid Processor Styling", () => {
    it("should preserve background colors and metadata styling", async () => {
      const processor = new AstericsGridProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.grd");

      // Save tree to Asterics Grid
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Asterics Grid
      const loadedTree = await processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBeDefined();
      expect(loadedPage.style?.backgroundColor).toBeDefined();
    });
  });

  describe("Grid 3 Processor Styling", () => {
    it("should create and reference styles correctly", async () => {
      const processor = new GridsetProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.gridset");

      // Save tree to Grid 3
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify the zip contains style.xml
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(outputPath);
      const entries = zip.getEntries();
      const hasStyleXml = entries.some(
        (entry: any) =>
          entry.entryName.endsWith("styles.xml") ||
          entry.entryName.endsWith("style.xml"),
      );
      expect(hasStyleXml).toBe(true);
    });
  });

  describe("Apple Panels Processor Styling", () => {
    it("should preserve DisplayColor, FontSize, and DisplayImageWeight", async () => {
      const processor = new ApplePanelsProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.ascconfig");

      // Save tree to Apple Panels
      await processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Apple Panels
      const loadedTree = await processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBeDefined();
      expect(loadedButton.style?.fontSize).toBeDefined();
      expect(loadedButton.style?.fontWeight).toBeDefined();
    });
  });

  describe("Cross-Format Styling Compatibility", () => {
    it("should maintain basic styling when converting between formats", async () => {
      const obfProcessor = new ObfProcessor();
      const snapProcessor = new SnapProcessor();
      const tree = createStyledTestTree();

      // Save as OBF
      const obfPath = path.join(tempDir, "test.obf");
      await obfProcessor.saveFromTree(tree, obfPath);

      // Load from OBF and save as Snap
      const loadedFromObf = await obfProcessor.loadIntoTree(obfPath);
      const snapPath = path.join(tempDir, "test.spb");
      await snapProcessor.saveFromTree(loadedFromObf, snapPath);

      // Load from Snap and verify styling is maintained
      const loadedFromSnap = await snapProcessor.loadIntoTree(snapPath);
      const finalButton = Object.values(loadedFromSnap.pages)[0].buttons[0];

      // Basic styling should be preserved across formats
      expect(finalButton.style?.backgroundColor).toBeDefined();
    });
  });
});
