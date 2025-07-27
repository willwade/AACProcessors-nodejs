// Advanced scenario testing for complex real-world use cases
import fs from 'fs';
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { ApplePanelsProcessor } from '../src/processors/applePanelsProcessor';
import { getProcessor } from '../src/index';
import { TreeFactory, PageFactory, ButtonFactory, TestDataUtils } from './utils/testFactories';
import { TestEnvironmentManager, PerformanceHelper, AsyncTestHelper } from './utils/testHelpers';

describe('Advanced Scenario Testing', () => {
  let testEnv: ReturnType<typeof TestEnvironmentManager.createTempEnvironment>;

  beforeAll(() => {
    testEnv = TestEnvironmentManager.createTempEnvironment('advanced-scenarios');
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  describe('Multi-Format Workflow Scenarios', () => {
    it('should handle complete AAC development workflow', async () => {
      // Scenario: Create AAC board in DOT, convert to multiple formats, translate, and verify consistency
      
      // Step 1: Create initial communication board in DOT format
      const initialTree = TreeFactory.createCommunicationBoard();
      const dotProcessor = new DotProcessor();
      const dotPath = path.join(testEnv.tempDir, 'initial.dot');
      
      dotProcessor.saveFromTree(initialTree, dotPath);
      expect(fs.existsSync(dotPath)).toBe(true);

      // Step 2: Convert to multiple formats
      const formats = [
        { ext: '.opml', processor: new OpmlProcessor() },
        { ext: '.obf', processor: new ObfProcessor() },
        { ext: '.plist', processor: new ApplePanelsProcessor() }
      ];

      const convertedFiles: Record<string, string> = {};
      
      for (const { ext, processor } of formats) {
        const convertedPath = path.join(testEnv.tempDir, `converted${ext}`);
        processor.saveFromTree(initialTree, convertedPath);
        convertedFiles[ext] = convertedPath;
        expect(fs.existsSync(convertedPath)).toBe(true);
      }

      // Step 3: Extract texts from all formats
      const allTexts: Record<string, string[]> = {};
      allTexts['.dot'] = dotProcessor.extractTexts(dotPath);
      
      for (const { ext, processor } of formats) {
        allTexts[ext] = processor.extractTexts(convertedFiles[ext]);
      }

      // Step 4: Create translations
      const originalTexts = allTexts['.dot'];
      const translations = TestDataUtils.createTranslationMap(originalTexts, 'es');

      // Step 5: Apply translations to all formats
      const translatedFiles: Record<string, string> = {};
      
      // Translate DOT
      const translatedDotPath = path.join(testEnv.tempDir, 'translated.dot');
      dotProcessor.processTexts(dotPath, translations, translatedDotPath);
      translatedFiles['.dot'] = translatedDotPath;

      // Translate other formats
      for (const { ext, processor } of formats) {
        const translatedPath = path.join(testEnv.tempDir, `translated${ext}`);
        processor.processTexts(convertedFiles[ext], translations, translatedPath);
        translatedFiles[ext] = translatedPath;
      }

      // Step 6: Verify translations were applied
      for (const [ext, filePath] of Object.entries(translatedFiles)) {
        expect(fs.existsSync(filePath)).toBe(true);
        
        const processor = ext === '.dot' ? dotProcessor : 
                         ext === '.opml' ? new OpmlProcessor() :
                         ext === '.obf' ? new ObfProcessor() :
                         new ApplePanelsProcessor();
        
        const translatedTexts = processor.extractTexts(filePath);
        
        // Should have some Spanish translations
        const hasSpanishContent = translatedTexts.some(text => 
          text.includes('Hola') || text.includes('Comida') || text.includes('Casa')
        );
        
        if (translatedTexts.length > 0) {
          expect(hasSpanishContent).toBe(true);
        }
      }

      // Step 7: Verify round-trip consistency
      for (const { ext, processor } of formats) {
        const reloadedTree = processor.loadIntoTree(translatedFiles[ext]);
        expect(Object.keys(reloadedTree.pages).length).toBeGreaterThan(0);
      }
    });

    it('should handle collaborative editing scenario', async () => {
      // Scenario: Multiple users editing the same AAC board in different formats
      
      const baseTree = TreeFactory.createSimple();
      
      // User 1: Works with DOT format
      const dotProcessor = new DotProcessor();
      const dotPath = path.join(testEnv.tempDir, 'collaborative.dot');
      dotProcessor.saveFromTree(baseTree, dotPath);

      // User 2: Converts to OPML and adds content
      const opmlProcessor = new OpmlProcessor();
      const opmlPath = path.join(testEnv.tempDir, 'collaborative.opml');
      opmlProcessor.saveFromTree(baseTree, opmlPath);

      // User 3: Converts to OBF and modifies
      const obfProcessor = new ObfProcessor();
      const obfPath = path.join(testEnv.tempDir, 'collaborative.obf');
      obfProcessor.saveFromTree(baseTree, obfPath);

      // Simulate concurrent modifications
      const modifications = await AsyncTestHelper.runConcurrently([
        async () => {
          // DOT modification
          const tree = dotProcessor.loadIntoTree(dotPath);
          const newPage = PageFactory.create({
            id: 'dot_addition',
            name: 'DOT Addition',
            buttons: [{ label: 'DOT Button', type: 'SPEAK' }]
          });
          tree.addPage(newPage);
          
          const modifiedDotPath = path.join(testEnv.tempDir, 'modified.dot');
          dotProcessor.saveFromTree(tree, modifiedDotPath);
          return modifiedDotPath;
        },
        async () => {
          // OPML modification
          const tree = opmlProcessor.loadIntoTree(opmlPath);
          const newPage = PageFactory.create({
            id: 'opml_addition',
            name: 'OPML Addition',
            buttons: [{ label: 'OPML Button', type: 'SPEAK' }]
          });
          tree.addPage(newPage);
          
          const modifiedOpmlPath = path.join(testEnv.tempDir, 'modified.opml');
          opmlProcessor.saveFromTree(tree, modifiedOpmlPath);
          return modifiedOpmlPath;
        },
        async () => {
          // OBF modification
          const tree = obfProcessor.loadIntoTree(obfPath);
          const newPage = PageFactory.create({
            id: 'obf_addition',
            name: 'OBF Addition',
            buttons: [{ label: 'OBF Button', type: 'SPEAK' }]
          });
          tree.addPage(newPage);
          
          const modifiedObfPath = path.join(testEnv.tempDir, 'modified.obf');
          obfProcessor.saveFromTree(tree, modifiedObfPath);
          return modifiedObfPath;
        }
      ], 3);

      // Verify all modifications were successful
      expect(modifications).toHaveLength(3);
      modifications.forEach(filePath => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      // Merge scenario: Load all modified versions and verify content
      const dotTree = dotProcessor.loadIntoTree(modifications[0]);
      const opmlTree = opmlProcessor.loadIntoTree(modifications[1]);
      const obfTree = obfProcessor.loadIntoTree(modifications[2]);

      expect(Object.keys(dotTree.pages).length).toBeGreaterThan(Object.keys(baseTree.pages).length);
      expect(Object.keys(opmlTree.pages).length).toBeGreaterThan(0);
      expect(Object.keys(obfTree.pages).length).toBeGreaterThan(0);
    });
  });

  describe('Performance-Critical Scenarios', () => {
    it('should handle high-volume batch processing', async () => {
      // Scenario: Process 50 AAC boards simultaneously
      
      const batchSize = 20; // Reduced for CI stability
      const processors = [
        new DotProcessor(),
        new OpmlProcessor(),
        new ObfProcessor(),
        new ApplePanelsProcessor()
      ];

      const { result: batchResults, metrics } = await PerformanceHelper.measureAsync(async () => {
        const batchOperations = Array.from({ length: batchSize }, (_, i) => async () => {
          const tree = TreeFactory.createLarge(5, 6); // 5 pages, 6 buttons each
          const processor = processors[i % processors.length];
          const ext = ['.dot', '.opml', '.obf', '.plist'][i % processors.length];
          
          const filePath = path.join(testEnv.tempDir, `batch_${i}${ext}`);
          processor.saveFromTree(tree, filePath);
          
          const reloadedTree = processor.loadIntoTree(filePath);
          const texts = processor.extractTexts(filePath);
          
          return {
            index: i,
            pageCount: Object.keys(reloadedTree.pages).length,
            textCount: texts.length,
            fileSize: fs.statSync(filePath).size
          };
        });

        return AsyncTestHelper.runConcurrently(batchOperations, 5);
      }, 'Batch Processing');

      // Verify all operations completed successfully
      expect(batchResults).toHaveLength(batchSize);
      batchResults.forEach(result => {
        expect(result.pageCount).toBeGreaterThan(0);
        expect(result.textCount).toBeGreaterThan(0);
        expect(result.fileSize).toBeGreaterThan(0);
      });

      // Performance expectations
      expect(metrics.executionTime).toBeLessThan(30000); // 30 seconds max
      expect(metrics.memoryDelta.heapUsed / 1024 / 1024).toBeLessThan(200); // 200MB max
    });

    it('should handle streaming large file processing', async () => {
      // Scenario: Process very large AAC board (1000+ buttons)
      
      const largeTree = TreeFactory.createLarge(50, 20); // 50 pages, 20 buttons each = 1000 buttons
      const processor = new DotProcessor();
      
      const { result, metrics } = await PerformanceHelper.measureAsync(async () => {
        const largePath = path.join(testEnv.tempDir, 'large_board.dot');
        
        // Save large tree
        processor.saveFromTree(largeTree, largePath);
        
        // Load it back
        const reloadedTree = processor.loadIntoTree(largePath);
        
        // Extract texts
        const texts = processor.extractTexts(largePath);
        
        // Apply translations
        const translations = TestDataUtils.createTranslationMap(texts.slice(0, 100), 'fr');
        const translatedPath = path.join(testEnv.tempDir, 'large_translated.dot');
        processor.processTexts(largePath, translations, translatedPath);
        
        return {
          originalPages: Object.keys(largeTree.pages).length,
          reloadedPages: Object.keys(reloadedTree.pages).length,
          textCount: texts.length,
          translationCount: translations.size,
          fileSize: fs.statSync(largePath).size
        };
      }, 'Large File Processing');

      expect(result.originalPages).toBe(50);
      expect(result.reloadedPages).toBeGreaterThan(0);
      expect(result.textCount).toBeGreaterThan(100);
      expect(result.fileSize).toBeGreaterThan(10000); // At least 10KB

      // Performance expectations for large files
      expect(metrics.executionTime).toBeLessThan(15000); // 15 seconds max
      expect(metrics.memoryDelta.heapUsed / 1024 / 1024).toBeLessThan(100); // 100MB max
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle partial file corruption gracefully', async () => {
      // Scenario: Process files with various types of corruption
      
      const validTree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      
      // Create valid file first
      const validPath = path.join(testEnv.tempDir, 'valid.dot');
      processor.saveFromTree(validTree, validPath);
      const validContent = fs.readFileSync(validPath, 'utf8');

      // Test various corruption scenarios
      const corruptionTests = [
        {
          name: 'Truncated file',
          content: validContent.slice(0, validContent.length / 2)
        },
        {
          name: 'Invalid characters',
          content: validContent.replace(/digraph/g, 'invalid\0\xFF')
        },
        {
          name: 'Malformed structure',
          content: validContent.replace(/}/g, '').replace(/{/g, '')
        },
        {
          name: 'Mixed encoding',
          content: validContent + '\xFF\xFE\x00\x00'
        }
      ];

      const results = await AsyncTestHelper.runConcurrently(
        corruptionTests.map(test => async () => {
          const corruptedPath = path.join(testEnv.tempDir, `corrupted_${test.name.replace(/\s+/g, '_')}.dot`);
          fs.writeFileSync(corruptedPath, test.content);

          try {
            const tree = processor.loadIntoTree(corruptedPath);
            const texts = processor.extractTexts(corruptedPath);
            
            return {
              name: test.name,
              success: true,
              pageCount: Object.keys(tree.pages).length,
              textCount: texts.length
            };
          } catch (error) {
            return {
              name: test.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }),
        2
      );

      // Should handle corruption gracefully (either succeed with partial data or fail cleanly)
      results.forEach(result => {
        expect(result.name).toBeDefined();
        if (result.success) {
          // If it succeeds, should have valid structure
          expect(result.pageCount).toBeGreaterThanOrEqual(0);
          expect(result.textCount).toBeGreaterThanOrEqual(0);
        } else {
          // If it fails, should have meaningful error
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      });
    });

    it('should handle resource exhaustion scenarios', async () => {
      // Scenario: Test behavior under resource constraints
      
      const processor = new DotProcessor();
      
      // Test with many small operations (simulating memory pressure)
      const smallOperations = Array.from({ length: 100 }, (_, i) => async () => {
        const tree = TreeFactory.createMinimal();
        const tempPath = path.join(testEnv.tempDir, `small_${i}.dot`);
        
        try {
          processor.saveFromTree(tree, tempPath);
          const reloadedTree = processor.loadIntoTree(tempPath);
          
          // Clean up immediately to simulate resource pressure
          fs.unlinkSync(tempPath);
          
          return {
            index: i,
            success: true,
            pageCount: Object.keys(reloadedTree.pages).length
          };
        } catch (error) {
          return {
            index: i,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const results = await AsyncTestHelper.runConcurrently(smallOperations, 10);
      
      // Most operations should succeed
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      expect(successCount).toBeGreaterThan(failureCount);
      expect(successCount).toBeGreaterThan(80); // At least 80% success rate
      
      // Failures should have meaningful errors
      results.filter(r => !r.success).forEach(result => {
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Integration with External Systems', () => {
    it('should handle processor factory with dynamic format detection', () => {
      // Scenario: Dynamically process files based on extension
      
      const testFiles = [
        { name: 'test.dot', content: 'digraph G { test [label="Test"]; }' },
        { name: 'test.opml', content: '<?xml version="1.0"?><opml version="2.0"><body><outline text="Test"/></body></opml>' },
        { name: 'test.obf', content: '{"id": "test", "buttons": [{"id": "btn1", "label": "Test"}]}' }
      ];

      const results = testFiles.map(file => {
        const filePath = path.join(testEnv.tempDir, file.name);
        fs.writeFileSync(filePath, file.content);

        try {
          const processor = getProcessor(filePath);
          const tree = processor.loadIntoTree(filePath);
          const texts = processor.extractTexts(filePath);

          return {
            file: file.name,
            success: true,
            processorType: processor.constructor.name,
            pageCount: Object.keys(tree.pages).length,
            textCount: texts.length
          };
        } catch (error) {
          return {
            file: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      // All files should be processed successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.processorType).toBeDefined();
          expect(result.pageCount).toBeGreaterThanOrEqual(0);
          expect(result.textCount).toBeGreaterThanOrEqual(0);
        }
      });

      // Verify correct processor types
      const dotResult = results.find(r => r.file === 'test.dot');
      const opmlResult = results.find(r => r.file === 'test.opml');
      const obfResult = results.find(r => r.file === 'test.obf');

      expect(dotResult?.processorType).toBe('DotProcessor');
      expect(opmlResult?.processorType).toBe('OpmlProcessor');
      expect(obfResult?.processorType).toBe('ObfProcessor');
    });
  });
});
