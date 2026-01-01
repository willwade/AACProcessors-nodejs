import path from 'path';
import fs from 'fs';
import { ObfsetProcessor } from '../src/processors/obfsetProcessor';
import { AACTree } from '../src/core/treeStructure';

describe('ObfsetProcessor', () => {
  const obfsetPath = path.join(__dirname, 'fixtures/example.obfset');

  it('can load .obfset files into a tree', () => {
    const processor = new ObfsetProcessor();
    const tree = processor.loadIntoTree(obfsetPath);

    expect(tree).toBeInstanceOf(AACTree);
    expect(tree.rootId).toBe('root');
    expect(Object.keys(tree.pages).length).toBe(2);

    const rootPage = tree.getPage('root');
    if (!rootPage) {
      throw new Error('Expected root page to exist');
    }
    expect(rootPage.name).toBe('Home');
    expect(rootPage.grid[0][0]?.label).toBe('Hello');
    expect(rootPage.grid[0][0]?.semantic_id).toBe('greeting-1');
    expect(rootPage.buttons.length).toBe(2);

    const page2 = tree.getPage('page2');
    if (!page2) {
      throw new Error('Expected page2 to exist');
    }
    expect(page2.parentId).toBe('root');
    expect(page2.grid[0][0]?.label).toBe('World');
    expect(page2.grid[0][0]?.clone_id).toBe('world-1');
  });

  it('can load .obfset from a Buffer', () => {
    const processor = new ObfsetProcessor();
    const buffer = fs.readFileSync(obfsetPath);
    const tree = processor.loadIntoTree(buffer);

    expect(tree).toBeInstanceOf(AACTree);
    expect(tree.rootId).toBe('root');
  });

  it('can extract texts from .obfset', () => {
    const processor = new ObfsetProcessor();
    const texts = processor.extractTexts(obfsetPath);

    expect(texts).toContain('Hello');
    expect(texts).toContain('Go To Page 2');
    expect(texts).toContain('World');
    expect(texts).toContain('Home');
    expect(texts).toContain('Page 2');
  });

  it('throws error for unsupported operations', () => {
    const processor = new ObfsetProcessor();
    expect(() => processor.processTexts(obfsetPath, new Map(), 'out.obfset')).toThrow();
    expect(() => processor.saveFromTree(new AACTree(), 'out.obfset')).toThrow();
  });

  it('correctly reports supported extension', () => {
    const processor = new ObfsetProcessor();
    expect(processor.supportsExtension('.obfset')).toBe(true);
    expect(processor.supportsExtension('.obf')).toBe(false);
  });
});
