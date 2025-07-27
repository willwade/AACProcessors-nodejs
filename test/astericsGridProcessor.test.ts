import { AstericsGridProcessor } from "../src/processors/astericsGridProcessor";
import { AACTree, AACButton } from "../src/core/treeStructure";
import path from "path";
import fs from "fs";

describe("AstericsGridProcessor", () => {
  const exampleGrdFile = path.join(__dirname, "../examples/example2.grd");
  const tempOutputPath = path.join(__dirname, "temp_test.grd");

  afterEach(() => {
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  });

  it("should load an Asterics Grid file into an AACTree", () => {
    const processor = new AstericsGridProcessor();
    const tree = processor.loadIntoTree(exampleGrdFile);
    expect(tree).toBeInstanceOf(AACTree);
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it("should extract texts from an Asterics Grid file", () => {
    const processor = new AstericsGridProcessor();
    const texts = processor.extractTexts(exampleGrdFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts).toContain("Change in element");
  });

  it("should process texts and save the changes", () => {
    const processor = new AstericsGridProcessor();
    const translations = new Map<string, string>();
    translations.set("Change in element", "Changed Element");

    const buffer = processor.processTexts(
      exampleGrdFile,
      translations,
      tempOutputPath,
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const newTexts = processor.extractTexts(tempOutputPath);
    expect(newTexts).toContain("Changed Element");
  });

  it("should perform a roundtrip (load -> save -> load)", () => {
    const processor = new AstericsGridProcessor();
    const initialTree = processor.loadIntoTree(exampleGrdFile);
    processor.saveFromTree(initialTree, tempOutputPath);
    const finalTree = processor.loadIntoTree(tempOutputPath);

    expect(Object.keys(finalTree.pages).length).toEqual(
      Object.keys(initialTree.pages).length,
    );
    // More detailed checks could be added here
  });

  it("should handle audio when the loadAudio option is true", () => {
    const processor = new AstericsGridProcessor({ loadAudio: true });
    const tree = processor.loadIntoTree(exampleGrdFile);

    let foundAudioButton = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        if (button.audioRecording) {
          foundAudioButton = true;
          expect(button.audioRecording.data).toBeInstanceOf(Buffer);
        }
      });
    });

    // This depends on the content of example2.grd having audio actions.
    // Based on the docs, GridActionAudio exists. We'll assume the example might have it.
    // If not, this test might need a dedicated test file with audio.
    let content = fs.readFileSync(exampleGrdFile, "utf-8");
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    const fileContent = JSON.parse(content);
    const hasAudioAction = fileContent.grids.some((g: any) =>
      g.gridElements.some((e: any) =>
        e.actions.some((a: any) => a.modelName === "GridActionAudio"),
      ),
    );

    if (hasAudioAction) {
      expect(foundAudioButton).toBe(true);
    } else {
      console.warn(
        "Test file does not contain audio actions, skipping audio assertion",
      );
    }
  });

  it("should extract comprehensive texts including multilingual labels", () => {
    const processor = new AstericsGridProcessor();
    const texts = processor.extractTexts(exampleGrdFile);

    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);

    // Should contain various text elements from the example file
    expect(texts).toContain("Change in element");
    expect(texts).toContain("Global grid");
    expect(texts).toContain("Next wordform");
    expect(texts).toContain("Home");
  });

  it("should handle multilingual content correctly", () => {
    const processor = new AstericsGridProcessor();
    const tree = processor.loadIntoTree(exampleGrdFile);

    // Check that pages are created with proper names
    const pageIds = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);

    // Verify that some pages have meaningful names
    const pageNames = Object.values(tree.pages).map((page) => page.name);
    expect(pageNames.some((name) => name && name.length > 0)).toBe(true);
  });

  it("should handle navigation relationships correctly", () => {
    const processor = new AstericsGridProcessor();
    const tree = processor.loadIntoTree(exampleGrdFile);

    let foundNavigationButton = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        if (button.type === "NAVIGATE" && button.targetPageId) {
          foundNavigationButton = true;
          // Verify the target page exists
          const targetPage = tree.getPage(button.targetPageId);
          expect(targetPage).toBeDefined();
        }
      });
    });

    // The example file should have some navigation buttons
    expect(foundNavigationButton).toBe(true);
  });

  it("should support audio enhancement methods", () => {
    const processor = new AstericsGridProcessor();

    // Test getElementIds method
    const elementIds = processor.getElementIds(exampleGrdFile);
    expect(Array.isArray(elementIds)).toBe(true);
    expect(elementIds.length).toBeGreaterThan(0);

    // Test hasAudioRecording method
    const firstElementId = elementIds[0];
    const hasAudio = processor.hasAudioRecording(
      exampleGrdFile,
      firstElementId,
    );
    expect(typeof hasAudio).toBe("boolean");
  });

  it("should handle word forms and advanced features", () => {
    const processor = new AstericsGridProcessor();
    const texts = processor.extractTexts(exampleGrdFile);

    // The example file contains word forms like "sein", "bin", "bist", etc.
    expect(texts).toContain("sein");
    expect(texts).toContain("bin");
    expect(texts).toContain("am");
  });

  it("should create proper AACButton objects with correct properties", () => {
    const processor = new AstericsGridProcessor();
    const tree = processor.loadIntoTree(exampleGrdFile);

    let foundButtons = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        foundButtons = true;
        expect(button).toBeInstanceOf(AACButton);
        expect(typeof button.id).toBe("string");
        expect(typeof button.label).toBe("string");
        expect(typeof button.message).toBe("string");
        expect(["SPEAK", "NAVIGATE"]).toContain(button.type);
      });
    });

    expect(foundButtons).toBe(true);
  });

  it("should handle buffer input correctly", () => {
    const processor = new AstericsGridProcessor();
    const fileBuffer = fs.readFileSync(exampleGrdFile);

    const tree = processor.loadIntoTree(fileBuffer);
    expect(tree).toBeInstanceOf(AACTree);
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);

    const texts = processor.extractTexts(fileBuffer);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it("should handle comprehensive translation processing", () => {
    const processor = new AstericsGridProcessor();
    const translations = new Map<string, string>();
    translations.set("Change in element", "Elemento Cambiado");
    translations.set("Global grid", "Cuadrícula Global");
    translations.set("Home", "Inicio");

    const buffer = processor.processTexts(
      exampleGrdFile,
      translations,
      tempOutputPath,
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // Verify translations were applied
    const translatedTexts = processor.extractTexts(tempOutputPath);
    expect(translatedTexts).toContain("Elemento Cambiado");
    expect(translatedTexts).toContain("Cuadrícula Global");
    expect(translatedTexts).toContain("Inicio");
  });
});
