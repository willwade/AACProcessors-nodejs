import { getProcessor, analyze } from '../../src/core/analyze';
import { DotProcessor } from '../../src/processors/dotProcessor';
import { OpmlProcessor } from '../../src/processors/opmlProcessor';
import { ObfProcessor } from '../../src/processors/obfProcessor';
import { SnapProcessor } from '../../src/processors/snapProcessor';
import { GridsetProcessor } from '../../src/processors/gridsetProcessor';
import { TouchChatProcessor } from '../../src/processors/touchchatProcessor';
import { ApplePanelsProcessor } from '../../src/processors/applePanelsProcessor';
import path from 'path';
import fs from 'fs';

describe('analyze', () => {
  describe('getProcessor', () => {
    it('should return a DotProcessor for "dot"', () => {
      expect(getProcessor('dot')).toBeInstanceOf(DotProcessor);
    });

    it('should return a OpmlProcessor for "opml"', () => {
      expect(getProcessor('opml')).toBeInstanceOf(OpmlProcessor);
    });

    it('should return a ObfProcessor for "obf"', () => {
      expect(getProcessor('obf')).toBeInstanceOf(ObfProcessor);
    });

    it('should return a SnapProcessor for "snap"', () => {
      expect(getProcessor('snap')).toBeInstanceOf(SnapProcessor);
    });

    it('should return a GridsetProcessor for "gridset"', () => {
      expect(getProcessor('gridset')).toBeInstanceOf(GridsetProcessor);
    });

    it('should return a TouchChatProcessor for "touchchat"', () => {
      expect(getProcessor('touchchat')).toBeInstanceOf(TouchChatProcessor);
    });

    it('should return a ApplePanelsProcessor for "applepanels"', () => {
      expect(getProcessor('applepanels')).toBeInstanceOf(ApplePanelsProcessor);
    });

    it('should be case-insensitive', () => {
      expect(getProcessor('DOT')).toBeInstanceOf(DotProcessor);
    });

    it('should throw an error for an unknown format', () => {
      expect(() => getProcessor('unknown')).toThrow('Unknown format: unknown');
    });
  });

  describe('analyze', () => {
    const tempDir = path.join(__dirname, 'temp_analyze');
    const tempFile = path.join(tempDir, 'test.dot');

    beforeAll(() => {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      fs.writeFileSync(tempFile, 'digraph G {}');
    });

    afterAll(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should analyze a file and return a tree', async () => {
      const { tree } = await analyze(tempFile, 'dot');
      expect(tree).toBeDefined();
    });
  });
});
