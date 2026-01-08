import { getProcessor, analyze } from '../../src/core/analyze';
import {
  DotProcessor,
  OpmlProcessor,
  ObfProcessor,
  SnapProcessor,
  GridsetProcessor,
  AstericsGridProcessor,
  TouchChatProcessor,
  ApplePanelsProcessor,
} from '../../src/index';
import { TreeFactory } from '../utils/testFactories';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('analyze', () => {
  describe('getProcessor', () => {
    it('should return a DotProcessor for "dot"', async () => {
      expect(getProcessor('dot')).toBeInstanceOf(DotProcessor);
    });

    it('should return a OpmlProcessor for "opml"', async () => {
      expect(getProcessor('opml')).toBeInstanceOf(OpmlProcessor);
    });

    it('should return a ObfProcessor for "obf"', async () => {
      expect(getProcessor('obf')).toBeInstanceOf(ObfProcessor);
    });

    it('should return a SnapProcessor for "snap"', async () => {
      expect(getProcessor('snap')).toBeInstanceOf(SnapProcessor);
    });

    it('should return a SnapProcessor for "sps" extension', async () => {
      expect(getProcessor('sps')).toBeInstanceOf(SnapProcessor);
    });

    it('should return a SnapProcessor for "spb" extension', async () => {
      expect(getProcessor('spb')).toBeInstanceOf(SnapProcessor);
    });

    it('should return a GridsetProcessor for "gridset"', async () => {
      expect(getProcessor('gridset')).toBeInstanceOf(GridsetProcessor);
    });

    it('should return a GridsetProcessor for "gridsetx"', async () => {
      expect(getProcessor('gridsetx')).toBeInstanceOf(GridsetProcessor);
    });

    it('should return an AstericsGridProcessor for "grd" extension', async () => {
      expect(getProcessor('grd')).toBeInstanceOf(AstericsGridProcessor);
    });

    it('should return a TouchChatProcessor for "touchchat"', async () => {
      expect(getProcessor('touchchat')).toBeInstanceOf(TouchChatProcessor);
    });

    it('should return a TouchChatProcessor for "ce" extension', async () => {
      expect(getProcessor('ce')).toBeInstanceOf(TouchChatProcessor);
    });

    it('should return a ApplePanelsProcessor for "applepanels"', async () => {
      expect(getProcessor('applepanels')).toBeInstanceOf(ApplePanelsProcessor);
    });

    it('should return a ApplePanelsProcessor for "panels"', async () => {
      expect(getProcessor('panels')).toBeInstanceOf(ApplePanelsProcessor);
    });

    it('should be case-insensitive', async () => {
      expect(getProcessor('DOT')).toBeInstanceOf(DotProcessor);
      expect(getProcessor('OPML')).toBeInstanceOf(OpmlProcessor);
      expect(getProcessor('SNAP')).toBeInstanceOf(SnapProcessor);
    });

    it('should handle empty string format', async () => {
      expect(() => getProcessor('')).toThrow('Unknown format: ');
    });

    it('should handle null/undefined format', async () => {
      expect(() => getProcessor(null as any)).toThrow('Unknown format: ');
      expect(() => getProcessor(undefined as any)).toThrow('Unknown format: ');
    });

    it('should throw an error for an unknown format', async () => {
      expect(() => getProcessor('unknown')).toThrow('Unknown format: unknown');
      expect(() => getProcessor('xyz')).toThrow('Unknown format: xyz');
    });
  });

  describe('analyze', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-test-'));
    });

    afterEach(async () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should analyze a DOT file and return a tree', async () => {
      const tempFile = path.join(tempDir, 'test.dot');
      fs.writeFileSync(tempFile, 'digraph G { "Home" -> "Food"; }');

      const { tree } = analyze(tempFile, 'dot');
      expect(tree).toBeDefined();
      expect(tree.pages).toBeDefined();
    });

    it('should analyze an OPML file and return a tree', async () => {
      // Create a test OPML file using TreeFactory
      const tree = TreeFactory.createSimple();
      const processor = new OpmlProcessor();
      const tempFile = path.join(tempDir, 'test.opml');
      await processor.saveFromTree(tree, tempFile);

      const { tree: analyzedTree } = analyze(tempFile, 'opml');
      expect(analyzedTree).toBeDefined();
      expect(analyzedTree.pages).toBeDefined();
      // OPML processor may create additional pages for circular references
      expect(Object.keys(analyzedTree.pages).length).toBeGreaterThanOrEqual(2);
    });

    it('should handle file reading errors', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.opml');

      expect(() => analyze(nonExistentFile, 'opml')).toThrow();
    });

    it('should handle invalid format in analyze', async () => {
      // Create a dummy file
      const tempFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(tempFile, 'dummy content');

      expect(() => analyze(tempFile, 'invalid')).toThrow('Unknown format: invalid');
    });

    it('should work with different file formats', async () => {
      const tree = TreeFactory.createSimple();

      // Test DOT format
      const dotProcessor = new DotProcessor();
      const dotFile = path.join(tempDir, 'test.dot');
      await dotProcessor.saveFromTree(tree, dotFile);

      const dotResult = analyze(dotFile, 'dot');
      expect(dotResult).toHaveProperty('tree');
      expect(dotResult.tree).toBeDefined();

      // Test OPML format
      const opmlProcessor = new OpmlProcessor();
      const opmlFile = path.join(tempDir, 'test.opml');
      await opmlProcessor.saveFromTree(tree, opmlFile);

      const opmlResult = analyze(opmlFile, 'opml');
      expect(opmlResult).toHaveProperty('tree');
      expect(opmlResult.tree).toBeDefined();
    });

    it('should return tree with correct structure', async () => {
      const tree = TreeFactory.createCommunicationBoard();
      const processor = new OpmlProcessor();
      const tempFile = path.join(tempDir, 'communication.opml');
      await processor.saveFromTree(tree, tempFile);

      const { tree: analyzedTree } = analyze(tempFile, 'opml');
      expect(analyzedTree).toBeDefined();
      expect(analyzedTree.pages).toBeDefined();
      expect(Object.keys(analyzedTree.pages).length).toBeGreaterThan(0);
    });
  });
});
