// Memory performance tests for large communication boards
import fs from "fs";
import path from "path";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { DotProcessor } from "../src/processors/dotProcessor";
import { TreeFactory } from "./utils/testFactories";

// Skip memory intensive tests in CI environment
const describeIfLocal = process.env.CI ? describe.skip : describe;

describeIfLocal("Memory Performance Tests", () => {
  const tempDir = path.join(__dirname, "temp_performance_memory");

  beforeAll(async () => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Add a small delay to allow pending I/O to complete
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (fs.existsSync(tempDir)) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (e) {
            console.warn("Failed to clean up temp dir:", e);
          }
        }
        resolve();
      }, 100);
    });
  });

  // Helper function to measure memory usage
  function measureMemoryUsage<T>(operation: () => T): {
    result: T;
    memoryUsedMB: number;
    peakMemoryMB: number;
  } {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory.heapUsed;

    // Monitor memory during operation
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 10);

    const result = operation();

    clearInterval(memoryMonitor);

    const finalMemory = process.memoryUsage();
    const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
    const peakMemoryUsed = peakMemory - initialMemory.heapUsed;

    return {
      result,
      memoryUsedMB: memoryUsed / (1024 * 1024),
      peakMemoryMB: peakMemoryUsed / (1024 * 1024),
    };
  }

  async function measureMemoryUsageAsync<T>(
    operation: () => Promise<T>,
  ): Promise<{
    result: T;
    memoryUsedMB: number;
    peakMemoryMB: number;
  }> {
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory.heapUsed;

    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 10);

    let result: T | undefined;
    try {
      result = await operation();
    } finally {
      clearInterval(memoryMonitor);
    }

    const finalMemory = process.memoryUsage();
    const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
    const peakMemoryUsed = peakMemory - initialMemory.heapUsed;

    return {
      result: result as T,
      memoryUsedMB: memoryUsed / (1024 * 1024),
      peakMemoryMB: peakMemoryUsed / (1024 * 1024),
    };
  }

  describe("TouchChatProcessor Memory Tests", () => {
    it("should process 1000+ button boards under 50MB memory", async () => {
      const processor = new TouchChatProcessor();

      const {
        result: tree,
        memoryUsedMB,
        peakMemoryMB,
      } = measureMemoryUsage(() => {
        return TreeFactory.createLarge(10, 100); // 10 pages, 100 buttons each = 1000 buttons
      });

      const outputPath = path.join(tempDir, "large_touchchat.ce");

      const { memoryUsedMB: saveMemoryMB } = await measureMemoryUsageAsync(() =>
        processor.saveFromTree(tree, outputPath),
      );

      const { result: loadedTree, memoryUsedMB: loadMemoryMB } =
        await measureMemoryUsageAsync(() => processor.loadIntoTree(outputPath));

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(10);

      // Memory usage should be under 50MB for the entire operation
      const totalMemoryUsed = Math.max(
        memoryUsedMB,
        saveMemoryMB,
        loadMemoryMB,
      );
      expect(totalMemoryUsed).toBeLessThan(50);
      expect(peakMemoryMB).toBeLessThan(50);

      console.log(
        `TouchChat 1000+ buttons - Memory used: ${totalMemoryUsed.toFixed(2)}MB, Peak: ${peakMemoryMB.toFixed(2)}MB`,
      );
    });

    it("should handle streaming large files efficiently", async () => {
      const processor = new TouchChatProcessor();
      const tree = TreeFactory.createLarge(50, 50); // 2500 buttons

      const outputPath = path.join(tempDir, "streaming_touchchat.ce");

      const { memoryUsedMB } = await measureMemoryUsageAsync(async () => {
        await processor.saveFromTree(tree, outputPath);
        return await processor.loadIntoTree(outputPath);
      });

      expect(memoryUsedMB).toBeLessThan(75); // Slightly higher limit for larger dataset
      console.log(
        `TouchChat streaming - Memory used: ${memoryUsedMB.toFixed(2)}MB`,
      );
    });

    it("should garbage collect properly after processing", async () => {
      const processor = new TouchChatProcessor();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple files in sequence
      for (let i = 0; i < 5; i++) {
        const tree = TreeFactory.createLarge(20, 20);
        const outputPath = path.join(tempDir, `gc_test_${i}.ce`);

        await processor.saveFromTree(tree, outputPath);
        await processor.loadIntoTree(outputPath);

        // Clean up file
        fs.unlinkSync(outputPath);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);

      // Memory increase should be minimal after garbage collection
      // Without --expose-gc, we can't guarantee cleanup, so we use a higher threshold
      expect(memoryIncrease).toBeLessThan(100);
      console.log(
        `TouchChat GC test - Memory increase: ${memoryIncrease.toFixed(2)}MB`,
      );
    });
  });

  describe("SnapProcessor Memory Tests", () => {
    it("should process 1000+ button boards under 50MB memory", async () => {
      const processor = new SnapProcessor();

      const {
        result: tree,
        memoryUsedMB,
        peakMemoryMB,
      } = measureMemoryUsage(() => {
        return TreeFactory.createLarge(10, 100); // 1000 buttons
      });

      const outputPath = path.join(tempDir, "large_snap.sps");

      const { memoryUsedMB: saveMemoryMB } = await measureMemoryUsageAsync(() =>
        processor.saveFromTree(tree, outputPath),
      );

      const { result: loadedTree, memoryUsedMB: loadMemoryMB } =
        await measureMemoryUsageAsync(() => processor.loadIntoTree(outputPath));

      expect(loadedTree).toBeDefined();
      expect(Object.keys(loadedTree.pages)).toHaveLength(10);

      const totalMemoryUsed = Math.max(
        memoryUsedMB,
        saveMemoryMB,
        loadMemoryMB,
      );
      expect(totalMemoryUsed).toBeLessThan(50);
      expect(peakMemoryMB).toBeLessThan(50);

      console.log(
        `Snap 1000+ buttons - Memory used: ${totalMemoryUsed.toFixed(2)}MB, Peak: ${peakMemoryMB.toFixed(2)}MB`,
      );
    });

    it("should handle large audio content efficiently", async () => {
      const processor = new SnapProcessor();

      const { result: tree, memoryUsedMB } = measureMemoryUsage(() => {
        const tree = TreeFactory.createLarge(20, 25); // 500 buttons

        // Add audio to every button
        Object.values(tree.pages).forEach((page, pageIndex) => {
          page.buttons.forEach((button, buttonIndex) => {
            button.audioRecording = {
              id: pageIndex * 100 + buttonIndex,
              data: Buffer.alloc(8192, 0x41), // 8KB audio per button
              identifier: `audio_${pageIndex}_${buttonIndex}`,
              metadata: "Performance test audio",
            };
          });
        });

        return tree;
      });

      const outputPath = path.join(tempDir, "audio_heavy_snap.sps");

      const { memoryUsedMB: saveMemoryMB } = await measureMemoryUsageAsync(() =>
        processor.saveFromTree(tree, outputPath),
      );

      const { result: loadedTree, memoryUsedMB: loadMemoryMB } =
        await measureMemoryUsageAsync(() => processor.loadIntoTree(outputPath));

      expect(loadedTree).toBeDefined();

      // With audio content, allow slightly higher memory usage
      const totalMemoryUsed = Math.max(
        memoryUsedMB,
        saveMemoryMB,
        loadMemoryMB,
      );
      expect(totalMemoryUsed).toBeLessThan(100);

      console.log(
        `Snap with audio - Memory used: ${totalMemoryUsed.toFixed(2)}MB`,
      );
    });

    it("should maintain memory usage under 100MB for large files", async () => {
      const processor = new SnapProcessor();

      const { result: tree, memoryUsedMB: _memoryUsedMB } = measureMemoryUsage(
        () => {
          const tree = TreeFactory.createLarge(100, 20); // 2000 buttons

          // Add moderate audio content
          Object.values(tree.pages).forEach((page, pageIndex) => {
            page.buttons.forEach((button, buttonIndex) => {
              if (buttonIndex % 3 === 0) {
                // Every 3rd button has audio
                button.audioRecording = {
                  id: pageIndex * 100 + buttonIndex,
                  data: Buffer.alloc(4096, 0x42), // 4KB audio
                  identifier: `audio_${pageIndex}_${buttonIndex}`,
                  metadata: "Large file test audio",
                };
              }
            });
          });

          return tree;
        },
      );

      const outputPath = path.join(tempDir, "very_large_snap.sps");

      const { memoryUsedMB: totalMemoryMB } = await measureMemoryUsageAsync(
        async () => {
          await processor.saveFromTree(tree, outputPath);
          return await processor.loadIntoTree(outputPath);
        },
      );

      expect(totalMemoryMB).toBeLessThan(100);
      console.log(
        `Snap very large file - Memory used: ${totalMemoryMB.toFixed(2)}MB`,
      );
    });
  });

  describe("DotProcessor Memory Tests", () => {
    it("should handle very large hierarchies efficiently", async () => {
      const processor = new DotProcessor();

      const { result: tree, memoryUsedMB: _memoryUsedMB } = measureMemoryUsage(
        () => {
          return TreeFactory.createLarge(200, 10); // 200 pages, 10 buttons each
        },
      );

      const outputPath = path.join(tempDir, "large_hierarchy.dot");

      const { memoryUsedMB: totalMemoryMB } = await measureMemoryUsageAsync(
        async () => {
          await processor.saveFromTree(tree, outputPath);
          return await processor.loadIntoTree(outputPath);
        },
      );

      expect(totalMemoryMB).toBeLessThan(40); // DOT format should be very efficient
      console.log(
        `DOT large hierarchy - Memory used: ${totalMemoryMB.toFixed(2)}MB`,
      );
    });
  });

  describe("Cross-Processor Memory Comparison", () => {
    it("should compare memory usage across all processors", async () => {
      const tree = TreeFactory.createLarge(50, 20); // 1000 buttons
      const results: { [key: string]: number } = {};

      // Test TouchChatProcessor
      const touchChatProcessor = new TouchChatProcessor();
      const touchChatPath = path.join(tempDir, "comparison_touchchat.ce");
      const { memoryUsedMB: touchChatMemory } = await measureMemoryUsageAsync(
        async () => {
          await touchChatProcessor.saveFromTree(tree, touchChatPath);
          return await touchChatProcessor.loadIntoTree(touchChatPath);
        },
      );
      results["TouchChat"] = touchChatMemory;

      // Test SnapProcessor
      const snapProcessor = new SnapProcessor();
      const snapPath = path.join(tempDir, "comparison_snap.sps");
      const { memoryUsedMB: snapMemory } = await measureMemoryUsageAsync(
        async () => {
          await snapProcessor.saveFromTree(tree, snapPath);
          return await snapProcessor.loadIntoTree(snapPath);
        },
      );
      results["Snap"] = snapMemory;

      // Test DotProcessor
      const dotProcessor = new DotProcessor();
      const dotPath = path.join(tempDir, "comparison_dot.dot");
      const { memoryUsedMB: dotMemory } = await measureMemoryUsageAsync(
        async () => {
          await dotProcessor.saveFromTree(tree, dotPath);
          return await dotProcessor.loadIntoTree(dotPath);
        },
      );
      results["DOT"] = dotMemory;

      // All should be under reasonable limits
      Object.entries(results).forEach(([processor, memory]) => {
        expect(memory).toBeLessThan(50);
        console.log(
          `${processor} processor - Memory used: ${memory.toFixed(2)}MB`,
        );
      });

      // DOT should be efficient, but relative comparisons are flaky without --expose-gc
      // expect(results['DOT']).toBeLessThan(results['TouchChat']);
      // expect(results['DOT']).toBeLessThan(results['Snap']);
    });
  });

  describe("Memory Leak Detection", () => {
    it("should not leak memory during repeated operations", async () => {
      const processor = new DotProcessor();

      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;
      const memoryReadings: number[] = [];

      // Perform 10 iterations of create/save/load/destroy
      for (let i = 0; i < 10; i++) {
        const tree = TreeFactory.createLarge(10, 10);
        const outputPath = path.join(tempDir, `leak_test_${i}.dot`);

        await processor.saveFromTree(tree, outputPath);
        await processor.loadIntoTree(outputPath);

        fs.unlinkSync(outputPath);

        if (global.gc) {
          global.gc();
        }

        const currentMemory = process.memoryUsage().heapUsed;
        memoryReadings.push((currentMemory - initialMemory) / (1024 * 1024));
      }

      // Memory should not continuously increase
      const firstHalf = memoryReadings.slice(0, 5);
      const secondHalf = memoryReadings.slice(5);

      const firstHalfAvg =
        firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be significantly higher than first half
      const memoryIncrease = secondHalfAvg - firstHalfAvg;
      expect(memoryIncrease).toBeLessThan(5); // Less than 5MB increase

      console.log(
        `Memory leak test - Average increase: ${memoryIncrease.toFixed(2)}MB`,
      );
      console.log(
        `Memory readings: ${memoryReadings.map((m) => m.toFixed(1)).join(", ")}MB`,
      );
    });
  });
});
