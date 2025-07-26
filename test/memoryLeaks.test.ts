// Memory leak detection tests
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { DotProcessor } from '../src/processors/dotProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

describe('Memory Leak Detection Tests', () => {
  const tempDir = path.join(__dirname, 'temp_memory');
  
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

  // Helper function to get memory usage
  function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  // Helper function to force garbage collection if available
  function forceGC() {
    if (global.gc) {
      global.gc();
    }
  }

  // Helper function to create test data
  function createTestTree(pageCount: number = 5, buttonsPerPage: number = 10): AACTree {
    const tree = new AACTree();
    
    for (let p = 0; p < pageCount; p++) {
      const page = new AACPage({
        id: `page_${p}`,
        name: `Page ${p}`,
        buttons: []
      });
      
      for (let b = 0; b < buttonsPerPage; b++) {
        const button = new AACButton({
          id: `btn_${p}_${b}`,
          label: `Button ${b} on Page ${p}`,
          message: `Message for button ${b} on page ${p}`,
          type: Math.random() > 0.5 ? 'SPEAK' : 'NAVIGATE',
          targetPageId: Math.random() > 0.7 ? `page_${Math.floor(Math.random() * pageCount)}` : undefined
        });
        page.addButton(button);
      }
      
      tree.addPage(page);
    }
    
    return tree;
  }

  describe('Repeated Operations Memory Tests', () => {
    it('should not leak memory during repeated loadIntoTree operations', () => {
      const processor = new DotProcessor();
      const testContent = `
        digraph G {
          node1 [label="Test Node 1"];
          node2 [label="Test Node 2"];
          node3 [label="Test Node 3"];
          node1 -> node2 [label="Edge 1"];
          node2 -> node3 [label="Edge 2"];
        }
      `;
      
      const memBefore = getMemoryUsage();
      console.log('Memory before repeated loads:', memBefore);
      
      // Perform many load operations
      for (let i = 0; i < 50; i++) {
        const tree = processor.loadIntoTree(Buffer.from(testContent));
        expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
        
        // Force GC every 10 iterations
        if (i % 10 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const memAfter = getMemoryUsage();
      console.log('Memory after repeated loads:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Memory increase: ${memoryIncrease}MB`);
      
      // Should not increase memory significantly
      expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase
    });

    it('should not leak memory during repeated saveFromTree operations', () => {
      const processor = new DotProcessor();
      const testTree = createTestTree(3, 5);
      
      const memBefore = getMemoryUsage();
      console.log('Memory before repeated saves:', memBefore);
      
      // Perform many save operations
      for (let i = 0; i < 30; i++) {
        const outputPath = path.join(tempDir, `repeated_save_${i}.dot`);
        processor.saveFromTree(testTree, outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Clean up file immediately to avoid disk space issues
        fs.unlinkSync(outputPath);
        
        if (i % 10 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const memAfter = getMemoryUsage();
      console.log('Memory after repeated saves:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(15); // Less than 15MB increase
    });

    it('should not leak memory during repeated translation operations', () => {
      const processor = new DotProcessor();
      const testContent = `
        digraph G {
          hello [label="Hello"];
          world [label="World"];
          test [label="Test"];
          hello -> world [label="Go"];
        }
      `;
      
      const translations = new Map([
        ['Hello', 'Hola'],
        ['World', 'Mundo'],
        ['Test', 'Prueba'],
        ['Go', 'Ir']
      ]);
      
      const memBefore = getMemoryUsage();
      console.log('Memory before repeated translations:', memBefore);
      
      // Perform many translation operations
      for (let i = 0; i < 25; i++) {
        const outputPath = path.join(tempDir, `repeated_translation_${i}.dot`);
        const result = processor.processTexts(Buffer.from(testContent), translations, outputPath);
        
        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Clean up
        fs.unlinkSync(outputPath);
        
        if (i % 10 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const memAfter = getMemoryUsage();
      console.log('Memory after repeated translations:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(18); // Less than 18MB increase
    });
  });

  describe('Database Connection Memory Tests', () => {
    it('should not leak memory with repeated database operations', () => {
      const processor = new SnapProcessor();
      const testTree = createTestTree(2, 8);
      
      const memBefore = getMemoryUsage();
      console.log('Memory before repeated DB operations:', memBefore);
      
      // Perform many database operations
      for (let i = 0; i < 20; i++) {
        const dbPath = path.join(tempDir, `repeated_db_${i}.spb`);
        
        // Save to database
        processor.saveFromTree(testTree, dbPath);
        expect(fs.existsSync(dbPath)).toBe(true);
        
        // Load from database
        const loadedTree = processor.loadIntoTree(dbPath);
        expect(Object.keys(loadedTree.pages).length).toBe(Object.keys(testTree.pages).length);
        
        // Extract texts
        const texts = processor.extractTexts(dbPath);
        expect(texts.length).toBeGreaterThan(0);
        
        // Clean up
        fs.unlinkSync(dbPath);
        
        if (i % 5 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const memAfter = getMemoryUsage();
      console.log('Memory after repeated DB operations:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(25); // Less than 25MB increase
    });

    it('should properly close database connections', () => {
      const processor = new SnapProcessor();
      const testTree = createTestTree(1, 5);
      
      const memBefore = getMemoryUsage();
      
      // Create and immediately close many database connections
      for (let i = 0; i < 15; i++) {
        const dbPath = path.join(tempDir, `connection_test_${i}.spb`);
        
        try {
          processor.saveFromTree(testTree, dbPath);
          const loadedTree = processor.loadIntoTree(dbPath);
          expect(Object.keys(loadedTree.pages).length).toBeGreaterThan(0);
        } finally {
          // Clean up
          if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
          }
        }
        
        if (i % 5 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const memAfter = getMemoryUsage();
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`DB connection memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(20);
    });
  });

  describe('Large Data Memory Tests', () => {
    it('should handle large trees without excessive memory retention', () => {
      const processor = new DotProcessor();
      
      const memBefore = getMemoryUsage();
      console.log('Memory before large tree test:', memBefore);
      
      // Create and process large trees
      for (let i = 0; i < 5; i++) {
        const largeTree = createTestTree(20, 25); // 20 pages, 25 buttons each = 500 buttons
        
        const outputPath = path.join(tempDir, `large_tree_${i}.dot`);
        processor.saveFromTree(largeTree, outputPath);
        
        const reloadedTree = processor.loadIntoTree(outputPath);
        expect(Object.keys(reloadedTree.pages).length).toBe(20);
        
        // Clean up
        fs.unlinkSync(outputPath);
        
        // Force GC after each large operation
        forceGC();
      }
      
      const memAfter = getMemoryUsage();
      console.log('Memory after large tree test:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Large tree memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(30); // Less than 30MB increase
    });

    it('should handle large translation maps without memory leaks', () => {
      const processor = new DotProcessor();
      
      // Create content with many nodes
      const lines = ['digraph G {'];
      for (let i = 0; i < 200; i++) {
        lines.push(`  node${i} [label="Text ${i}"];`);
      }
      lines.push('}');
      const largeContent = lines.join('\n');
      
      // Create large translation map
      const largeTranslations = new Map<string, string>();
      for (let i = 0; i < 200; i++) {
        largeTranslations.set(`Text ${i}`, `Texto ${i}`);
      }
      
      const memBefore = getMemoryUsage();
      console.log('Memory before large translation test:', memBefore);
      
      // Perform translation multiple times
      for (let i = 0; i < 5; i++) {
        const outputPath = path.join(tempDir, `large_translation_${i}.dot`);
        const result = processor.processTexts(Buffer.from(largeContent), largeTranslations, outputPath);
        
        expect(result).toBeInstanceOf(Buffer);
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Verify some translations
        const translatedContent = result.toString('utf8');
        expect(translatedContent).toContain('Texto 0');
        expect(translatedContent).toContain('Texto 199');
        
        // Clean up
        fs.unlinkSync(outputPath);
        
        forceGC();
      }
      
      const memAfter = getMemoryUsage();
      console.log('Memory after large translation test:', memAfter);
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      console.log(`Large translation memory increase: ${memoryIncrease}MB`);
      
      expect(memoryIncrease).toBeLessThan(35); // Less than 35MB increase
    });
  });

  describe('Long-Running Operation Memory Tests', () => {
    it('should maintain stable memory during extended operations', () => {
      const processor = new DotProcessor();
      const testContent = 'digraph G { test [label="Extended Test"]; }';
      
      const memorySnapshots: number[] = [];
      const startTime = performance.now();
      
      // Run operations for a period of time
      let operationCount = 0;
      const maxOperations = 100;
      
      for (let i = 0; i < maxOperations; i++) {
        const tree = processor.loadIntoTree(Buffer.from(testContent));
        const texts = processor.extractTexts(Buffer.from(testContent));
        
        expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
        expect(texts.length).toBeGreaterThan(0);
        
        operationCount++;
        
        // Take memory snapshots every 20 operations
        if (i % 20 === 0) {
          forceGC();
          const currentMemory = getMemoryUsage();
          memorySnapshots.push(currentMemory.heapUsed);
          console.log(`Operation ${i}: ${currentMemory.heapUsed}MB`);
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Completed ${operationCount} operations in ${totalTime.toFixed(2)}ms`);
      console.log('Memory snapshots:', memorySnapshots);
      
      // Memory should remain relatively stable
      const maxMemory = Math.max(...memorySnapshots);
      const minMemory = Math.min(...memorySnapshots);
      const memoryVariation = maxMemory - minMemory;
      
      console.log(`Memory variation: ${memoryVariation}MB (${minMemory}MB - ${maxMemory}MB)`);
      
      // Memory variation should be reasonable
      expect(memoryVariation).toBeLessThan(15); // Less than 15MB variation
    });

    it('should clean up temporary resources properly', () => {
      const processor = new SnapProcessor();
      
      const memBefore = getMemoryUsage();
      const tempFilesBefore = fs.readdirSync(require('os').tmpdir()).length;
      
      // Perform operations that create temporary files
      for (let i = 0; i < 10; i++) {
        const testTree = createTestTree(1, 3);
        const dbPath = path.join(tempDir, `temp_cleanup_${i}.spb`);
        
        processor.saveFromTree(testTree, dbPath);
        
        // Process with buffer (creates temp files)
        const buffer = fs.readFileSync(dbPath);
        const reloadedTree = processor.loadIntoTree(buffer);
        expect(Object.keys(reloadedTree.pages).length).toBeGreaterThan(0);
        
        // Clean up main file
        fs.unlinkSync(dbPath);
        
        if (i % 3 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      
      // Give some time for cleanup
      setTimeout(() => {
        const memAfter = getMemoryUsage();
        const tempFilesAfter = fs.readdirSync(require('os').tmpdir()).length;
        
        const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
        const tempFileIncrease = tempFilesAfter - tempFilesBefore;
        
        console.log(`Temp cleanup - Memory: +${memoryIncrease}MB, Temp files: +${tempFileIncrease}`);
        
        expect(memoryIncrease).toBeLessThan(20);
        expect(tempFileIncrease).toBeLessThan(5); // Should clean up most temp files
      }, 200);
    });
  });
});
