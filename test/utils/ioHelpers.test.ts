import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  decodeText,
  encodeBase64,
  encodeText,
  getBasename,
  readBinaryFromInput,
  readTextFromInput,
  writeBinaryToPath,
  writeTextToPath,
} from '../../src/utils/io';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('io helpers', () => {
  it('reads and writes text and binary files', () => {
    const tempDir = createTempDir('aac-io-test-');
    const textPath = path.join(tempDir, 'note.txt');
    const binPath = path.join(tempDir, 'data.bin');

    try {
      writeTextToPath(textPath, 'hello');
      expect(readTextFromInput(textPath)).toBe('hello');
      const bin = readBinaryFromInput(textPath);
      expect(Buffer.isBuffer(bin)).toBe(true);

      const data = Buffer.from([1, 2, 3, 4]);
      writeBinaryToPath(binPath, data);
      const readBack = readBinaryFromInput(binPath);
      expect(Buffer.from(readBack)).toEqual(data);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('encodes and decodes text helpers', () => {
    const encoded = encodeText('abc');
    expect(Buffer.from(encoded).toString('utf8')).toBe('abc');

    const base64 = encodeBase64(Buffer.from('xyz', 'utf8'));
    expect(base64).toBe('eHl6');

    const decoded = decodeText(new Uint8Array([104, 105]));
    expect(decoded).toBe('hi');
  });

  it('extracts basenames from paths', () => {
    expect(getBasename('/tmp/example.txt')).toBe('example.txt');
    expect(getBasename('C:\\\\temp\\\\example.txt')).toBe('example.txt');
  });
});
