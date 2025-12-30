import { AACTree, AACPage, AACButton } from '../../src/core/treeStructure';

describe('AACButton', () => {
  it('should create a button with default values', () => {
    const button = new AACButton({ id: 'btn1' });
    expect(button.id).toBe('btn1');
    expect(button.label).toBe('');
    expect(button.message).toBe('');
    expect(button.type).toBe('SPEAK');
    expect(button.action).toBeNull();
    expect(button.targetPageId).toBeUndefined();
  });

  it('should create a navigation button', () => {
    const button = new AACButton({
      id: 'nav1',
      label: 'Go to Page 2',
      type: 'NAVIGATE',
      targetPageId: 'page2',
      action: { type: 'NAVIGATE', targetPageId: 'page2' },
    });
    expect(button.type).toBe('NAVIGATE');
    expect(button.targetPageId).toBe('page2');
    expect(button.action?.type).toBe('NAVIGATE');
    expect(button.action?.targetPageId).toBe('page2');
  });

  it('should create a button with audio recording', () => {
    const audioData = Buffer.from('audio data');
    const button = new AACButton({
      id: 'audio1',
      label: 'Hello',
      audioRecording: {
        id: 123,
        data: audioData,
        identifier: 'SND:hello',
        metadata: 'test metadata',
      },
    });
    expect(button.audioRecording?.id).toBe(123);
    expect(button.audioRecording?.data).toBe(audioData);
    expect(button.audioRecording?.identifier).toBe('SND:hello');
    expect(button.audioRecording?.metadata).toBe('test metadata');
  });
});

describe('AACPage', () => {
  it('should create a page with default values', () => {
    const page = new AACPage({ id: 'page1' });
    expect(page.id).toBe('page1');
    expect(page.name).toBe('');
    expect(page.grid).toEqual([]);
    expect(page.buttons).toEqual([]);
    expect(page.parentId).toBeNull();
  });

  it('should create a page with custom values', () => {
    const page = new AACPage({
      id: 'page2',
      name: 'Main Page',
      parentId: 'parent1',
    });
    expect(page.id).toBe('page2');
    expect(page.name).toBe('Main Page');
    expect(page.parentId).toBe('parent1');
  });

  it('should add buttons to a page', () => {
    const page = new AACPage({ id: 'page1' });
    const button1 = new AACButton({ id: 'btn1', label: 'Button 1' });
    const button2 = new AACButton({ id: 'btn2', label: 'Button 2' });

    page.addButton(button1);
    page.addButton(button2);

    expect(page.buttons).toHaveLength(2);
    expect(page.buttons[0]).toBe(button1);
    expect(page.buttons[1]).toBe(button2);
  });
});

describe('AACTree', () => {
  it('should create an empty tree', () => {
    const tree = new AACTree();
    expect(tree.pages).toEqual({});
    expect(tree.rootId).toBeNull();
  });

  it('should add pages to the tree', () => {
    const tree = new AACTree();
    const page1 = new AACPage({ id: 'page1', name: 'First Page' });
    const page2 = new AACPage({ id: 'page2', name: 'Second Page' });

    tree.addPage(page1);
    tree.addPage(page2);

    expect(Object.keys(tree.pages)).toHaveLength(2);
    expect(tree.pages['page1']).toBe(page1);
    expect(tree.pages['page2']).toBe(page2);
    expect(tree.rootId).toBe('page1'); // First page becomes root
  });

  it('should get pages by id', () => {
    const tree = new AACTree();
    const page = new AACPage({ id: 'test-page', name: 'Test Page' });
    tree.addPage(page);

    const retrievedPage = tree.getPage('test-page');
    expect(retrievedPage).toBe(page);
  });

  it('should return undefined for non-existent page', () => {
    const tree = new AACTree();
    const retrievedPage = tree.getPage('non-existent');
    expect(retrievedPage).toBeUndefined();
  });

  it('should traverse all pages', () => {
    const tree = new AACTree();
    const page1 = new AACPage({ id: 'page1', name: 'Page 1' });
    const page2 = new AACPage({ id: 'page2', name: 'Page 2' });
    const page3 = new AACPage({ id: 'page3', name: 'Page 3' });

    // Add navigation buttons
    const navButton = new AACButton({
      id: 'nav1',
      type: 'NAVIGATE',
      targetPageId: 'page2',
    });
    page1.addButton(navButton);

    const navButton2 = new AACButton({
      id: 'nav2',
      type: 'NAVIGATE',
      targetPageId: 'page3',
    });
    page2.addButton(navButton2);

    tree.addPage(page1);
    tree.addPage(page2);
    tree.addPage(page3);

    const visitedPages: string[] = [];
    tree.traverse((page) => {
      visitedPages.push(page.id);
    });

    expect(visitedPages).toContain('page1');
    expect(visitedPages).toContain('page2');
    expect(visitedPages).toContain('page3');
    expect(visitedPages).toHaveLength(3);
  });

  it('should handle circular navigation in traverse', () => {
    const tree = new AACTree();
    const page1 = new AACPage({ id: 'page1' });
    const page2 = new AACPage({ id: 'page2' });

    // Create circular navigation
    const nav1 = new AACButton({
      id: 'nav1',
      type: 'NAVIGATE',
      targetPageId: 'page2',
    });
    const nav2 = new AACButton({
      id: 'nav2',
      type: 'NAVIGATE',
      targetPageId: 'page1',
    });

    page1.addButton(nav1);
    page2.addButton(nav2);

    tree.addPage(page1);
    tree.addPage(page2);

    const visitedPages: string[] = [];
    tree.traverse((page) => {
      visitedPages.push(page.id);
    });

    // Should visit each page only once despite circular references
    expect(visitedPages).toHaveLength(2);
    expect(visitedPages).toContain('page1');
    expect(visitedPages).toContain('page2');
  });
});
