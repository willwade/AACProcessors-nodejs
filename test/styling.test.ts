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

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "styling-test-"));
  });

  afterEach(() => {
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
    it("should preserve background and border colors in round-trip", () => {
      const processor = new ObfProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.obf");

      // Save tree to OBF
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from OBF
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBe("#ff0000");
      expect(loadedButton.style?.borderColor).toBe("#990000");
    });
  });

  describe("Snap Processor Styling", () => {
    it("should preserve comprehensive styling in round-trip", () => {
      const processor = new SnapProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.spb");

      // Save tree to Snap
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Snap
      const loadedTree = processor.loadIntoTree(outputPath);
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
    it("should preserve button and page styles in round-trip", () => {
      const processor = new TouchChatProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.ce");

      // Save tree to TouchChat
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from TouchChat
      const loadedTree = processor.loadIntoTree(outputPath);
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
    it("should preserve background colors and metadata styling", () => {
      const processor = new AstericsGridProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.grd");

      // Save tree to Asterics Grid
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Asterics Grid
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBeDefined();
      expect(loadedPage.style?.backgroundColor).toBeDefined();
    });
  });

  describe("Grid 3 Processor Styling", () => {
    it("should create and reference styles correctly", () => {
      const processor = new GridsetProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.gridset");

      // Save tree to Grid 3
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify the zip contains style.xml
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(outputPath);
      const entries = zip.getEntries();
      const hasStyleXml = entries.some(
        (entry: any) => entry.entryName === "style.xml",
      );
      expect(hasStyleXml).toBe(true);
    });
  });

  describe("Apple Panels Processor Styling", () => {
    it("should preserve DisplayColor, FontSize, and DisplayImageWeight", () => {
      const processor = new ApplePanelsProcessor();
      const tree = createStyledTestTree();
      const outputPath = path.join(tempDir, "test.ascconfig");

      // Save tree to Apple Panels
      processor.saveFromTree(tree, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load back from Apple Panels
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = Object.values(loadedTree.pages)[0];
      const loadedButton = loadedPage.buttons[0];

      // Verify styling is preserved
      expect(loadedButton.style?.backgroundColor).toBeDefined();
      expect(loadedButton.style?.fontSize).toBeDefined();
      expect(loadedButton.style?.fontWeight).toBeDefined();
    });
  });

  describe("Cross-Format Styling Compatibility", () => {
    it("should maintain basic styling when converting between formats", () => {
      const obfProcessor = new ObfProcessor();
      const snapProcessor = new SnapProcessor();
      const tree = createStyledTestTree();

      // Save as OBF
      const obfPath = path.join(tempDir, "test.obf");
      obfProcessor.saveFromTree(tree, obfPath);

      // Load from OBF and save as Snap
      const loadedFromObf = obfProcessor.loadIntoTree(obfPath);
      const snapPath = path.join(tempDir, "test.spb");
      snapProcessor.saveFromTree(loadedFromObf, snapPath);

      // Load from Snap and verify styling is maintained
      const loadedFromSnap = snapProcessor.loadIntoTree(snapPath);
      const finalButton = Object.values(loadedFromSnap.pages)[0].buttons[0];

      // Basic styling should be preserved across formats
      expect(finalButton.style?.backgroundColor).toBeDefined();
    });
  });
});
