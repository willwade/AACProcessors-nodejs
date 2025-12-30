import { AACTree, AACPage } from '../src/core/treeStructure';
import {
  getAllowedImageEntries,
  getPageTokenImageMap,
  openImage,
} from '../src/processors/touchchat/helpers';

describe('TouchChat helpers', () => {
  it('maps page buttons with resolved images', () => {
    const tree = new AACTree();
    const page = new AACPage({
      id: 'page1',
      buttons: [{ id: 'btn1', resolvedImageEntry: 'img.png' } as any],
    });
    tree.addPage(page);

    const map = getPageTokenImageMap(tree, 'page1');
    expect(map.get('btn1')).toBe('img.png');

    const empty = getPageTokenImageMap(tree, 'missing');
    expect(empty.size).toBe(0);
  });

  it('returns empty image sets/placeholders', () => {
    const tree = new AACTree();
    expect(getAllowedImageEntries(tree).size).toBe(0);
    expect(openImage('ce', 'entry')).toBeNull();
  });
});
