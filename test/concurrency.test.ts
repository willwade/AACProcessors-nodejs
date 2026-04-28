// Concurrent access and thread safety tests
import fs from 'fs';
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

const runDelayed = <T>(delayMs: number, task: () => Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      task().then(resolve).catch(reject);
    }, delayMs);
  });

describe('Concurrency and Thread Safety Tests', () => {
  const tempDir = path.join(__dirname, 'temp_concurrency');

  beforeAll(async () => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Concurrent File Access', () => {
    it('should handle multiple processors reading the same file simultaneously', async () => {
      const testContent = `
        digraph G {
          home [label="Home"];
          food [label="Food"];
          drinks [label="Drinks"];
          home -> food [label="Go to Food"];
          home -> drinks [label="Go to Drinks"];
        }
      `;

      const testFile = path.join(tempDir, 'concurrent_read.dot');
      fs.writeFileSync(testFile, testContent);

      // Create multiple processors
      const processors = Array(5)
        .fill(0)
        .map(() => new DotProcessor());

      // Read the same file concurrently
      const readPromises = processors.map((processor, index) =>
        runDelayed(Math.random() * 100, async () => {
          const tree = await processor.loadIntoTree(testFile);
          const texts = await processor.extractTexts(testFile);
          return {
            processorIndex: index,
            pageCount: Object.keys(tree.pages).length,
            textCount: texts.length,
          };
        })
      );

      const results = await Promise.all(readPromises);

      // All should succeed with same results
      expect(results).toHaveLength(5);
      results.forEach((result: any) => {
        expect(result.pageCount).toBeGreaterThan(0);
        expect(result.textCount).toBeGreaterThan(0);
      });

      // Results should be consistent
      const firstResult = results[0] as any;
      results.forEach((result: any) => {
        expect(result.pageCount).toBe(firstResult.pageCount);
        expect(result.textCount).toBe(firstResult.textCount);
      });
    });

    it('should handle concurrent write operations safely', async () => {
      const processor = new DotProcessor();

      // Create test trees
      const trees = Array(3)
        .fill(0)
        .map((_, index) => {
          const tree = new AACTree();
          const page = new AACPage({
            id: `page_${index}`,
            name: `Page ${index}`,
            buttons: [],
          });

          const button = new AACButton({
            id: `btn_${index}`,
            label: `Button ${index}`,
            message: `Message ${index}`,
            type: 'SPEAK',
          });

          page.addButton(button);
          tree.addPage(page);
          return tree;
        });

      // Write to different files concurrently
      const writePromises = trees.map((tree, index) => {
        const outputPath = path.join(tempDir, `concurrent_write_${index}.dot`);
        return runDelayed(Math.random() * 50, async () => {
          await processor.saveFromTree(tree, outputPath);
          return {
            index,
            outputPath,
            exists: fs.existsSync(outputPath),
          };
        });
      });

      const results = await Promise.all(writePromises);

      // All writes should succeed
      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.exists).toBe(true);
        expect(fs.existsSync(result.outputPath)).toBe(true);
      });
    });
  });

  describe('Database Concurrency', () => {
    it('should handle concurrent SQLite database access', async () => {
      const processor = new SnapProcessor();

      // Create a test database
      const tree = new AACTree();
      const page = new AACPage({
        id: 'test_page',
        name: 'Test Page',
        buttons: [],
      });

      for (let i = 0; i < 10; i++) {
        const button = new AACButton({
          id: `btn_${i}`,
          label: `Button ${i}`,
          message: `Message ${i}`,
          type: 'SPEAK',
        });
        page.addButton(button);
      }

      tree.addPage(page);

      const dbPath = path.join(tempDir, 'concurrent_test.spb');
      await processor.saveFromTree(tree, dbPath);

      // Read from the same database concurrently
      const readPromises = Array(3)
        .fill(0)
        .map((_, index) =>
          runDelayed(Math.random() * 100, async () => {
            const readProcessor = new SnapProcessor();
            const loadedTree = await readProcessor.loadIntoTree(dbPath);
            const texts = await readProcessor.extractTexts(dbPath);

            return {
              readerIndex: index,
              pageCount: Object.keys(loadedTree.pages).length,
              textCount: texts.length,
            };
          })
        );

      const results = await Promise.all(readPromises);

      // All reads should succeed
      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.pageCount).toBe(1);
        expect(result.textCount).toBeGreaterThan(0);
      });
    });

    it('should handle database creation race conditions', async () => {
      const createPromises = Array(3)
        .fill(0)
        .map((_, index) =>
          runDelayed(Math.random() * 50, async () => {
            const processor = new SnapProcessor();
            const tree = new AACTree();
            const page = new AACPage({
              id: `race_page_${index}`,
              name: `Race Page ${index}`,
              buttons: [],
            });

            const button = new AACButton({
              id: `race_btn_${index}`,
              label: `Race Button ${index}`,
              message: `Race Message ${index}`,
              type: 'SPEAK',
            });

            page.addButton(button);
            tree.addPage(page);

            const dbPath = path.join(tempDir, `race_test_${index}.spb`);
            await processor.saveFromTree(tree, dbPath);

            return {
              index,
              dbPath,
              exists: fs.existsSync(dbPath),
            };
          })
        );

      const results = await Promise.all(createPromises);

      // All database creations should succeed
      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.exists).toBe(true);
      });
    });
  });

  describe('Resource Contention', () => {
    it('should handle high-frequency operations without resource exhaustion', async () => {
      const processor = new DotProcessor();
      const testContent = 'digraph G { test [label="High Frequency Test"]; }';

      const operations = Array(20)
        .fill(0)
        .map((_, index) =>
          runDelayed(index * 10, async () => {
            const tree = await processor.loadIntoTree(Buffer.from(testContent));
            const texts = await processor.extractTexts(Buffer.from(testContent));

            const outputPath = path.join(tempDir, `high_freq_${index}.dot`);
            await processor.saveFromTree(tree, outputPath);

            return {
              index,
              success: true,
              pageCount: Object.keys(tree.pages).length,
              textCount: texts.length,
            };
          })
        );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(20);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.pageCount).toBeGreaterThan(0);
      });
    });

    it('should handle mixed read/write operations', async () => {
      const processor = new DotProcessor();
      const baseContent = 'digraph G { base [label="Base Content"]; }';
      const baseFile = path.join(tempDir, 'mixed_base.dot');

      fs.writeFileSync(baseFile, baseContent);

      const mixedOperations = Array(10)
        .fill(0)
        .map((_, index) =>
          runDelayed(Math.random() * 100, async () => {
            if (index % 2 === 0) {
              const tree = await processor.loadIntoTree(baseFile);
              const texts = await processor.extractTexts(baseFile);

              return {
                index,
                operation: 'read',
                pageCount: Object.keys(tree.pages).length,
                textCount: texts.length,
              };
            }

            const tree = new AACTree();
            const page = new AACPage({
              id: `mixed_page_${index}`,
              name: `Mixed Page ${index}`,
              buttons: [],
            });

            const button = new AACButton({
              id: `mixed_btn_${index}`,
              label: `Mixed Button ${index}`,
              message: `Mixed Message ${index}`,
              type: 'SPEAK',
            });

            page.addButton(button);
            tree.addPage(page);

            const outputPath = path.join(tempDir, `mixed_write_${index}.dot`);
            await processor.saveFromTree(tree, outputPath);

            return {
              index,
              operation: 'write',
              outputPath,
              exists: fs.existsSync(outputPath),
            };
          })
        );

      const results = await Promise.all(mixedOperations);

      expect(results).toHaveLength(10);

      const readResults = results.filter((r: any) => r.operation === 'read');
      const writeResults = results.filter((r: any) => r.operation === 'write');

      expect(readResults.length).toBe(5);
      expect(writeResults.length).toBe(5);

      readResults.forEach((result: any) => {
        expect(result.pageCount).toBeGreaterThan(0);
        expect(result.textCount).toBeGreaterThan(0);
      });

      writeResults.forEach((result: any) => {
        expect(result.exists).toBe(true);
      });
    });
  });

  describe('Error Handling Under Concurrency', () => {
    it('should handle concurrent errors gracefully', async () => {
      const processor = new ObfProcessor();

      // Mix of valid and invalid operations
      const operations = Array(6)
        .fill(0)
        .map((_, index) =>
          runDelayed(Math.random() * 50, async () => {
            try {
              if (index % 2 === 0) {
                const validContent = '{"id": "test", "buttons": []}';
                const tree = await processor.loadIntoTree(Buffer.from(validContent));
                return {
                  index,
                  success: true,
                  pageCount: Object.keys(tree.pages).length,
                };
              }

              const invalidContent = '{"invalid": json}';
              await processor.loadIntoTree(Buffer.from(invalidContent));
              return {
                index,
                success: true,
                unexpected: true,
              };
            } catch (error) {
              return {
                index,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          })
        );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(6);

      const successResults = results.filter((r: any) => r.success === true);
      const errorResults = results.filter((r: any) => r.success === false);

      expect(successResults.length).toBe(3); // Even indices (valid operations)
      expect(errorResults.length).toBe(3); // Odd indices (invalid operations)

      // Errors should be handled gracefully
      errorResults.forEach((result: any) => {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      });
    });

    it('should maintain data integrity under concurrent stress', async () => {
      const processor = new DotProcessor();

      // Create a reference file
      const referenceContent = `
        digraph G {
          node1 [label="Node 1"];
          node2 [label="Node 2"];
          node3 [label="Node 3"];
          node1 -> node2 [label="Edge 1"];
          node2 -> node3 [label="Edge 2"];
        }
      `;

      const referenceFile = path.join(tempDir, 'integrity_reference.dot');
      fs.writeFileSync(referenceFile, referenceContent);

      // Get reference data
      const referenceTree = await processor.loadIntoTree(referenceFile);
      const referenceTexts = await processor.extractTexts(referenceFile);

      // Perform many concurrent reads
      const integrityChecks = Array(15)
        .fill(0)
        .map((_, index) =>
          runDelayed(Math.random() * 100, async () => {
            const tree = await processor.loadIntoTree(referenceFile);
            const texts = await processor.extractTexts(referenceFile);

            const pageCountMatch =
              Object.keys(tree.pages).length === Object.keys(referenceTree.pages).length;
            const textCountMatch = texts.length === referenceTexts.length;

            return {
              index,
              pageCountMatch,
              textCountMatch,
              integrity: pageCountMatch && textCountMatch,
            };
          })
        );

      const results = await Promise.all(integrityChecks);

      expect(results).toHaveLength(15);
      results.forEach((result: any) => {
        expect(result.integrity).toBe(true);
        expect(result.pageCountMatch).toBe(true);
        expect(result.textCountMatch).toBe(true);
      });
    });
  });
});
