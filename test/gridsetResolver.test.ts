import AdmZip from 'adm-zip';
import { resolveGrid3CellImage } from '../src/processors/gridset/resolver';

describe('resolveGrid3CellImage', () => {
  function mkZip(entries: Record<string, Buffer | string>): AdmZip {
    const zip = new AdmZip();
    for (const [name, data] of Object.entries(entries)) {
      zip.addFile(name, Buffer.isBuffer(data) ? data : Buffer.from(data));
    }
    return zip;
  }

  it('resolves declared image in Images/ subfolder', () => {
    const zip = mkZip({
      'Grids/Home/Images/dog.png': 'PNGDATA',
    });
    const p = resolveGrid3CellImage(zip, {
      baseDir: 'Grids/Home/',
      imageName: 'dog.png',
    });
    expect(p).toBe('Grids/Home/Images/dog.png');
  });

  it('uses FileMap dynamic files with coordinate prefix', () => {
    const zip = mkZip({
      'Grids/Home/1-5-0-text-0.jpeg': 'IMG',
      'Grids/Home/1-5.jpeg': 'ALT',
    });
    const p = resolveGrid3CellImage(zip, {
      baseDir: 'Grids/Home/',
      x: 1,
      y: 5,
      dynamicFiles: ['Grids/Home/1-5-0-text-0.jpeg'],
    });
    expect(p).toBe('Grids/Home/1-5-0-text-0.jpeg');
  });

  it('falls back to coordinate guesses when no name or map', () => {
    const zip = mkZip({
      'Grids/Home/1-1.jpeg': 'IMG',
    });
    const p = resolveGrid3CellImage(zip, {
      baseDir: 'Grids/Home/',
      x: 1,
      y: 1,
    });
    expect(p).toBe('Grids/Home/1-1.jpeg');
  });

  it('treats built-in [grid3x] names as non-zip assets unless mapped', () => {
    const zip = mkZip({});
    const p1 = resolveGrid3CellImage(zip, {
      baseDir: 'Grids/Home/',
      imageName: '[grid3x]Home',
    });
    expect(p1).toBeNull();

    const p2 = resolveGrid3CellImage(zip, {
      baseDir: 'Grids/Home/',
      imageName: '[grid3x]Home',
      builtinHandler: () => 'builtin://home',
    });
    expect(p2).toBe('builtin://home');
  });
});
