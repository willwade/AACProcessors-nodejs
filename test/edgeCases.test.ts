// Edge case tests for all processors
import fs from 'fs';
import path from 'path';
import { DotProcessor } from '../src/processors/dotProcessor';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { SnapProcessor } from '../src/processors/snapProcessor';
import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { ApplePanelsProcessor } from '../src/processors/applePanelsProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

describe('Edge Case Tests', () => {
  const tempDir = path.join(__dirname, 'temp_edge_cases');

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

  describe('Empty and Minimal Content', () => {
    it('should handle completely empty files', () => {
      const processors = [
        { name: 'DOT', processor: new DotProcessor(), testBuffer: true },
        { name: 'OPML', processor: new OpmlProcessor(), testBuffer: true },
        { name: 'OBF', processor: new ObfProcessor(), testBuffer: true },
      ];

      processors.forEach(({ name, processor, testBuffer }) => {
        if (testBuffer) {
          const emptyBuffer = Buffer.alloc(0);

          if (name === 'DOT') {
            // DOT processor should handle empty content gracefully
            const tree = processor.loadIntoTree(emptyBuffer);
            expect(tree).toBeInstanceOf(AACTree);
            expect(Object.keys(tree.pages)).toHaveLength(0);
          } else {
            // Other processors should throw meaningful errors
            expect(() => {
              processor.loadIntoTree(emptyBuffer);
            }).toThrow();
          }
        }
      });
    });

    it('should handle minimal valid content', () => {
      const testCases = [
        {
          name: 'DOT',
          processor: new DotProcessor(),
          content: 'digraph G { }',
        },
        {
          name: 'OPML',
          processor: new OpmlProcessor(),
          content: '<?xml version="1.0"?><opml version="2.0"><body></body></opml>',
        },
        {
          name: 'OBF',
          processor: new ObfProcessor(),
          content: '{"id": "test", "buttons": []}',
        },
      ];

      testCases.forEach(({ name, processor, content }) => {
        const tree = processor.loadIntoTree(Buffer.from(content));
        expect(tree).toBeInstanceOf(AACTree);
        console.log(`${name} minimal content: ${Object.keys(tree.pages).length} pages`);
      });
    });

    it('should handle single-element content', () => {
      const dotProcessor = new DotProcessor();
      const singleNodeContent = 'digraph G { single [label="Only Node"]; }';

      const tree = dotProcessor.loadIntoTree(Buffer.from(singleNodeContent));
      expect(Object.keys(tree.pages)).toHaveLength(1);

      const page = Object.values(tree.pages)[0];
      expect(page.buttons).toHaveLength(1);
      expect(page.buttons[0].label).toBe('Only Node');
    });
  });

  describe('Unusual Characters and Encoding', () => {
    it('should handle Unicode characters correctly', () => {
      const unicodeTestCases = [
        {
          name: 'Emoji',
          content: 'digraph G { emoji [label="😀🎉🌟"]; }',
          expectedLabel: '😀🎉🌟',
        },
        {
          name: 'Chinese',
          content: 'digraph G { chinese [label="你好世界"]; }',
          expectedLabel: '你好世界',
        },
        {
          name: 'Arabic',
          content: 'digraph G { arabic [label="مرحبا بالعالم"]; }',
          expectedLabel: 'مرحبا بالعالم',
        },
        {
          name: 'Accented',
          content: 'digraph G { accented [label="Café, naïve, résumé"]; }',
          expectedLabel: 'Café, naïve, résumé',
        },
        {
          name: 'Mathematical',
          content: 'digraph G { math [label="∑∞≠≤≥±"]; }',
          expectedLabel: '∑∞≠≤≥±',
        },
      ];

      const processor = new DotProcessor();

      unicodeTestCases.forEach(({ name, content, expectedLabel }) => {
        const tree = processor.loadIntoTree(Buffer.from(content, 'utf8'));
        const page = Object.values(tree.pages)[0];

        expect(page.buttons).toHaveLength(1);
        expect(page.buttons[0].label).toBe(expectedLabel);
        console.log(`${name} Unicode test passed: "${expectedLabel}"`);
      });
    });

    it('should handle special characters in file paths and content', () => {
      const processor = new DotProcessor();
      const specialContent = `
        digraph G {
          "node with spaces" [label="Label with spaces"];
          "node-with-dashes" [label="Label-with-dashes"];
          "node_with_underscores" [label="Label_with_underscores"];
          "node.with.dots" [label="Label.with.dots"];
          "node@with@symbols" [label="Label@with@symbols"];
          "node#with#hash" [label="Label#with#hash"];
        }
      `;

      const tree = processor.loadIntoTree(Buffer.from(specialContent));
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);

      const allButtons = Object.values(tree.pages).flatMap((page) => page.buttons);
      expect(allButtons.length).toBe(6);

      const labels = allButtons.map((btn) => btn.label);
      expect(labels).toContain('Label with spaces');
      expect(labels).toContain('Label-with-dashes');
      expect(labels).toContain('Label@with@symbols');
    });

    it('should handle escaped characters correctly', () => {
      const processor = new DotProcessor();
      const escapedContent = `
        digraph G {
          escaped [label="Line 1\\nLine 2\\tTabbed"];
          quotes [label="She said \\"Hello\\""];
          backslash [label="Path\\\\to\\\\file"];
        }
      `;

      const tree = processor.loadIntoTree(Buffer.from(escapedContent));
      const allButtons = Object.values(tree.pages).flatMap((page) => page.buttons);

      expect(allButtons.length).toBe(3);

      const escapedButton = allButtons.find((btn) => btn.label.includes('Line 1'));
      expect(escapedButton).toBeDefined();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum reasonable content sizes', () => {
      const processor = new DotProcessor();

      // Test very long labels
      const longLabel = 'A'.repeat(1000);
      const longLabelContent = `digraph G { long [label="${longLabel}"]; }`;

      const tree = processor.loadIntoTree(Buffer.from(longLabelContent));
      const page = Object.values(tree.pages)[0];
      expect(page.buttons[0].label).toBe(longLabel);

      // Test many nodes
      const manyNodesLines = ['digraph G {'];
      for (let i = 0; i < 100; i++) {
        manyNodesLines.push(`  node${i} [label="Node ${i}"];`);
      }
      manyNodesLines.push('}');

      const manyNodesContent = manyNodesLines.join('\n');
      const manyNodesTree = processor.loadIntoTree(Buffer.from(manyNodesContent));

      const totalButtons = Object.values(manyNodesTree.pages).reduce(
        (sum, page) => sum + page.buttons.length,
        0
      );
      expect(totalButtons).toBe(100);
    });

    it('should handle deeply nested structures', () => {
      const processor = new OpmlProcessor();

      // Create deeply nested OPML
      let nestedContent = '<?xml version="1.0"?><opml version="2.0"><body>';
      let currentLevel = '';

      for (let i = 0; i < 10; i++) {
        currentLevel += '<outline text="Level ' + i + '">';
      }

      nestedContent += currentLevel;

      for (let i = 9; i >= 0; i--) {
        nestedContent += '</outline>';
      }

      nestedContent += '</body></opml>';

      const tree = processor.loadIntoTree(Buffer.from(nestedContent));
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should handle circular references gracefully', () => {
      const processor = new DotProcessor();
      const circularContent = `
        digraph G {
          a -> b;
          b -> c;
          c -> a;
          a [label="Node A"];
          b [label="Node B"];
          c [label="Node C"];
        }
      `;

      const tree = processor.loadIntoTree(Buffer.from(circularContent));

      // Test that traverse doesn't get stuck in infinite loop
      const visitedPages: string[] = [];
      tree.traverse((page) => {
        visitedPages.push(page.id);
      });

      // Should visit each page only once despite circular references
      const uniquePages = new Set(visitedPages);
      expect(uniquePages.size).toBe(visitedPages.length);
    });
  });

  describe('Corrupted and Malformed Content', () => {
    it('should handle partially corrupted JSON', () => {
      const processor = new ObfProcessor();

      const corruptedJsonCases = [
        '{"id": "test", "buttons": [', // Incomplete JSON
        '{"id": "test", "buttons": [}', // Invalid syntax
        '{"id": "test", "buttons": null}', // Null buttons
        '{"id": 123, "buttons": "not-array"}', // Wrong types
        '{"buttons": [{"id": "btn1"}]}', // Missing required fields
      ];

      corruptedJsonCases.forEach((corruptedJson, index) => {
        expect(() => {
          processor.loadIntoTree(Buffer.from(corruptedJson));
        }).toThrow();
        console.log(`Corrupted JSON case ${index + 1} handled correctly`);
      });
    });

    it('should handle malformed XML', () => {
      const processor = new OpmlProcessor();

      const malformedXmlCases = [
        '<opml><body><outline text="unclosed">', // Unclosed tags
        '<opml><body><outline text="invalid&char"></outline></body></opml>', // Invalid characters
        '<?xml version="1.0"?><opml><body><outline></body></opml>', // Wrong nesting
        '<opml version="invalid"><body></body></opml>', // Invalid attributes
      ];

      malformedXmlCases.forEach((malformedXml, index) => {
        expect(() => {
          processor.loadIntoTree(Buffer.from(malformedXml));
        }).toThrow();
        console.log(`Malformed XML case ${index + 1} handled correctly`);
      });
    });

    it('should handle binary data as text input', () => {
      const processor = new DotProcessor();

      // Create some binary data
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);

      // Should handle gracefully (likely produce empty tree)
      const tree = processor.loadIntoTree(binaryData);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });
  });

  describe('Resource Limits and Cleanup', () => {
    it('should clean up temporary files on errors', () => {
      const processor = new SnapProcessor();

      const tempFilesBefore = fs.readdirSync(require('os').tmpdir()).length;

      // Try to process invalid SQLite data multiple times
      for (let i = 0; i < 5; i++) {
        const invalidData = Buffer.from(`invalid sqlite data ${i}`);

        expect(() => {
          processor.loadIntoTree(invalidData);
        }).toThrow();
      }

      // Give some time for cleanup
      setTimeout(() => {
        const tempFilesAfter = fs.readdirSync(require('os').tmpdir()).length;
        expect(tempFilesAfter).toBeLessThanOrEqual(tempFilesBefore + 2); // Allow some variance
      }, 100);
    });

    it('should handle concurrent access to same file', async () => {
      const processor = new DotProcessor();
      const testContent = 'digraph G { test [label="Concurrent Test"]; }';
      const testFile = path.join(tempDir, 'concurrent_test.dot');

      fs.writeFileSync(testFile, testContent);

      // Try to access the same file concurrently
      const promises = Array(5)
        .fill(0)
        .map(async () => {
          return processor.loadIntoTree(testFile);
        });

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((tree) => {
        expect(tree).toBeInstanceOf(AACTree);
        expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
      });
    });

    it('should handle very long file paths', () => {
      const processor = new DotProcessor();

      // Create a very long but valid path
      const longDir = path.join(tempDir, 'a'.repeat(100), 'b'.repeat(100));
      fs.mkdirSync(longDir, { recursive: true });

      const longFilePath = path.join(longDir, 'test.dot');
      const testContent = 'digraph G { test [label="Long Path Test"]; }';

      fs.writeFileSync(longFilePath, testContent);

      const tree = processor.loadIntoTree(longFilePath);
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });
  });

  describe('Translation Edge Cases', () => {
    it('should handle empty translation maps', () => {
      const processor = new DotProcessor();
      const content = 'digraph G { test [label="Test"]; }';
      const outputPath = path.join(tempDir, 'empty_translation.dot');

      const emptyTranslations = new Map<string, string>();

      expect(() => {
        processor.processTexts(Buffer.from(content), emptyTranslations, outputPath);
      }).not.toThrow();

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should handle translations with special regex characters', () => {
      const processor = new DotProcessor();
      const content = 'digraph G { test [label="$pecial [chars] (here)"]; }';
      const outputPath = path.join(tempDir, 'special_chars_translation.dot');

      const translations = new Map([['$pecial [chars] (here)', 'Caracteres especiales aquí']]);

      const result = processor.processTexts(Buffer.from(content), translations, outputPath);
      const translatedContent = result.toString('utf8');

      expect(translatedContent).toContain('Caracteres especiales aquí');
    });

    it('should handle very large translation maps', () => {
      const processor = new DotProcessor();

      // Create content with many translatable items
      const lines = ['digraph G {'];
      for (let i = 0; i < 100; i++) {
        lines.push(`  node${i} [label="Text ${i}"];`);
      }
      lines.push('}');
      const content = lines.join('\n');

      // Create large translation map
      const translations = new Map<string, string>();
      for (let i = 0; i < 100; i++) {
        translations.set(`Text ${i}`, `Texto ${i}`);
      }

      const outputPath = path.join(tempDir, 'large_translation.dot');
      const result = processor.processTexts(Buffer.from(content), translations, outputPath);

      expect(result).toBeInstanceOf(Buffer);
      expect(fs.existsSync(outputPath)).toBe(true);

      const translatedContent = result.toString('utf8');
      expect(translatedContent).toContain('Texto 0');
      expect(translatedContent).toContain('Texto 99');
    });
  });
});
