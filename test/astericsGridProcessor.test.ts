import { AstericsGridProcessor } from '../src/processors/astericsGridProcessor';
import { AACTree, AACButton, AACSemanticCategory } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';

describe('AstericsGridProcessor', () => {
  const exampleGrdFile = path.join(__dirname, 'assets/asterics/example2.grd');
  const tempOutputPath = path.join(__dirname, 'temp_test.grd');

  afterEach(async () => {
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  });

  it('should load an Asterics Grid file into an AACTree', async () => {
    const processor = new AstericsGridProcessor();
    const tree = await processor.loadIntoTree(exampleGrdFile);
    expect(tree).toBeInstanceOf(AACTree);
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract texts from an Asterics Grid file', async () => {
    const processor = new AstericsGridProcessor();
    const texts = await processor.extractTexts(exampleGrdFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts).toContain('Change in element');
  });

  it('should process texts and save the changes', async () => {
    const processor = new AstericsGridProcessor();
    const translations = new Map<string, string>();
    translations.set('Change in element', 'Changed Element');

    const buffer = await processor.processTexts(exampleGrdFile, translations, tempOutputPath);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const newTexts = await processor.extractTexts(tempOutputPath);
    expect(newTexts).toContain('Changed Element');
  });

  it('should perform a roundtrip (load -> save -> load)', async () => {
    const processor = new AstericsGridProcessor();
    const initialTree = await processor.loadIntoTree(exampleGrdFile);
    await processor.saveFromTree(initialTree, tempOutputPath);
    const finalTree = await processor.loadIntoTree(tempOutputPath);

    expect(Object.keys(finalTree.pages).length).toEqual(Object.keys(initialTree.pages).length);
    // More detailed checks could be added here
  });

  it('should handle audio when the loadAudio option is true', async () => {
    const processor = new AstericsGridProcessor({ loadAudio: true });
    const tree = await processor.loadIntoTree(exampleGrdFile);

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
    let content = fs.readFileSync(exampleGrdFile, 'utf-8');
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    const fileContent = JSON.parse(content);
    const hasAudioAction = fileContent.grids.some((g: any) =>
      g.gridElements.some((e: any) => e.actions.some((a: any) => a.modelName === 'GridActionAudio'))
    );

    if (hasAudioAction) {
      expect(foundAudioButton).toBe(true);
    } else {
      console.warn('Test file does not contain audio actions, skipping audio assertion');
    }
  });

  it('should extract comprehensive texts including multilingual labels', async () => {
    const processor = new AstericsGridProcessor();
    const texts = await processor.extractTexts(exampleGrdFile);

    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);

    // Should contain various text elements from the example file
    expect(texts).toContain('Change in element');
    expect(texts).toContain('Global grid');
    expect(texts).toContain('Next wordform');
    expect(texts).toContain('Home');
  });

  it('should handle multilingual content correctly', async () => {
    const processor = new AstericsGridProcessor();
    const tree = await processor.loadIntoTree(exampleGrdFile);

    // Check that pages are created with proper names
    const pageIds = Object.keys(tree.pages);
    expect(pageIds.length).toBeGreaterThan(0);

    // Verify that some pages have meaningful names
    const pageNames = Object.values(tree.pages).map((page) => page.name);
    expect(pageNames.some((name) => name && name.length > 0)).toBe(true);
  });

  it('should handle navigation relationships correctly', async () => {
    const processor = new AstericsGridProcessor();
    const tree = await processor.loadIntoTree(exampleGrdFile);

    let foundNavigationButton = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        // Check using semantic action system instead of button.type
        if (
          button.semanticAction?.category === AACSemanticCategory.NAVIGATION &&
          button.targetPageId
        ) {
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

  it('should support audio enhancement methods', async () => {
    const processor = new AstericsGridProcessor();

    // Test getElementIds method
    const elementIds = await processor.getElementIds(exampleGrdFile);
    expect(Array.isArray(elementIds)).toBe(true);
    expect(elementIds.length).toBeGreaterThan(0);

    // Test hasAudioRecording method
    const firstElementId = elementIds[0];
    const hasAudio = await processor.hasAudioRecording(exampleGrdFile, firstElementId);
    expect(typeof hasAudio).toBe('boolean');
  });

  it('should handle word forms and advanced features', async () => {
    const processor = new AstericsGridProcessor();
    const texts = await processor.extractTexts(exampleGrdFile);

    // The example file contains word forms like "sein", "bin", "bist", etc.
    expect(texts).toContain('sein');
    expect(texts).toContain('bin');
    expect(texts).toContain('am');
  });

  it('should create proper AACButton objects with correct properties', async () => {
    const processor = new AstericsGridProcessor();
    const tree = await processor.loadIntoTree(exampleGrdFile);

    let foundButtons = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        foundButtons = true;
        expect(button).toBeInstanceOf(AACButton);
        expect(typeof button.id).toBe('string');
        expect(typeof button.label).toBe('string');
        expect(typeof button.message).toBe('string');
        // Check semantic action is present (modern approach, not button.type)
        expect(button.semanticAction).toBeDefined();
        expect(button.semanticAction?.category).toBeDefined();
        expect(button.semanticAction?.intent).toBeDefined();
      });
    });

    expect(foundButtons).toBe(true);
  });

  it('should handle buffer input correctly', async () => {
    const processor = new AstericsGridProcessor();
    const fileBuffer = fs.readFileSync(exampleGrdFile);

    const tree = await processor.loadIntoTree(fileBuffer);
    expect(tree).toBeInstanceOf(AACTree);
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);

    const texts = await processor.extractTexts(fileBuffer);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('should handle comprehensive translation processing', async () => {
    const processor = new AstericsGridProcessor();
    const translations = new Map<string, string>();
    translations.set('Change in element', 'Elemento Cambiado');
    translations.set('Global grid', 'Cuadrícula Global');
    translations.set('Home', 'Inicio');

    const buffer = await processor.processTexts(exampleGrdFile, translations, tempOutputPath);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // Verify translations were applied
    const translatedTexts = await processor.extractTexts(tempOutputPath);
    expect(translatedTexts).toContain('Elemento Cambiado');
    expect(translatedTexts).toContain('Cuadrícula Global');
    expect(translatedTexts).toContain('Inicio');
  });

  it('should preserve home page (tree.rootId) through roundtrip', async () => {
    const processor = new AstericsGridProcessor();

    // Load the file and check if it has a rootId
    const initialTree = await processor.loadIntoTree(exampleGrdFile);

    // Read the original file to check if it has homeGridId in metadata
    let content = fs.readFileSync(exampleGrdFile, 'utf-8');
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    const originalFile = JSON.parse(content);
    const originalHomeGridId = originalFile.metadata?.homeGridId;

    if (originalHomeGridId) {
      // If the original file had a homeGridId, verify it was loaded correctly
      expect(initialTree.rootId).toBe(originalHomeGridId);

      // Verify the home page actually exists
      const rootId = initialTree.rootId;
      if (rootId) {
        const homePage = initialTree.getPage(rootId);
        expect(homePage).toBeDefined();
      }
    }

    // Save to a new file
    await processor.saveFromTree(initialTree, tempOutputPath);

    // Load the saved file
    const finalTree = await processor.loadIntoTree(tempOutputPath);

    // Verify rootId is preserved
    expect(finalTree.rootId).toBe(initialTree.rootId);

    // Verify the saved file has homeGridId in metadata
    let savedContent = fs.readFileSync(tempOutputPath, 'utf-8');
    if (savedContent.charCodeAt(0) === 0xfeff) {
      savedContent = savedContent.slice(1);
    }
    const savedFile = JSON.parse(savedContent);
    expect(savedFile.metadata?.homeGridId).toBe(initialTree.rootId);

    // If rootId exists, verify the home page is accessible
    if (finalTree.rootId) {
      const finalHomePage = finalTree.getPage(finalTree.rootId);
      expect(finalHomePage).toBeDefined();
    }
  });

  it('should extract locale and supported languages into metadata', async () => {
    const processor = new AstericsGridProcessor();
    const tree = await processor.loadIntoTree(exampleGrdFile);

    expect(tree.metadata.locale).toBeDefined();
    expect(Array.isArray(tree.metadata.languages)).toBe(true);
    expect(tree.metadata.languages?.length).toBeGreaterThan(0);
    // At least English should be present in our example file
    expect(tree.metadata.languages).toContain('en');
    // locale should be one of the languages
    expect(tree.metadata.languages).toContain(tree.metadata.locale);
  });
});
