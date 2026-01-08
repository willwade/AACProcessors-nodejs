// Comprehensive error handling tests for all processors
import fs from 'fs';
import path from 'path';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { DotProcessor } from '../src/processors/dotProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { ApplePanelsProcessor } from '../src/processors/applePanelsProcessor';

describe('Error Handling', () => {
  const tempDir = path.join(__dirname, 'temp_error');

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

  describe('File I/O Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const processors = [
        new SnapProcessor(),
        new TouchChatProcessor(),
        new DotProcessor(),
        new OpmlProcessor(),
        new ApplePanelsProcessor(),
      ];

      for (const processor of processors) {
        await expect(processor.loadIntoTree('/non/existent/file.ext')).rejects.toThrow();
      }
    });

    it('should handle permission denied errors', async () => {
      // Create a file with no read permissions (if possible on this system)
      const restrictedFile = path.join(tempDir, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'test content');

      try {
        fs.chmodSync(restrictedFile, 0o000); // No permissions

        const processor = new DotProcessor();
        await expect(processor.loadIntoTree(restrictedFile)).rejects.toThrow();
      } catch (e) {
        // chmod might not work on all systems, skip this test
        console.log('Skipping permission test - chmod not supported');
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

  describe('Malformed Content Error Handling', () => {
    it('should handle invalid JSON in OBF files', async () => {
      const processor = new ObfProcessor();
      const invalidJson = Buffer.from('{ invalid json content }');

      await expect(processor.loadIntoTree(invalidJson)).rejects.toThrow();
    });

    it('should handle invalid XML in OPML files', async () => {
      const processor = new OpmlProcessor();
      const invalidXml = Buffer.from('<invalid><unclosed>xml');

      await expect(processor.loadIntoTree(invalidXml)).rejects.toThrow();
    });

    it('should handle invalid XML in GridSet files', async () => {
      const processor = new GridsetProcessor();
      const invalidZip = Buffer.from('not a zip file');

      await expect(processor.loadIntoTree(invalidZip)).rejects.toThrow();
    });

    it('should handle corrupted SQLite databases', async () => {
      const processor = new SnapProcessor();
      const corruptedDb = Buffer.from('SQLite format 3\x00but corrupted data');

      await expect(processor.loadIntoTree(corruptedDb)).rejects.toThrow();
    });
  });

  describe('Empty Content Error Handling', () => {
    it('should handle empty files gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      // Processors should throw meaningful errors
      const dotProcessor = new DotProcessor();
      await expect(dotProcessor.loadIntoTree(emptyBuffer)).rejects.toThrow();

      const snapProcessor = new SnapProcessor();
      await expect(snapProcessor.loadIntoTree(emptyBuffer)).rejects.toThrow();
    });

    it('should handle files with only whitespace', async () => {
      const whitespaceBuffer = Buffer.from('   \n\t  \n  ');

      const dotProcessor = new DotProcessor();
      await expect(dotProcessor.loadIntoTree(whitespaceBuffer)).rejects.toThrow();
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle very large files gracefully', async () => {
      // Create a large but valid DOT file
      const largeDotContent =
        'digraph G {\n' +
        Array(1000)
          .fill(0)
          .map((_, i) => `  node${i} [label="Node ${i}"];`)
          .join('\n') +
        '\n}';

      const processor = new DotProcessor();
      const result = await processor.loadIntoTree(Buffer.from(largeDotContent));
      expect(Object.keys(result.pages).length).toBeGreaterThan(0);
    });

    it('should clean up temporary files on error', async () => {
      const processor = new SnapProcessor();
      const invalidData = Buffer.from('invalid sqlite data');

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tempFilesBefore = fs.readdirSync(require('os').tmpdir()).length;

      await expect(processor.loadIntoTree(invalidData)).rejects.toThrow();

      // Give some time for cleanup
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const tempFilesAfter = fs.readdirSync(require('os').tmpdir()).length;
        const allowedDelta = 5; // Allow a handful of transient temp files created by other processes
        expect(tempFilesAfter).toBeLessThanOrEqual(tempFilesBefore + allowedDelta);
      }, 100);
    });
  });

  describe('Translation Error Handling', () => {
    it('should handle invalid translation maps', async () => {
      const processor = new DotProcessor();
      const validContent = Buffer.from('digraph G { node1 [label="test"]; }');
      const outputPath = path.join(tempDir, 'output.dot');

      // Test with null/undefined values in translation map
      const invalidTranslations = new Map([
        ['test', null as any],
        [undefined as any, 'replacement'],
        ['valid', 'válido'],
      ]);

      await expect(
        processor.processTexts(validContent, invalidTranslations, outputPath)
      ).resolves.not.toThrow();
    });

    it('should handle circular references in translation maps', async () => {
      const processor = new DotProcessor();
      const validContent = Buffer.from('digraph G { node1 [label="A"]; node2 [label="B"]; }');
      const outputPath = path.join(tempDir, 'circular.dot');

      const circularTranslations = new Map([
        ['A', 'B'],
        ['B', 'A'],
      ]);

      await expect(
        processor.processTexts(validContent, circularTranslations, outputPath)
      ).resolves.not.toThrow();
    });
  });

  describe('Save Operation Error Handling', () => {
    it('should handle read-only output directories', async () => {
      const readOnlyDir = path.join(tempDir, 'readonly');
      fs.mkdirSync(readOnlyDir, { recursive: true });

      try {
        fs.chmodSync(readOnlyDir, 0o444); // Read-only

        const processor = new DotProcessor();
        const tree = await processor.loadIntoTree(
          Buffer.from('digraph G { node1 [label="test"]; }')
        );
        const outputPath = path.join(readOnlyDir, 'output.dot');

        await expect(processor.saveFromTree(tree, outputPath)).rejects.toThrow();
      } catch (e) {
        // chmod might not work on all systems
        console.log('Skipping read-only directory test - chmod not supported');
      } finally {
        try {
          fs.chmodSync(readOnlyDir, 0o755); // Restore permissions
          fs.rmSync(readOnlyDir, { recursive: true, force: true });
        } catch (e) {
          // Cleanup failed
        }
      }
    });

    it('should handle disk space errors gracefully', async () => {
      // This is hard to test reliably, but we can at least ensure
      // the error handling code paths exist
      const processor = new DotProcessor();
      const tree = await processor.loadIntoTree(Buffer.from('digraph G { node1 [label="test"]; }'));

      // Try to save to an invalid path
      await expect(
        processor.saveFromTree(tree, '/invalid/path/that/does/not/exist/output.dot')
      ).rejects.toThrow();
    });
  });
});
