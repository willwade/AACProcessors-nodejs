// Round-trip test for OBFProcessor: load, save, reload, and compare structure
import fs from 'fs';
import path from 'path';
import { ObfProcessor } from '../src/processors/obfProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

describe('OBFProcessor round-trip', () => {
  const obfPath: string = path.join(__dirname, 'assets/obf/example.obf');
  const obzPath: string = path.join(__dirname, 'assets/obz/example.obz');
  const outObfPath: string = path.join(__dirname, 'out.obf');
  const outObzPath: string = path.join(__dirname, 'out.obz');

  afterAll(() => {
    [outObfPath, outObzPath].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  it('round-trips OBF JSON without losing pages or navigation', () => {
    if (!fs.existsSync(obfPath)) {
      console.log('Skipping OBF test - example file not found');
      return;
    }

    const processor = new ObfProcessor();
    const tree1: AACTree = processor.loadIntoTree(obfPath);
    processor.saveFromTree(tree1, outObfPath);

    expect(fs.existsSync(outObfPath)).toBe(true);

    const tree2: AACTree = processor.loadIntoTree(outObfPath);

    // Compare basic structure
    expect(Object.keys(tree1.pages).length).toBe(Object.keys(tree2.pages).length);

    // Compare page content
    for (const pageId in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pageId);
      const page1 = tree1.pages[pageId];
      const page2 = tree2.pages[pageId];

      expect(page2.name).toBe(page1.name);
      expect(page2.buttons.length).toBe(page1.buttons.length);

      // Compare button labels
      const labels1 = page1.buttons.map((b) => b.label).sort();
      const labels2 = page2.buttons.map((b) => b.label).sort();
      expect(labels2).toEqual(labels1);
    }
  });

  it('round-trips OBZ (zip) format without losing data', () => {
    if (!fs.existsSync(obzPath)) {
      console.log('Skipping OBZ test - example file not found');
      return;
    }

    const processor = new ObfProcessor();
    const tree1: AACTree = processor.loadIntoTree(obzPath);
    processor.saveFromTree(tree1, outObzPath);

    expect(fs.existsSync(outObzPath)).toBe(true);

    const tree2: AACTree = processor.loadIntoTree(outObzPath);

    // Compare structure
    expect(Object.keys(tree2.pages).length).toBeGreaterThan(0);
    expect(Object.keys(tree1.pages).length).toBe(Object.keys(tree2.pages).length);
  });

  it('can save and load a simple constructed tree', () => {
    const processor = new ObfProcessor();

    // Create a simple tree programmatically
    const tree1 = new AACTree();
    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      buttons: [],
    });

    const button = new AACButton({
      id: 'test-button',
      label: 'Test Button',
      message: 'Hello World',
      type: 'SPEAK',
    });

    page.addButton(button);
    tree1.addPage(page);

    // Save and reload
    processor.saveFromTree(tree1, outObfPath);
    const tree2: AACTree = processor.loadIntoTree(outObfPath);

    // Verify structure
    expect(Object.keys(tree2.pages)).toHaveLength(1);
    const reloadedPage = tree2.pages['test-page'];
    expect(reloadedPage).toBeDefined();
    expect(reloadedPage.name).toBe('Test Page');
    expect(reloadedPage.buttons).toHaveLength(1);
    expect(reloadedPage.buttons[0].label).toBe('Test Button');
  });

  it('includes required OBF metadata fields when saving a tree', () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'meta-page',
      name: 'Meta Page',
      grid: [
        [null, null],
        [null, null],
      ],
      locale: 'en',
    });

    const AACButtonCtor = AACButton;
    const buttonA = new AACButtonCtor({
      id: 'btn-a',
      label: 'A',
      message: 'A',
    });
    const buttonB = new AACButtonCtor({
      id: 'btn-b',
      label: 'B',
      message: 'B',
    });

    page.addButton(buttonA);
    page.addButton(buttonB);
    page.grid[0][0] = buttonA;
    page.grid[0][1] = buttonB;
    page.images = [];
    page.sounds = [];

    tree.addPage(page);
    tree.rootId = page.id;

    processor.saveFromTree(tree, outObfPath);
    const savedObf = JSON.parse(fs.readFileSync(outObfPath, 'utf8'));

    expect(savedObf.format).toBe('open-board-0.1');
    expect(savedObf.description_html).toBe('Meta Page');
    expect(savedObf.locale).toBe('en');
    expect(savedObf.grid).toEqual({
      rows: 2,
      columns: 2,
      order: [
        ['btn-a', 'btn-b'],
        [null, null],
      ],
    });
    expect(savedObf.images).toEqual([]);
    expect(savedObf.sounds).toEqual([]);
  });
});
