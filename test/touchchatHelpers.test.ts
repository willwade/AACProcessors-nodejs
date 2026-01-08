import { AACTree, AACPage, TouchChat } from '../src/index';

describe('TouchChat helpers', () => {
  it('maps page buttons with resolved images', async () => {
    const tree = new AACTree();
    const page = new AACPage({
      id: 'page1',
      buttons: [{ id: 'btn1', resolvedImageEntry: 'img.png' } as any],
    });
    tree.addPage(page);

    const map = TouchChat.getPageTokenImageMap(tree, 'page1');
    expect(map.get('btn1')).toBe('img.png');

    const empty = TouchChat.getPageTokenImageMap(tree, 'missing');
    expect(empty.size).toBe(0);
  });

  it('returns empty image sets/placeholders', async () => {
    const tree = new AACTree();
    expect(TouchChat.getAllowedImageEntries(tree).size).toBe(0);
    expect(TouchChat.openImage('ce', 'entry')).toBeNull();
  });
});
