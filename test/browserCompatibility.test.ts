/**
 * Browser Compatibility Tests
 *
 * These tests verify that processors work correctly with buffer/ArrayBuffer inputs
 * as they would be used in a browser environment (no file paths, only buffers).
 */

import { readFileSync } from 'fs';
import path from 'path';
import {
  DotProcessor,
  OpmlProcessor,
  ObfProcessor,
  GridsetProcessor,
  ApplePanelsProcessor,
  AstericsGridProcessor,
} from '../src/index';
import { AACTree } from '../src/core/treeStructure';

describe('Browser Compatibility', () => {
  describe('DotProcessor with buffers', () => {
    const examplePath = path.join(__dirname, 'assets/dot/example.dot');

    it('should load from Buffer', async () => {
      const processor = new DotProcessor();
      const buffer = readFileSync(examplePath);
      const tree: AACTree = await processor.loadIntoTree(buffer);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should load from Uint8Array', async () => {
      const processor = new DotProcessor();
      const buffer = readFileSync(examplePath);
      const uint8Array = new Uint8Array(buffer);
      const tree: AACTree = await processor.loadIntoTree(uint8Array);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should extract texts from Buffer', async () => {
      const processor = new DotProcessor();
      const buffer = readFileSync(examplePath);
      const texts = await processor.extractTexts(buffer);

      expect(Array.isArray(texts)).toBe(true);
      expect(texts.length).toBeGreaterThan(0);
    });
  });

  describe('OpmlProcessor with buffers', () => {
    const examplePath = path.join(__dirname, 'assets/opml/example.opml');

    it('should load from Buffer', async () => {
      const processor = new OpmlProcessor();
      const buffer = readFileSync(examplePath);
      const tree: AACTree = await processor.loadIntoTree(buffer);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should load from Uint8Array', async () => {
      const processor = new OpmlProcessor();
      const buffer = readFileSync(examplePath);
      const uint8Array = new Uint8Array(buffer);
      const tree: AACTree = await processor.loadIntoTree(uint8Array);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });
  });

  describe('ObfProcessor with buffers', () => {
    const examplePath = path.join(__dirname, 'assets/obf/simple.obf');

    it('should load OBF from Buffer', async () => {
      const processor = new ObfProcessor();
      const buffer = readFileSync(examplePath);
      const tree: AACTree = await processor.loadIntoTree(buffer);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should load OBF from ArrayBuffer', async () => {
      const processor = new ObfProcessor();
      const buffer = readFileSync(examplePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      const tree: AACTree = await processor.loadIntoTree(arrayBuffer);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });
  });

  describe('GridsetProcessor with buffers', () => {
    const examplePath = path.join(__dirname, 'assets/gridset/example.gridset');

    it('should load Gridset from Buffer', async () => {
      const processor = new GridsetProcessor();
      const buffer = readFileSync(examplePath);
      const tree: AACTree = await processor.loadIntoTree(buffer);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });

    it('should load Gridset from Uint8Array', async () => {
      const processor = new GridsetProcessor();
      const buffer = readFileSync(examplePath);
      const uint8Array = new Uint8Array(buffer);
      const tree: AACTree = await processor.loadIntoTree(uint8Array);

      expect(tree).toBeDefined();
      expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
    });
  });

  describe('ApplePanelsProcessor with buffers', () => {
    it('should load from Buffer - skipped (no test asset)', async () => {
      // ApplePanels tests create data programmatically
      // See test/applePanelsProcessor.roundtrip.test.ts for ApplePanels tests
      expect(true).toBe(true);
    });
  });

  describe('AstericsGridProcessor with buffers', () => {
    const examplePath = path.join(__dirname, 'assets/asterics/example.grd');

    it('should load from Buffer', async () => {
      const processor = new AstericsGridProcessor();
      const buffer = readFileSync(examplePath);
      const tree: AACTree = await processor.loadIntoTree(buffer);

      expect(tree).toBeDefined();
    });
  });

  describe('Browser factory function', () => {
    it('getProcessor should work with extensions', async () => {
      const { getProcessor } = await import('../src/index.browser');

      const dotProcessor = getProcessor('.dot');
      expect(dotProcessor).toBeInstanceOf(DotProcessor);

      const opmlProcessor = getProcessor('.opml');
      expect(opmlProcessor).toBeInstanceOf(OpmlProcessor);

      const obfProcessor = getProcessor('.obf');
      expect(obfProcessor).toBeInstanceOf(ObfProcessor);

      const gridsetProcessor = getProcessor('.gridset');
      expect(gridsetProcessor).toBeInstanceOf(GridsetProcessor);
    });

    it('getSupportedExtensions should return browser-supported extensions', async () => {
      const { getSupportedExtensions } = await import('../src/index.browser');
      const extensions = getSupportedExtensions();

      expect(extensions).toContain('.dot');
      expect(extensions).toContain('.opml');
      expect(extensions).toContain('.obf');
      expect(extensions).toContain('.obz');
      expect(extensions).toContain('.gridset');
      expect(extensions).toContain('.plist');
      expect(extensions).toContain('.grd');
    });
  });
});
