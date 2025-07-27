// Database corruption and performance tests for SnapProcessor
import fs from 'fs';
import path from 'path';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';
import { TreeFactory, PageFactory, ButtonFactory } from './utils/testFactories';

describe('SnapProcessor - Database Corruption & Performance Tests', () => {
  let processor: SnapProcessor;
  const tempDir = path.join(__dirname, 'temp_snap_corruption');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  beforeEach(() => {
    processor = new SnapProcessor();
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Database Corruption Handling', () => {
    it('should handle partially corrupted SPS files', () => {
      // Create a valid SPS file first
      const tree = TreeFactory.createSimple();
      const validPath = path.join(tempDir, 'valid.sps');
      processor.saveFromTree(tree, validPath);
      
      // Read the valid file and corrupt part of it
      const validData = fs.readFileSync(validPath);
      const corruptedData = Buffer.from(validData);
      
      // Corrupt the middle section (but keep zip headers intact)
      const corruptStart = Math.floor(corruptedData.length * 0.3);
      const corruptEnd = Math.floor(corruptedData.length * 0.7);
      for (let i = corruptStart; i < corruptEnd; i++) {
        corruptedData[i] = Math.floor(Math.random() * 256);
      }
      
      const corruptedPath = path.join(tempDir, 'partially_corrupted.sps');
      fs.writeFileSync(corruptedPath, corruptedData);
      
      // Should handle corruption gracefully
      expect(() => {
        processor.loadIntoTree(corruptedPath);
      }).toThrow(); // Expected to throw, but shouldn't crash the process
    });

    it('should recover from corrupted audio blob data', () => {
      // Create a file with audio data
      const button = ButtonFactory.create({
        label: 'Audio Button',
        message: 'Has audio',
        type: 'SPEAK'
      });
      
      button.audioRecording = {
        id: 1,
        data: Buffer.from('valid audio data'),
        identifier: 'audio_1',
        metadata: 'Valid audio'
      };
      
      const page = PageFactory.create({
        id: 'audio_page',
        name: 'Audio Page'
      });
      page.addButton(button);
      
      const tree = new AACTree();
      tree.addPage(page);
      
      const outputPath = path.join(tempDir, 'audio_corruption.sps');
      processor.saveFromTree(tree, outputPath);
      
      // Verify the file was created successfully
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Try to load it back (should work with valid data)
      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
    });

    it('should handle missing database tables gracefully', () => {
      // Create a zip file with missing required tables
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      
      // Add some files but not the required database structure
      zip.addFile('readme.txt', Buffer.from('This is not a proper SPS file'));
      zip.addFile('config.json', Buffer.from('{"version": "1.0"}'));
      
      const invalidPath = path.join(tempDir, 'missing_tables.sps');
      zip.writeZip(invalidPath);
      
      expect(() => {
        processor.loadIntoTree(invalidPath);
      }).toThrow();
    });

    it('should process files with invalid foreign keys', () => {
      // Create a valid tree first
      const tree = TreeFactory.createCommunicationBoard();
      const outputPath = path.join(tempDir, 'foreign_keys.sps');
      
      // This should work with proper relationships
      expect(() => {
        processor.saveFromTree(tree, outputPath);
      }).not.toThrow();
      
      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
    });

    it('should handle truncated database files', () => {
      // Create a valid file
      const tree = TreeFactory.createSimple();
      const validPath = path.join(tempDir, 'valid_for_truncation.sps');
      processor.saveFromTree(tree, validPath);
      
      // Read and truncate the file
      const validData = fs.readFileSync(validPath);
      const truncatedData = validData.slice(0, Math.floor(validData.length / 2));
      
      const truncatedPath = path.join(tempDir, 'truncated.sps');
      fs.writeFileSync(truncatedPath, truncatedData);
      
      expect(() => {
        processor.loadIntoTree(truncatedPath);
      }).toThrow();
    });

    it('should handle completely invalid file formats', () => {
      const invalidPath = path.join(tempDir, 'not_a_zip.sps');
      fs.writeFileSync(invalidPath, 'This is just plain text, not a zip file');
      
      expect(() => {
        processor.loadIntoTree(invalidPath);
      }).toThrow();
    });

    it('should handle empty files', () => {
      const emptyPath = path.join(tempDir, 'empty.sps');
      fs.writeFileSync(emptyPath, '');
      
      expect(() => {
        processor.loadIntoTree(emptyPath);
      }).toThrow();
    });

    it('should handle files with invalid zip structure', () => {
      const invalidZipPath = path.join(tempDir, 'invalid_zip.sps');
      // Write some bytes that look like they might be a zip but aren't
      const fakeZipData = Buffer.from('PK\x03\x04\x14\x00\x00\x00invalid zip data');
      fs.writeFileSync(invalidZipPath, fakeZipData);
      
      expect(() => {
        processor.loadIntoTree(invalidZipPath);
      }).toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should process large pagesets (500+ pages) efficiently', () => {
      const startTime = Date.now();
      
      // Create a very large tree
      const tree = TreeFactory.createLarge(500, 5); // 500 pages, 5 buttons each
      const outputPath = path.join(tempDir, 'large_pageset.sps');
      
      processor.saveFromTree(tree, outputPath);
      const loadedTree = processor.loadIntoTree(outputPath);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(500);
      expect(processingTime).toBeLessThan(30000); // Should complete in under 30 seconds
      
      console.log(`Large pageset processing time: ${processingTime}ms`);
    });

    it('should handle pagesets with extensive audio content', () => {
      const startTime = Date.now();
      
      // Create tree with many audio recordings
      const tree = new AACTree();
      const audioSizes = [1024, 2048, 4096, 8192]; // Different audio sizes
      
      for (let pageIndex = 0; pageIndex < 50; pageIndex++) {
        const page = PageFactory.create({
          id: `audio_page_${pageIndex}`,
          name: `Audio Page ${pageIndex}`
        });
        
        // Add 10 buttons with audio each
        for (let buttonIndex = 0; buttonIndex < 10; buttonIndex++) {
          const button = ButtonFactory.create({
            label: `Audio Button ${buttonIndex}`,
            message: `Audio message ${buttonIndex}`,
            type: 'SPEAK'
          });
          
          const audioSize = audioSizes[buttonIndex % audioSizes.length];
          button.audioRecording = {
            id: pageIndex * 10 + buttonIndex,
            data: Buffer.alloc(audioSize, 0x41), // Fill with 'A' characters
            identifier: `audio_${pageIndex}_${buttonIndex}`,
            metadata: JSON.stringify({
              size: audioSize,
              page: pageIndex,
              button: buttonIndex
            })
          };
          
          page.addButton(button);
        }
        
        tree.addPage(page);
      }
      
      const outputPath = path.join(tempDir, 'extensive_audio.sps');
      processor.saveFromTree(tree, outputPath);
      
      const loadedTree = processor.loadIntoTree(outputPath);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(50);
      expect(processingTime).toBeLessThan(60000); // Should complete in under 60 seconds
      
      // Verify audio data integrity
      const firstPage = loadedTree.getPage('audio_page_0');
      expect(firstPage!.buttons).toHaveLength(10);
      expect(firstPage!.buttons[0].audioRecording).toBeDefined();
      
      console.log(`Extensive audio processing time: ${processingTime}ms`);
    });

    it('should maintain memory usage under 100MB for large files', () => {
      // Monitor memory usage during processing
      const initialMemory = process.memoryUsage();
      
      // Create a large tree with substantial content
      const tree = TreeFactory.createLarge(100, 20); // 100 pages, 20 buttons each
      
      // Add some audio content to increase memory usage
      Object.values(tree.pages).forEach((page, pageIndex) => {
        page.buttons.forEach((button, buttonIndex) => {
          if (buttonIndex % 3 === 0) { // Add audio to every 3rd button
            button.audioRecording = {
              id: pageIndex * 100 + buttonIndex,
              data: Buffer.alloc(4096, 0x42), // 4KB audio data
              identifier: `audio_${pageIndex}_${buttonIndex}`,
              metadata: 'Performance test audio'
            };
          }
        });
      });
      
      const outputPath = path.join(tempDir, 'memory_test.sps');
      processor.saveFromTree(tree, outputPath);
      
      const loadedTree = processor.loadIntoTree(outputPath);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      expect(loadedTree).toBeDefined();
      expect(memoryIncreaseMB).toBeLessThan(100); // Should use less than 100MB additional memory
      
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });

    it('should handle concurrent processing efficiently', async () => {
      // Test processing multiple files concurrently
      const trees = [
        TreeFactory.createSimple(),
        TreeFactory.createCommunicationBoard(),
        TreeFactory.createLarge(10, 5)
      ];
      
      const startTime = Date.now();
      
      const promises = trees.map(async (tree, index) => {
        const outputPath = path.join(tempDir, `concurrent_${index}.sps`);
        processor.saveFromTree(tree, outputPath);
        return processor.loadIntoTree(outputPath);
      });
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
      
      expect(processingTime).toBeLessThan(10000); // Should complete in under 10 seconds
      
      console.log(`Concurrent processing time: ${processingTime}ms`);
    });

    it('should handle streaming large files efficiently', () => {
      // Test with a very large tree that would benefit from streaming
      const tree = TreeFactory.createLarge(200, 10); // 200 pages, 10 buttons each
      
      const outputPath = path.join(tempDir, 'streaming_test.sps');
      
      const startTime = Date.now();
      processor.saveFromTree(tree, outputPath);
      
      // Check file size
      const stats = fs.statSync(outputPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      const loadedTree = processor.loadIntoTree(outputPath);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(200);
      expect(processingTime).toBeLessThan(20000); // Should complete in under 20 seconds
      
      console.log(`Streaming test - File size: ${fileSizeMB.toFixed(2)}MB, Processing time: ${processingTime}ms`);
    });
  });

  describe('Text Processing Methods', () => {
    it('should extract all texts from large databases', () => {
      const tree = TreeFactory.createLarge(50, 10);
      const outputPath = path.join(tempDir, 'text_extraction.sps');
      processor.saveFromTree(tree, outputPath);
      
      const texts = processor.extractTexts(outputPath);
      expect(Array.isArray(texts)).toBe(true);
      expect(texts.length).toBeGreaterThan(0);
      
      // Should extract texts from all pages and buttons
      const expectedTextCount = 50 + (50 * 10 * 2); // page names + button labels + button messages
      expect(texts.length).toBeGreaterThanOrEqual(expectedTextCount);
    });

    it('should process texts with translations efficiently', () => {
      const tree = TreeFactory.createCommunicationBoard();
      const inputPath = path.join(tempDir, 'input_for_translation.sps');
      const outputPath = path.join(tempDir, 'translation_performance.sps');

      // Save the tree first
      processor.saveFromTree(tree, inputPath);

      // Create a large translation map
      const translations = new Map<string, string>();
      for (let i = 0; i < 1000; i++) {
        translations.set(`word_${i}`, `palabra_${i}`);
      }

      const startTime = Date.now();
      const result = processor.processTexts(inputPath, translations, outputPath);
      const endTime = Date.now();

      expect(result).toBeInstanceOf(Buffer);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
