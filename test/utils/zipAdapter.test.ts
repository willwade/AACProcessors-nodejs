import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { openZipFromInput } from '../../src/utils/zip';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('zip adapter (Node)', () => {
  it('reads entries from a zip buffer', async () => {
    const zip = new AdmZip();
    zip.addFile('foo.txt', Buffer.from('hello', 'utf8'));

    const buffer = zip.toBuffer();
    const { zip: adapter } = await openZipFromInput(new Uint8Array(buffer));

    expect(adapter.listFiles()).toContain('foo.txt');
    const contents = await adapter.readFile('foo.txt');
    expect(Buffer.from(contents).toString('utf8')).toBe('hello');
  });

  it('reads entries from a zip file path', async () => {
    const tempDir = createTempDir('aac-zip-test-');
    const zipPath = path.join(tempDir, 'sample.zip');
    try {
      const zip = new AdmZip();
      zip.addFile('bar.txt', Buffer.from('world', 'utf8'));
      zip.writeZip(zipPath);

      const { zip: adapter } = await openZipFromInput(zipPath);
      expect(adapter.listFiles()).toContain('bar.txt');
      const contents = await adapter.readFile('bar.txt');
      expect(Buffer.from(contents).toString('utf8')).toBe('world');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
