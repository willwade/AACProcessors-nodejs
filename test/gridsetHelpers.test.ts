import AdmZip from 'adm-zip';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';
import {
  getAllowedImageEntries,
  getPageTokenImageMap,
  openImage,
} from '../src/processors/gridset/helpers';

describe('Gridset helper APIs', () => {
  it('getPageTokenImageMap returns button.id to resolvedImageEntry map for a page', () => {
    const tree = new AACTree();
    const page = new AACPage({
      id: 'p1',
      name: 'Page 1',
      grid: { columns: 2, rows: 2 },
      buttons: [],
    });
    tree.addPage(page);

    page.addButton(
      new AACButton({
        id: 'b1',
        label: 'A',
        message: 'A',
        resolvedImageEntry: 'Grids/Home/Images/a.png',
      })
    );
    page.addButton(
      new AACButton({
        id: 'b2',
        label: 'B',
        message: 'B',
        resolvedImageEntry: 'Grids/Home/1-1.jpeg',
      })
    );

    const map = getPageTokenImageMap(tree, 'p1');
    expect(map.get('b1')).toBe('Grids/Home/Images/a.png');
    expect(map.get('b2')).toBe('Grids/Home/1-1.jpeg');
    expect(map.size).toBe(2);
  });

  it('getAllowedImageEntries aggregates unique image entries across pages', () => {
    const tree = new AACTree();
    const p1 = new AACPage({ id: 'p1', name: 'P1', grid: { columns: 1, rows: 1 }, buttons: [] });
    const p2 = new AACPage({ id: 'p2', name: 'P2', grid: { columns: 1, rows: 1 }, buttons: [] });
    tree.addPage(p1);
    tree.addPage(p2);

    p1.addButton(
      new AACButton({ id: 'b1', label: 'A', message: 'A', resolvedImageEntry: 'X/Y/a.png' })
    );
    p1.addButton(
      new AACButton({ id: 'b2', label: 'B', message: 'B', resolvedImageEntry: 'X/Y/a.png' })
    );
    p2.addButton(
      new AACButton({ id: 'b3', label: 'C', message: 'C', resolvedImageEntry: 'X/Z/c.png' })
    );

    const set = getAllowedImageEntries(tree);
    expect(set.has('X/Y/a.png')).toBe(true);
    expect(set.has('X/Z/c.png')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('openImage reads a specific entry from a gridset buffer', () => {
    const zip = new AdmZip();
    zip.addFile('Grids/Home/Images/dog.png', Buffer.from('DOGDATA'));
    const buf = zip.toBuffer();

    const data = openImage(buf, 'Grids/Home/Images/dog.png');
    expect(data?.toString('utf8')).toBe('DOGDATA');

    const missing = openImage(buf, 'Grids/Home/Images/cat.png');
    expect(missing).toBeNull();
  });
});
