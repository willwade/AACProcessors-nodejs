// Integration tests for alias methods across all processors
import fs from 'fs';
import path from 'path';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { ApplePanelsProcessor } from '../src/processors/applePanelsProcessor';
import { AstericsGridProcessor } from '../src/processors/astericsGridProcessor';
import { ExcelProcessor } from '../src/processors/excelProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { DotProcessor } from '../src/processors/dotProcessor';
import { StringCasing } from '../src/core/stringCasing';
import { ExtractStringsResult, TranslatedString, SourceString } from '../src/core/baseProcessor';

describe('Alias Methods Integration', () => {
  const tempDir = path.join(__dirname, 'temp_alias_tests');

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

  describe('TouchChatProcessor Alias Methods', () => {
    const processor = new TouchChatProcessor();
    const exampleFile = path.join(__dirname, '../examples/example.ce');

    it('should extract strings with metadata in expected format', async () => {
      if (!fs.existsSync(exampleFile)) {
        console.log('Skipping TouchChat test - example file not found');
        return;
      }

      const result: ExtractStringsResult = await processor.extractStringsWithMetadata(exampleFile);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('extractedStrings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.extractedStrings)).toBe(true);

      if (result.extractedStrings.length > 0) {
        const firstString = result.extractedStrings[0];
        expect(firstString).toHaveProperty('string');
        expect(firstString).toHaveProperty('vocabPlacementMeta');
        expect(firstString.vocabPlacementMeta).toHaveProperty('vocabLocations');
        expect(Array.isArray(firstString.vocabPlacementMeta.vocabLocations)).toBe(true);

        if (firstString.vocabPlacementMeta.vocabLocations.length > 0) {
          const location = firstString.vocabPlacementMeta.vocabLocations[0];
          expect(location).toHaveProperty('table');
          expect(location).toHaveProperty('id');
          expect(location).toHaveProperty('column');
          expect(location).toHaveProperty('casing');
          expect(Object.values(StringCasing)).toContain(location.casing);
        }
      }
    });

    it('should generate translated downloads', async () => {
      if (!fs.existsSync(exampleFile)) {
        console.log('Skipping TouchChat test - example file not found');
        return;
      }

      const mockTranslatedStrings: TranslatedString[] = [
        {
          sourcestringid: 1,
          overridestring: '',
          translatedstring: 'Translated Text',
        },
      ];

      const mockSourceStrings: SourceString[] = [
        {
          id: 1,
          sourcestring: 'Original Text',
          vocabplacementmetadata: {
            vocabLocations: [
              {
                table: 'buttons',
                id: 1,
                column: 'LABEL',
                casing: StringCasing.LOWER,
              },
            ],
          },
        },
      ];

      const outputPath = await processor.generateTranslatedDownload(
        exampleFile,
        mockTranslatedStrings,
        mockSourceStrings
      );

      expect(outputPath).toMatch(/_translated\.ce$/);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Clean up
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });

    it('should handle errors gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.ce');

      const result = await processor.extractStringsWithMetadata(nonExistentFile);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('message');
      expect(result.errors[0]).toHaveProperty('step');
      expect(result.errors[0].step).toBe('EXTRACT');
      expect(result.extractedStrings).toEqual([]);
    });
  });

  describe('ObfProcessor Alias Methods', () => {
    const processor = new ObfProcessor();
    const exampleFile = path.join(__dirname, '../examples/example.obf');

    it('should have alias methods available', () => {
      expect(typeof processor.extractStringsWithMetadata).toBe('function');
      expect(typeof processor.generateTranslatedDownload).toBe('function');
    });

    it('should extract strings with metadata using generic implementation', async () => {
      if (!fs.existsSync(exampleFile)) {
        console.log('Skipping OBF test - example file not found');
        return;
      }

      const result = await processor.extractStringsWithMetadata(exampleFile);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('extractedStrings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.extractedStrings)).toBe(true);
    });
  });

  describe('SnapProcessor Alias Methods', () => {
    const processor = new SnapProcessor();
    const exampleFile = path.join(__dirname, '../examples/example.spb');

    it('should have alias methods available', () => {
      expect(typeof processor.extractStringsWithMetadata).toBe('function');
      expect(typeof processor.generateTranslatedDownload).toBe('function');
    });

    it('should extract strings with metadata using generic implementation', async () => {
      if (!fs.existsSync(exampleFile)) {
        console.log('Skipping Snap test - example file not found');
        return;
      }

      const result = await processor.extractStringsWithMetadata(exampleFile);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('extractedStrings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.extractedStrings)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing API methods', () => {
      const touchChatProcessor = new TouchChatProcessor();
      const obfProcessor = new ObfProcessor();
      const snapProcessor = new SnapProcessor();

      // Verify existing methods still exist
      expect(typeof touchChatProcessor.extractTexts).toBe('function');
      expect(typeof touchChatProcessor.loadIntoTree).toBe('function');
      expect(typeof touchChatProcessor.processTexts).toBe('function');
      expect(typeof touchChatProcessor.saveFromTree).toBe('function');

      expect(typeof obfProcessor.extractTexts).toBe('function');
      expect(typeof obfProcessor.loadIntoTree).toBe('function');
      expect(typeof obfProcessor.processTexts).toBe('function');
      expect(typeof obfProcessor.saveFromTree).toBe('function');

      expect(typeof snapProcessor.extractTexts).toBe('function');
      expect(typeof snapProcessor.loadIntoTree).toBe('function');
      expect(typeof snapProcessor.processTexts).toBe('function');
      expect(typeof snapProcessor.saveFromTree).toBe('function');
    });

    it('should not break existing functionality', async () => {
      const processor = new TouchChatProcessor();
      const exampleFile = path.join(__dirname, '../examples/example.ce');

      if (!fs.existsSync(exampleFile)) {
        console.log('Skipping backward compatibility test - example file not found');
        return;
      }

      // Test that existing methods still work
      expect(() => {
        const texts = processor.extractTexts(exampleFile);
        expect(Array.isArray(texts)).toBe(true);
      }).not.toThrow();

      expect(() => {
        const tree = processor.loadIntoTree(exampleFile);
        expect(tree).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Cross-Format Consistency', () => {
    it('should provide consistent interface across all processors', () => {
      const processors = [
        new TouchChatProcessor(),
        new ObfProcessor(),
        new SnapProcessor(),
        new GridsetProcessor(),
        new ApplePanelsProcessor(),
        new AstericsGridProcessor(),
        new ExcelProcessor(),
        new OpmlProcessor(),
        new DotProcessor(),
      ];

      processors.forEach((processor) => {
        // All processors should have the alias methods
        expect(typeof processor.extractStringsWithMetadata).toBe('function');
        expect(typeof processor.generateTranslatedDownload).toBe('function');

        // All processors should have the standard methods
        expect(typeof processor.extractTexts).toBe('function');
        expect(typeof processor.loadIntoTree).toBe('function');
        expect(typeof processor.processTexts).toBe('function');
        expect(typeof processor.saveFromTree).toBe('function');
      });
    });
  });
});
