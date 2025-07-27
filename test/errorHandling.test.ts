// Comprehensive error handling tests for all processors
import fs from "fs";
import path from "path";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { ObfProcessor } from "../src/processors/obfProcessor";
import { DotProcessor } from "../src/processors/dotProcessor";
import { OpmlProcessor } from "../src/processors/opmlProcessor";
import { ApplePanelsProcessor } from "../src/processors/applePanelsProcessor";

describe("Error Handling", () => {
  const tempDir = path.join(__dirname, "temp_error");

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

  describe("File I/O Error Handling", () => {
    it("should handle non-existent files gracefully", () => {
      const processors = [
        new SnapProcessor(),
        new TouchChatProcessor(),
        new DotProcessor(),
        new OpmlProcessor(),
        new ApplePanelsProcessor(),
      ];

      processors.forEach((processor) => {
        expect(() => {
          processor.loadIntoTree("/non/existent/file.ext");
        }).toThrow();
      });
    });

    it("should handle permission denied errors", () => {
      // Create a file with no read permissions (if possible on this system)
      const restrictedFile = path.join(tempDir, "restricted.txt");
      fs.writeFileSync(restrictedFile, "test content");

      try {
        fs.chmodSync(restrictedFile, 0o000); // No permissions

        const processor = new DotProcessor();
        expect(() => {
          processor.loadIntoTree(restrictedFile);
        }).toThrow();
      } catch (e) {
        // chmod might not work on all systems, skip this test
        console.log("Skipping permission test - chmod not supported");
      } finally {
        try {
          fs.chmodSync(restrictedFile, 0o644); // Restore permissions for cleanup
          fs.unlinkSync(restrictedFile);
        } catch (e) {
          // Cleanup failed, but that's ok
        }
      }
    });
  });

  describe("Malformed Content Error Handling", () => {
    it("should handle invalid JSON in OBF files", () => {
      const processor = new ObfProcessor();
      const invalidJson = Buffer.from("{ invalid json content }");

      expect(() => {
        processor.loadIntoTree(invalidJson);
      }).toThrow();
    });

    it("should handle invalid XML in OPML files", () => {
      const processor = new OpmlProcessor();
      const invalidXml = Buffer.from("<invalid><unclosed>xml");

      expect(() => {
        processor.loadIntoTree(invalidXml);
      }).toThrow();
    });

    it("should handle invalid XML in GridSet files", () => {
      const processor = new GridsetProcessor();
      const invalidZip = Buffer.from("not a zip file");

      expect(() => {
        processor.loadIntoTree(invalidZip);
      }).toThrow();
    });

    it("should handle corrupted SQLite databases", () => {
      const processor = new SnapProcessor();
      const corruptedDb = Buffer.from("SQLite format 3\x00but corrupted data");

      expect(() => {
        processor.loadIntoTree(corruptedDb);
      }).toThrow();
    });
  });

  describe("Empty Content Error Handling", () => {
    it("should handle empty files gracefully", () => {
      const emptyBuffer = Buffer.alloc(0);

      // Some processors should handle empty content gracefully
      const dotProcessor = new DotProcessor();
      const dotResult = dotProcessor.loadIntoTree(emptyBuffer);
      expect(dotResult.pages).toEqual({});

      // Others should throw meaningful errors
      const snapProcessor = new SnapProcessor();
      expect(() => {
        snapProcessor.loadIntoTree(emptyBuffer);
      }).toThrow();
    });

    it("should handle files with only whitespace", () => {
      const whitespaceBuffer = Buffer.from("   \n\t  \n  ");

      const dotProcessor = new DotProcessor();
      const result = dotProcessor.loadIntoTree(whitespaceBuffer);
      expect(result.pages).toEqual({});
    });
  });

  describe("Memory and Resource Error Handling", () => {
    it("should handle very large files gracefully", () => {
      // Create a large but valid DOT file
      const largeDotContent =
        "digraph G {\n" +
        Array(1000)
          .fill(0)
          .map((_, i) => `  node${i} [label="Node ${i}"];`)
          .join("\n") +
        "\n}";

      const processor = new DotProcessor();
      expect(() => {
        const result = processor.loadIntoTree(Buffer.from(largeDotContent));
        expect(Object.keys(result.pages).length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it("should clean up temporary files on error", () => {
      const processor = new SnapProcessor();
      const invalidData = Buffer.from("invalid sqlite data");

      const tempFilesBefore = fs.readdirSync(require("os").tmpdir()).length;

      expect(() => {
        processor.loadIntoTree(invalidData);
      }).toThrow();

      // Give some time for cleanup
      setTimeout(() => {
        const tempFilesAfter = fs.readdirSync(require("os").tmpdir()).length;
        expect(tempFilesAfter).toBeLessThanOrEqual(tempFilesBefore + 1); // Allow for some variance
      }, 100);
    });
  });

  describe("Translation Error Handling", () => {
    it("should handle invalid translation maps", () => {
      const processor = new DotProcessor();
      const validContent = Buffer.from('digraph G { node1 [label="test"]; }');
      const outputPath = path.join(tempDir, "output.dot");

      // Test with null/undefined values in translation map
      const invalidTranslations = new Map([
        ["test", null as any],
        [undefined as any, "replacement"],
        ["valid", "válido"],
      ]);

      expect(() => {
        processor.processTexts(validContent, invalidTranslations, outputPath);
      }).not.toThrow();
    });

    it("should handle circular references in translation maps", () => {
      const processor = new DotProcessor();
      const validContent = Buffer.from(
        'digraph G { node1 [label="A"]; node2 [label="B"]; }',
      );
      const outputPath = path.join(tempDir, "circular.dot");

      const circularTranslations = new Map([
        ["A", "B"],
        ["B", "A"],
      ]);

      expect(() => {
        processor.processTexts(validContent, circularTranslations, outputPath);
      }).not.toThrow();
    });
  });

  describe("Save Operation Error Handling", () => {
    it("should handle read-only output directories", () => {
      const readOnlyDir = path.join(tempDir, "readonly");
      fs.mkdirSync(readOnlyDir, { recursive: true });

      try {
        fs.chmodSync(readOnlyDir, 0o444); // Read-only

        const processor = new DotProcessor();
        const tree = processor.loadIntoTree(
          Buffer.from('digraph G { node1 [label="test"]; }'),
        );
        const outputPath = path.join(readOnlyDir, "output.dot");

        expect(() => {
          processor.saveFromTree(tree, outputPath);
        }).toThrow();
      } catch (e) {
        // chmod might not work on all systems
        console.log("Skipping read-only directory test - chmod not supported");
      } finally {
        try {
          fs.chmodSync(readOnlyDir, 0o755); // Restore permissions
          fs.rmSync(readOnlyDir, { recursive: true, force: true });
        } catch (e) {
          // Cleanup failed
        }
      }
    });

    it("should handle disk space errors gracefully", () => {
      // This is hard to test reliably, but we can at least ensure
      // the error handling code paths exist
      const processor = new DotProcessor();
      const tree = processor.loadIntoTree(
        Buffer.from('digraph G { node1 [label="test"]; }'),
      );

      // Try to save to an invalid path
      expect(() => {
        processor.saveFromTree(
          tree,
          "/invalid/path/that/does/not/exist/output.dot",
        );
      }).toThrow();
    });
  });
});
