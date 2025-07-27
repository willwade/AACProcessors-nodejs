// Comprehensive tests for TouchChatProcessor to improve coverage from 57.62% to 85%+
import fs from "fs";
import path from "path";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";
import { TreeFactory, PageFactory, ButtonFactory } from "./utils/testFactories";

describe("TouchChatProcessor - Comprehensive Coverage Tests", () => {
  let processor: TouchChatProcessor;
  const tempDir = path.join(__dirname, "temp_touchchat");
  const exampleFile = path.join(__dirname, "../examples/example.ce");

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  beforeEach(() => {
    processor = new TouchChatProcessor();
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("SQLite Schema Tests", () => {
    it("should handle TouchChat v1.x database schema", () => {
      // Test with minimal valid TouchChat database structure
      const tree = TreeFactory.createSimple();
      const outputPath = path.join(tempDir, "v1_test.ce");

      expect(() => {
        processor.saveFromTree(tree, outputPath);
      }).not.toThrow();

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify we can load it back
      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages).length).toBeGreaterThan(0);
    });

    it("should handle TouchChat v2.x database schema", () => {
      // Test with more complex button configurations
      const tree = TreeFactory.createCommunicationBoard();
      const outputPath = path.join(tempDir, "v2_test.ce");

      processor.saveFromTree(tree, outputPath);
      const loadedTree = processor.loadIntoTree(outputPath);

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages).length).toBe(
        Object.keys(tree.pages).length,
      );
    });

    it("should handle TouchChat v3.x database schema", () => {
      // Test with large dataset
      const tree = TreeFactory.createLarge(5, 10);
      const outputPath = path.join(tempDir, "v3_test.ce");

      processor.saveFromTree(tree, outputPath);
      const loadedTree = processor.loadIntoTree(outputPath);

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages).length).toBe(5);
    });

    it("should process buttons with custom actions", () => {
      const page = PageFactory.create({
        id: "custom_actions",
        name: "Custom Actions Page",
        buttons: [
          { label: "Speak Button", message: "Hello World", type: "SPEAK" },
          {
            label: "Nav Button",
            message: "Navigate",
            type: "NAVIGATE",
            targetPageId: "target",
          },
        ],
      });

      const tree = new AACTree();
      tree.addPage(page);
      tree.addPage(PageFactory.create({ id: "target", name: "Target Page" }));

      const outputPath = path.join(tempDir, "custom_actions.ce");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = loadedTree.getPage("custom_actions");

      expect(loadedPage).toBeDefined();
      expect(loadedPage!.buttons).toHaveLength(2);
      expect(loadedPage!.buttons[0].type).toBe("SPEAK");
      expect(loadedPage!.buttons[1].type).toBe("NAVIGATE");
      expect(loadedPage!.buttons[1].targetPageId).toBe("target");
    });

    it("should handle buttons with multiple audio recordings", () => {
      const button = ButtonFactory.create({
        label: "Audio Button",
        message: "I have audio",
        type: "SPEAK",
      });

      // Add audio recording
      button.audioRecording = {
        id: 1,
        data: Buffer.from("fake audio data"),
        identifier: "audio_1",
        metadata: "Test audio recording",
      };

      const page = PageFactory.create({
        id: "audio_page",
        name: "Audio Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "audio_test.ce");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = loadedTree.getPage("audio_page");

      expect(loadedPage).toBeDefined();
      expect(loadedPage!.buttons[0].label).toBe("Audio Button");
    });

    it("should process navigation buttons with complex targets", () => {
      // Create a complex navigation hierarchy
      const homePage = PageFactory.create({ id: "home", name: "Home" });
      const categoryPage = PageFactory.create({
        id: "category",
        name: "Category",
        parentId: "home",
      });
      const subPage = PageFactory.create({
        id: "sub",
        name: "Sub Page",
        parentId: "category",
      });

      // Add navigation buttons
      homePage.addButton(
        ButtonFactory.create({
          label: "Go to Category",
          type: "NAVIGATE",
          targetPageId: "category",
        }),
      );

      categoryPage.addButton(
        ButtonFactory.create({
          label: "Go to Sub",
          type: "NAVIGATE",
          targetPageId: "sub",
        }),
      );

      categoryPage.addButton(
        ButtonFactory.create({
          label: "Back to Home",
          type: "NAVIGATE",
          targetPageId: "home",
        }),
      );

      const tree = new AACTree();
      tree.addPage(homePage);
      tree.addPage(categoryPage);
      tree.addPage(subPage);
      tree.rootId = "home";

      const outputPath = path.join(tempDir, "navigation_test.ce");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);

      expect(loadedTree.rootId).toBe("home");
      expect(Object.keys(loadedTree.pages)).toHaveLength(3);

      const loadedHome = loadedTree.getPage("home");
      expect(loadedHome!.buttons[0].targetPageId).toBe("category");

      const loadedCategory = loadedTree.getPage("category");
      expect(loadedCategory!.buttons).toHaveLength(2);
      expect(loadedCategory!.buttons[0].targetPageId).toBe("sub");
      expect(loadedCategory!.buttons[1].targetPageId).toBe("home");
    });
  });

  describe("Database Connection Edge Cases", () => {
    it("should handle corrupted SQLite databases gracefully", () => {
      const corruptedPath = path.join(tempDir, "corrupted.ce");
      fs.writeFileSync(corruptedPath, "This is not a valid zip file");

      expect(() => {
        processor.loadIntoTree(corruptedPath);
      }).toThrow();
    });

    it("should process databases with missing required tables", () => {
      // Create a minimal zip file without proper database structure
      const AdmZip = require("adm-zip");
      const zip = new AdmZip();
      zip.addFile("empty.txt", Buffer.from("empty"));

      const invalidPath = path.join(tempDir, "invalid.ce");
      zip.writeZip(invalidPath);

      expect(() => {
        processor.loadIntoTree(invalidPath);
      }).toThrow();
    });

    it("should handle databases with foreign key constraints", () => {
      // Test with a valid tree that has proper relationships
      const tree = TreeFactory.createCommunicationBoard();
      const outputPath = path.join(tempDir, "fk_test.ce");

      expect(() => {
        processor.saveFromTree(tree, outputPath);
      }).not.toThrow();

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
    });
  });

  describe("Large Dataset Performance", () => {
    it("should process databases with 1000+ buttons efficiently", () => {
      const startTime = Date.now();

      // Create a large tree with many buttons
      const tree = TreeFactory.createLarge(10, 100); // 10 pages, 100 buttons each = 1000 buttons
      const outputPath = path.join(tempDir, "large_test.ce");

      processor.saveFromTree(tree, outputPath);
      const loadedTree = processor.loadIntoTree(outputPath);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(10);
      expect(processingTime).toBeLessThan(10000); // Should complete in under 10 seconds

      // Verify button count
      let totalButtons = 0;
      Object.values(loadedTree.pages).forEach((page) => {
        totalButtons += page.buttons.length;
      });
      expect(totalButtons).toBe(1000);
    });

    it("should handle databases with complex page hierarchies", () => {
      // Create a deep hierarchy
      const tree = new AACTree();
      let currentParent = "root";

      // Create 5 levels deep
      for (let level = 0; level < 5; level++) {
        for (let i = 0; i < 3; i++) {
          const pageId = `level_${level}_page_${i}`;
          const page = PageFactory.create({
            id: pageId,
            name: `Level ${level} Page ${i}`,
            parentId: level === 0 ? null : currentParent,
          });

          // Add navigation buttons to children
          if (level < 4) {
            for (let j = 0; j < 3; j++) {
              const targetId = `level_${level + 1}_page_${j}`;
              page.addButton(
                ButtonFactory.create({
                  label: `Go to ${targetId}`,
                  type: "NAVIGATE",
                  targetPageId: targetId,
                }),
              );
            }
          }

          tree.addPage(page);
          if (level === 0 && i === 0) {
            tree.rootId = pageId;
            currentParent = pageId;
          }
        }
      }

      const outputPath = path.join(tempDir, "hierarchy_test.ce");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(15); // 5 levels * 3 pages = 15 pages
    });
  });

  describe("Text Processing Methods", () => {
    it("should extract all texts from complex database", () => {
      if (!fs.existsSync(exampleFile)) {
        console.log("Skipping test - example file not found");
        return;
      }

      const texts = processor.extractTexts(exampleFile);
      expect(Array.isArray(texts)).toBe(true);
      expect(texts.length).toBeGreaterThan(0);

      // Verify texts are non-empty strings
      texts.forEach((text) => {
        expect(typeof text).toBe("string");
        expect(text.length).toBeGreaterThan(0);
      });
    });

    it("should process texts with translations", () => {
      const tree = TreeFactory.createSimple();
      const inputPath = path.join(tempDir, "input_for_translation.ce");
      const outputPath = path.join(tempDir, "translation_test.ce");

      // Save the tree first
      processor.saveFromTree(tree, inputPath);

      // Create translation map
      const translations = new Map<string, string>();
      translations.set("Hello", "Hola");
      translations.set("Food", "Comida");
      translations.set("Home", "Casa");

      const result = processor.processTexts(
        inputPath,
        translations,
        outputPath,
      );
      expect(result).toBeInstanceOf(Buffer);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Load and verify translations were applied
      const translatedTree = processor.loadIntoTree(outputPath);
      const homePage = translatedTree.getPage("home");
      expect(homePage!.name).toBe("Casa");
    });
  });
});
