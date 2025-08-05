// Real-world processTexts tests using actual example files
import fs from 'fs';
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';

describe('ProcessTexts with Real-World Data', () => {
  const examplesDir = path.join(__dirname, '../examples');
  const tempDir = path.join(__dirname, 'temp_realworld');

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

  describe('DOT Processor with Real Data', () => {
    const dotFile = path.join(examplesDir, 'example.dot');
    const communikateDotFile = path.join(examplesDir, 'communikate.dot');

    it('should extract and translate texts from example.dot', () => {
      if (!fs.existsSync(dotFile)) {
        console.log('Skipping DOT test - example.dot not found');
        return;
      }

      const processor = new DotProcessor();

      // First extract all texts to see what we're working with
      const originalTexts = processor.extractTexts(dotFile);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('DOT original texts:', originalTexts.slice(0, 5)); // Show first 5

      // Create translations for some common words
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text.toLowerCase().includes('hello')) {
          translations.set(text, text.replace(/hello/gi, 'hola'));
        }
        if (text.toLowerCase().includes('home')) {
          translations.set(text, text.replace(/home/gi, 'casa'));
        }
        if (text.toLowerCase().includes('food')) {
          translations.set(text, text.replace(/food/gi, 'comida'));
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.dot');
        const result = processor.processTexts(dotFile, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify translations were applied
        const translatedContent = result.toString('utf8');
        translations.forEach((translation, original) => {
          if (original !== translation) {
            expect(translatedContent).toContain(translation);
          }
        });
      }
    });

    it('should handle communikate.dot file', () => {
      if (!fs.existsSync(communikateDotFile)) {
        console.log('Skipping communikate DOT test - file not found');
        return;
      }

      const processor = new DotProcessor();
      const texts = processor.extractTexts(communikateDotFile);
      expect(texts.length).toBeGreaterThan(0);

      // Test with a simple translation
      const translations = new Map([['Core', 'Núcleo']]);
      const outputPath = path.join(tempDir, 'translated_communikate.dot');

      expect(() => {
        processor.processTexts(communikateDotFile, translations, outputPath);
      }).not.toThrow();
    });
  });

  describe('OPML Processor with Real Data', () => {
    const opmlFile = path.join(examplesDir, 'example.opml');

    it('should extract and translate texts from example.opml', () => {
      if (!fs.existsSync(opmlFile)) {
        console.log('Skipping OPML test - example.opml not found');
        return;
      }

      const processor = new OpmlProcessor();

      // Extract texts to see the structure
      const originalTexts = processor.extractTexts(opmlFile);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('OPML original texts:', originalTexts.slice(0, 5));

      // Create translations based on actual content
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text.toLowerCase().includes('home')) {
          translations.set(text, text.replace(/home/gi, 'casa'));
        }
        if (text.toLowerCase().includes('food')) {
          translations.set(text, text.replace(/food/gi, 'comida'));
        }
        if (text.toLowerCase().includes('drink')) {
          translations.set(text, text.replace(/drink/gi, 'bebida'));
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.opml');
        const result = processor.processTexts(opmlFile, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);

        // Verify the XML structure is maintained and translations applied
        const translatedContent = result.toString('utf8');
        expect(translatedContent).toContain('<?xml');
        expect(translatedContent).toContain('<opml');

        translations.forEach((translation, original) => {
          if (original !== translation) {
            expect(translatedContent).toContain(`text="${translation}"`);
          }
        });
      }
    });
  });

  describe('OBF Processor with Real Data', () => {
    const obfFile = path.join(examplesDir, 'example.obf');
    const obzFile = path.join(examplesDir, 'example.obz');

    it('should extract and translate texts from example.obf', () => {
      if (!fs.existsSync(obfFile)) {
        console.log('Skipping OBF test - example.obf not found');
        return;
      }

      const processor = new ObfProcessor();

      // Extract texts to understand the content
      const originalTexts = processor.extractTexts(obfFile);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('OBF original texts:', originalTexts.slice(0, 5));

      // Create meaningful translations
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text && typeof text === 'string') {
          if (text.toLowerCase().includes('hello')) {
            translations.set(text, text.replace(/hello/gi, 'hola'));
          }
          if (text.toLowerCase().includes('yes')) {
            translations.set(text, text.replace(/yes/gi, 'sí'));
          }
          if (text.toLowerCase().includes('no')) {
            translations.set(text, text.replace(/no/gi, 'no'));
          }
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.obf');
        const result = processor.processTexts(obfFile, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);

        // Load the translated file and verify structure
        const translatedTree = processor.loadIntoTree(outputPath);
        expect(Object.keys(translatedTree.pages).length).toBeGreaterThan(0);
      }
    });

    it('should handle OBZ (zip) files', () => {
      if (!fs.existsSync(obzFile)) {
        console.log('Skipping OBZ test - example.obz not found');
        return;
      }

      const processor = new ObfProcessor();
      const texts = processor.extractTexts(obzFile);
      expect(texts.length).toBeGreaterThan(0);

      // Test with simple translation
      const translations = new Map([['home', 'casa']]);
      const outputPath = path.join(tempDir, 'translated_example.obz');

      expect(() => {
        processor.processTexts(obzFile, translations, outputPath);
      }).not.toThrow();
    });
  });

  describe('GridSet Processor with Real Data', () => {
    const gridsetFile = path.join(examplesDir, 'example.gridset');

    it('should extract and translate texts from example.gridset', () => {
      if (!fs.existsSync(gridsetFile)) {
        console.log('Skipping GridSet test - example.gridset not found');
        return;
      }

      const processor = new GridsetProcessor();

      // Extract texts from the real GridSet file
      const fileBuffer = fs.readFileSync(gridsetFile);
      const originalTexts = processor.extractTexts(fileBuffer);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('GridSet original texts:', originalTexts.slice(0, 5));

      // Create translations based on Grid3 format expectations
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text && typeof text === 'string') {
          // Common AAC words that might be in a gridset
          if (text.toLowerCase().includes('i')) {
            translations.set(text, text.replace(/\bi\b/gi, 'yo'));
          }
          if (text.toLowerCase().includes('want')) {
            translations.set(text, text.replace(/want/gi, 'quiero'));
          }
          if (text.toLowerCase().includes('more')) {
            translations.set(text, text.replace(/more/gi, 'más'));
          }
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.gridset');
        const result = processor.processTexts(fileBuffer, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify the translated file can be loaded back
        const translatedBuffer = fs.readFileSync(outputPath);
        const translatedTree = processor.loadIntoTree(translatedBuffer);
        expect(Object.keys(translatedTree.pages).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Snap Processor with Real Data', () => {
    const spbFile = path.join(examplesDir, 'example.spb');
    const spsFile = path.join(examplesDir, 'example.sps');

    it('should extract and translate texts from example.spb', () => {
      if (!fs.existsSync(spbFile)) {
        console.log('Skipping SPB test - example.spb not found');
        return;
      }

      const processor = new SnapProcessor();

      // Extract texts from real Snap database
      const originalTexts = processor.extractTexts(spbFile);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('Snap SPB original texts:', originalTexts.slice(0, 5));

      // Create translations for common AAC vocabulary
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text && typeof text === 'string') {
          if (text.toLowerCase().includes('hello')) {
            translations.set(text, text.replace(/hello/gi, 'hola'));
          }
          if (text.toLowerCase().includes('thank')) {
            translations.set(text, text.replace(/thank/gi, 'gracias'));
          }
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.spb');
        const result = processor.processTexts(spbFile, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should handle SPS files', () => {
      if (!fs.existsSync(spsFile)) {
        console.log('Skipping SPS test - example.sps not found');
        return;
      }

      const processor = new SnapProcessor();
      const texts = processor.extractTexts(spsFile);
      expect(texts.length).toBeGreaterThan(0);

      // Test basic translation functionality
      const translations = new Map([['home', 'casa']]);
      const outputPath = path.join(tempDir, 'translated_example.sps');

      expect(() => {
        processor.processTexts(spsFile, translations, outputPath);
      }).not.toThrow();
    });
  });

  describe('TouchChat Processor with Real Data', () => {
    const ceFile = path.join(examplesDir, 'example.ce');

    it('should extract and translate texts from example.ce', () => {
      if (!fs.existsSync(ceFile)) {
        console.log('Skipping TouchChat test - example.ce not found');
        return;
      }

      const processor = new TouchChatProcessor();

      // Extract texts from real TouchChat file
      const originalTexts = processor.extractTexts(ceFile);
      expect(originalTexts.length).toBeGreaterThan(0);
      console.log('TouchChat original texts:', originalTexts.slice(0, 5));

      // Create translations for TouchChat vocabulary
      const translations = new Map<string, string>();
      originalTexts.forEach((text) => {
        if (text && typeof text === 'string') {
          if (text.toLowerCase().includes('hello')) {
            translations.set(text, text.replace(/hello/gi, 'hola'));
          }
          if (text.toLowerCase().includes('goodbye')) {
            translations.set(text, text.replace(/goodbye/gi, 'adiós'));
          }
        }
      });

      if (translations.size > 0) {
        const outputPath = path.join(tempDir, 'translated_example.ce');
        const result = processor.processTexts(ceFile, translations, outputPath);

        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });
  });
});
