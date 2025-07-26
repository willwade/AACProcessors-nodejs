// Tests for processTexts functionality across all processors
import fs from 'fs';
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { ApplePanelsProcessor } from '../src/processors/applePanelsProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

describe('ProcessTexts functionality', () => {
  const tempDir = path.join(__dirname, 'temp');
  
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('DotProcessor processTexts', () => {
    it('should apply translations to dot file content', () => {
      const processor = new DotProcessor();
      const dotContent = `
        digraph G {
          node1 [label="Hello"];
          node2 [label="World"];
          node1 -> node2 [label="Go"];
        }
      `;
      
      const translations = new Map([
        ['Hello', 'Hola'],
        ['World', 'Mundo'],
        ['Go', 'Ir']
      ]);
      
      const outputPath = path.join(tempDir, 'translated.dot');
      const result = processor.processTexts(Buffer.from(dotContent), translations, outputPath);
      
      const translatedContent = result.toString('utf8');
      expect(translatedContent).toContain('label="Hola"');
      expect(translatedContent).toContain('label="Mundo"');
      expect(translatedContent).toContain('label="Ir"');
    });
  });

  describe('OpmlProcessor processTexts', () => {
    it('should apply translations to OPML text attributes', () => {
      const processor = new OpmlProcessor();
      const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Home">
              <outline text="Food" />
              <outline text="Drinks" />
            </outline>
          </body>
        </opml>
      `;
      
      const translations = new Map([
        ['Home', 'Casa'],
        ['Food', 'Comida'],
        ['Drinks', 'Bebidas']
      ]);
      
      const outputPath = path.join(tempDir, 'translated.opml');
      const result = processor.processTexts(Buffer.from(opmlContent), translations, outputPath);
      
      const translatedContent = result.toString('utf8');
      expect(translatedContent).toContain('text="Casa"');
      expect(translatedContent).toContain('text="Comida"');
      expect(translatedContent).toContain('text="Bebidas"');
    });
  });

  describe('Tree-based processors processTexts', () => {
    let testTree: AACTree;
    
    beforeEach(() => {
      // Create a test tree with translatable content
      testTree = new AACTree();
      
      const page1 = new AACPage({
        id: 'page1',
        name: 'Main Page',
        buttons: []
      });
      
      const button1 = new AACButton({
        id: 'btn1',
        label: 'Hello',
        message: 'Hello World',
        type: 'SPEAK'
      });
      
      const button2 = new AACButton({
        id: 'btn2',
        label: 'Go Home',
        message: 'Navigate to home',
        type: 'NAVIGATE',
        targetPageId: 'page2'
      });
      
      page1.addButton(button1);
      page1.addButton(button2);
      testTree.addPage(page1);
      
      const page2 = new AACPage({
        id: 'page2',
        name: 'Home Page',
        buttons: []
      });
      
      testTree.addPage(page2);
    });

    it('should translate ApplePanels content', () => {
      const processor = new ApplePanelsProcessor();
      const outputPath = path.join(tempDir, 'test.applepanels.plist');
      
      // First save the test tree
      processor.saveFromTree(testTree, outputPath);
      
      const translations = new Map([
        ['Main Page', 'Página Principal'],
        ['Hello', 'Hola'],
        ['Hello World', 'Hola Mundo'],
        ['Go Home', 'Ir a Casa'],
        ['Home Page', 'Página de Inicio']
      ]);
      
      const translatedPath = path.join(tempDir, 'translated.applepanels.plist');
      const result = processor.processTexts(outputPath, translations, translatedPath);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(fs.existsSync(translatedPath)).toBe(true);
      
      // Verify translations were applied by loading the translated file
      const translatedTree = processor.loadIntoTree(translatedPath);
      const pages = Object.values(translatedTree.pages);
      expect(pages.length).toBeGreaterThan(0);

      // Find the main page (might have different ID after round-trip)
      const mainPage = pages.find(p => p.name === 'Página Principal');
      expect(mainPage).toBeDefined();
      expect(mainPage!.name).toBe('Página Principal');

      // Find the hello button by label
      const helloButton = mainPage!.buttons.find(b => b.label === 'Hola');
      expect(helloButton).toBeDefined();
      expect(helloButton!.label).toBe('Hola');
      expect(helloButton!.message).toBe('Hola Mundo');
    });

    it('should translate OBF content', () => {
      const processor = new ObfProcessor();
      const outputPath = path.join(tempDir, 'test.obf');
      
      // First save the test tree
      processor.saveFromTree(testTree, outputPath);
      
      const translations = new Map([
        ['Main Page', 'Página Principal'],
        ['Hello', 'Hola'],
        ['Hello World', 'Hola Mundo']
      ]);
      
      const translatedPath = path.join(tempDir, 'translated.obf');
      const result = processor.processTexts(outputPath, translations, translatedPath);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(fs.existsSync(translatedPath)).toBe(true);
    });

    it('should handle empty translations gracefully', () => {
      const processor = new ApplePanelsProcessor();
      const outputPath = path.join(tempDir, 'test_empty.applepanels.plist');
      
      processor.saveFromTree(testTree, outputPath);
      
      const emptyTranslations = new Map<string, string>();
      const translatedPath = path.join(tempDir, 'empty_translated.applepanels.plist');
      
      expect(() => {
        processor.processTexts(outputPath, emptyTranslations, translatedPath);
      }).not.toThrow();
      
      expect(fs.existsSync(translatedPath)).toBe(true);
    });
  });
});
