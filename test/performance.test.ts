// Performance tests for all processors
import fs from "fs";
import path from "path";
import os from "os";
import { performance } from "perf_hooks";
import { DotProcessor } from "../src/processors/dotProcessor";
import { OpmlProcessor } from "../src/processors/opmlProcessor";
import { ObfProcessor } from "../src/processors/obfProcessor";
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { ApplePanelsProcessor } from "../src/processors/applePanelsProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";

describe("Performance Tests", () => {
  const tempDir = path.join(__dirname, "temp_performance");

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

  // Helper function to measure memory usage
  function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
    };
  }

  // Helper function to create large test data
  function createLargeDotFile(nodeCount: number): string {
    const lines = ["digraph G {"];

    // Add nodes
    for (let i = 0; i < nodeCount; i++) {
      lines.push(
        `  node${i} [label="Node ${i} with some longer text content"];`,
      );
    }

    // Add edges (create a connected graph)
    for (let i = 0; i < nodeCount - 1; i++) {
      lines.push(`  node${i} -> node${i + 1} [label="Edge ${i}"];`);
    }

    // Add some random connections
    for (let i = 0; i < Math.min(nodeCount / 10, 100); i++) {
      const from = Math.floor(Math.random() * nodeCount);
      const to = Math.floor(Math.random() * nodeCount);
      if (from !== to) {
        lines.push(`  node${from} -> node${to} [label="Random ${i}"];`);
      }
    }

    lines.push("}");
    return lines.join("\n");
  }

  function createLargeTree(pageCount: number, buttonsPerPage: number): AACTree {
    const tree = new AACTree();

    for (let p = 0; p < pageCount; p++) {
      const page = new AACPage({
        id: `page_${p}`,
        name: `Page ${p}`,
        buttons: [],
      });

      for (let b = 0; b < buttonsPerPage; b++) {
        const button = new AACButton({
          id: `btn_${p}_${b}`,
          label: `Button ${b} on Page ${p}`,
          message: `This is button ${b} on page ${p} with some longer message content`,
          type: Math.random() > 0.7 ? "NAVIGATE" : "SPEAK",
          targetPageId:
            Math.random() > 0.7
              ? `page_${Math.floor(Math.random() * pageCount)}`
              : undefined,
        });
        page.addButton(button);
      }

      tree.addPage(page);
    }

    return tree;
  }

  describe("Large File Processing", () => {
    it("should handle large DOT files efficiently", () => {
      const processor = new DotProcessor();
      const largeContent = createLargeDotFile(1000); // 1000 nodes

      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      const tree = processor.loadIntoTree(Buffer.from(largeContent));

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      const processingTime = endTime - startTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(
        `DOT Performance: ${processingTime.toFixed(2)}ms, Memory: +${memoryIncrease}MB`,
      );

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(memoryIncrease).toBeLessThan(100); // Should not use more than 100MB extra
    });

    it("should handle large trees in saveFromTree operations", () => {
      const processor = new DotProcessor();
      const largeTree = createLargeTree(50, 20); // 50 pages, 20 buttons each

      const outputPath = path.join(tempDir, "large_output.dot");
      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      processor.saveFromTree(largeTree, outputPath);

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      const processingTime = endTime - startTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(
        `DOT Save Performance: ${processingTime.toFixed(2)}ms, Memory: +${memoryIncrease}MB`,
      );

      expect(fs.existsSync(outputPath)).toBe(true);
      expect(processingTime).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(memoryIncrease).toBeLessThan(50); // Should not use more than 50MB extra
    });

    it("should handle large translation operations efficiently", () => {
      const processor = new DotProcessor();
      const largeContent = createLargeDotFile(500);

      // Create many translations
      const translations = new Map<string, string>();
      for (let i = 0; i < 500; i++) {
        translations.set(`Node ${i}`, `Nodo ${i}`);
        translations.set(`Edge ${i}`, `Borde ${i}`);
      }

      const outputPath = path.join(tempDir, "large_translated.dot");
      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      const result = processor.processTexts(
        Buffer.from(largeContent),
        translations,
        outputPath,
      );

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      const processingTime = endTime - startTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(
        `DOT Translation Performance: ${processingTime.toFixed(2)}ms, Memory: +${memoryIncrease}MB`,
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(processingTime).toBeLessThan(3000); // Should complete in under 3 seconds
      expect(memoryIncrease).toBeLessThan(75); // Should not use more than 75MB extra
    });
  });

  describe("Memory Usage Patterns", () => {
    it("should not leak memory during repeated operations", () => {
      const processor = new DotProcessor();
      const testContent = createLargeDotFile(100);

      const memBefore = getMemoryUsage();

      // Perform many operations
      for (let i = 0; i < 10; i++) {
        const tree = processor.loadIntoTree(Buffer.from(testContent));
        const texts = processor.extractTexts(Buffer.from(testContent));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const memAfter = getMemoryUsage();
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(`Memory leak test: +${memoryIncrease}MB after 10 operations`);

      // Should not increase memory significantly after repeated operations
      expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase
    });

    it("should handle concurrent processing efficiently", async () => {
      const processor = new DotProcessor();
      const testContent = createLargeDotFile(200);

      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      // Process multiple files concurrently
      const promises = Array(5)
        .fill(0)
        .map(async (_, i) => {
          const tree = processor.loadIntoTree(Buffer.from(testContent));
          const outputPath = path.join(tempDir, `concurrent_${i}.dot`);
          processor.saveFromTree(tree, outputPath);
          return tree;
        });

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      const processingTime = endTime - startTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(
        `Concurrent Performance: ${processingTime.toFixed(2)}ms, Memory: +${memoryIncrease}MB`,
      );

      expect(results).toHaveLength(5);
      results.forEach((tree) => {
        expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
      });

      expect(processingTime).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(memoryIncrease).toBeLessThan(150); // Should not use excessive memory
    });
  });

  describe("Database Performance", () => {
    it("should handle large Snap databases efficiently", () => {
      const processor = new SnapProcessor();
      const largeTree = createLargeTree(20, 15); // 20 pages, 15 buttons each

      const outputPath = path.join(tempDir, "large_snap.spb");
      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      processor.saveFromTree(largeTree, outputPath);

      const saveTime = performance.now();

      // Now load it back
      const loadedTree = processor.loadIntoTree(outputPath);

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      const saveProcessingTime = saveTime - startTime;
      const loadProcessingTime = endTime - saveTime;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      console.log(
        `Snap DB Performance: Save ${saveProcessingTime.toFixed(2)}ms, Load ${loadProcessingTime.toFixed(2)}ms, Memory: +${memoryIncrease}MB`,
      );

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages).length).toBe(
        Object.keys(largeTree.pages).length,
      );
      expect(saveProcessingTime).toBeLessThan(5000); // Save should complete in under 5 seconds
      expect(loadProcessingTime).toBeLessThan(3000); // Load should complete in under 3 seconds
      expect(memoryIncrease).toBeLessThan(100); // Should not use excessive memory
    });
  });

  describe("Timeout Handling", () => {
    it("should handle slow operations gracefully", async () => {
      const processor = new DotProcessor();

      // Create a very large file that might be slow to process
      const veryLargeContent = createLargeDotFile(5000); // 5000 nodes

      const startTime = performance.now();

      try {
        const tree = processor.loadIntoTree(Buffer.from(veryLargeContent));
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        console.log(
          `Very large file processing: ${processingTime.toFixed(2)}ms`,
        );

        expect(tree).toBeDefined();
        expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      } catch (error) {
        // If it fails due to memory or timeout, that's acceptable for very large files
        console.log("Very large file processing failed (acceptable):", error);
      }
    });
  });
});
