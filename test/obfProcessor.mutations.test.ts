import { ObfProcessor } from '../src/processors/obfProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';

describe('ObfProcessor mutations', () => {
  it('should handle removeButton mutations correctly', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button1 = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });
    const button2 = new AACButton({
      id: 'btn-2',
      label: 'Button 2',
      message: 'Message 2',
    });

    page.addButton(button1);
    page.addButton(button2);
    tree.addPage(page);

    // Remove button2
    page.removeButton('btn-2');

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
    expect(reloadedTree.pages['test-page'].buttons[0].id).toBe('btn-1');
  });

  it('should handle updateButton mutations correctly', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button = new AACButton({
      id: 'btn-1',
      label: 'Original Label',
      message: 'Original Message',
    });

    page.addButton(button);
    tree.addPage(page);

    // Update button
    page.updateButton('btn-1', { label: 'Updated Label' });

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
    expect(reloadedTree.pages['test-page'].buttons[0].label).toBe('Updated Label');
    expect(reloadedTree.pages['test-page'].buttons[0].message).toBe('Original Message');
  });

  it('should handle multiple mutations correctly', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button1 = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });
    const button2 = new AACButton({
      id: 'btn-2',
      label: 'Button 2',
      message: 'Message 2',
    });
    const button3 = new AACButton({
      id: 'btn-3',
      label: 'Button 3',
      message: 'Message 3',
    });

    page.addButton(button1);
    page.addButton(button2);
    page.addButton(button3);
    tree.addPage(page);

    // Apply mutations
    page.removeButton('btn-2');
    page.updateButton('btn-1', { label: 'Updated Button 1' });

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(2);
    expect(reloadedTree.pages['test-page'].buttons[0].label).toBe('Updated Button 1');
    expect(reloadedTree.pages['test-page'].buttons[1].label).toBe('Button 3');
  });

  it('should skip WordList mutations for OBF', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });

    page.addButton(button);
    tree.addPage(page);

    // Add WordList items (should be ignored for OBF)
    page.addWordListItem({ text: 'Mum', partOfSpeech: 'Noun' });
    page.addWordListItem({ text: 'Dad', partOfSpeech: 'Noun' });

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
    // WordList items should not appear as buttons in OBF
  });

  it('should skip removeWordListItem mutations for OBF', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });

    page.addButton(button);
    page.addWordListItem({ text: 'Test' });
    page.removeWordListItem('Test');
    tree.addPage(page);

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
  });

  it('should skip clearWordList mutations for OBF', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });

    page.addButton(button);
    page.addWordListItem({ text: 'Test' });
    page.clearWordList();
    tree.addPage(page);

    // Save and reload
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
  });

  it('should handle empty mutations array', async () => {
    const processor = new ObfProcessor();
    const tree = new AACTree();

    const page = new AACPage({
      id: 'test-page',
      name: 'Test Page',
      grid: [
        [null, null],
        [null, null],
      ],
    });

    const button = new AACButton({
      id: 'btn-1',
      label: 'Button 1',
      message: 'Message 1',
    });

    page.addButton(button);
    tree.addPage(page);

    // Save without additional mutations
    await processor.saveFromTree(tree, 'test/out-obf-mutations.obf');
    const reloadedTree = await processor.loadIntoTree('test/out-obf-mutations.obf');

    expect(reloadedTree.pages['test-page']).toBeDefined();
    expect(reloadedTree.pages['test-page'].buttons).toHaveLength(1);
    expect(reloadedTree.pages['test-page'].buttons[0].label).toBe('Button 1');
  });
});
