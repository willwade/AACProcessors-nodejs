import FileProcessor from '../../src/core/fileProcessor';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('FileProcessor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileprocessor-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('readFile', () => {
    it('should read a file and return Buffer', () => {
      const tempFile = path.join(tempDir, 'test.txt');
      const testContent = 'Hello, World!';
      fs.writeFileSync(tempFile, testContent);

      const result = FileProcessor.readFile(tempFile);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe(testContent);
    });

    it('should throw error for non-existent file', () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');

      expect(() => FileProcessor.readFile(nonExistentFile)).toThrow();
    });

    it('should handle binary files', () => {
      const testFile = path.join(tempDir, 'binary.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      fs.writeFileSync(testFile, binaryData);

      const result = FileProcessor.readFile(testFile);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(binaryData);
    });

    it('should handle empty files', () => {
      const testFile = path.join(tempDir, 'empty.txt');
      fs.writeFileSync(testFile, '');

      const result = FileProcessor.readFile(testFile);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('writeFile', () => {
    it('should write string data to file', () => {
      const testFile = path.join(tempDir, 'output.txt');
      const testContent = 'Hello, World!';

      FileProcessor.writeFile(testFile, testContent);

      expect(fs.existsSync(testFile)).toBe(true);
      const readContent = fs.readFileSync(testFile, 'utf8');
      expect(readContent).toBe(testContent);
    });

    it('should write Buffer data to file', () => {
      const testFile = path.join(tempDir, 'output.bin');
      const testBuffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);

      FileProcessor.writeFile(testFile, testBuffer);

      expect(fs.existsSync(testFile)).toBe(true);
      const readBuffer = fs.readFileSync(testFile);
      expect(readBuffer).toEqual(testBuffer);
    });

    it('should overwrite existing files', () => {
      const testFile = path.join(tempDir, 'overwrite.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';

      // Write original content
      FileProcessor.writeFile(testFile, originalContent);
      expect(fs.readFileSync(testFile, 'utf8')).toBe(originalContent);

      // Overwrite with new content
      FileProcessor.writeFile(testFile, newContent);
      expect(fs.readFileSync(testFile, 'utf8')).toBe(newContent);
    });

    it('should handle empty string content', () => {
      const testFile = path.join(tempDir, 'empty.txt');

      FileProcessor.writeFile(testFile, '');

      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('');
    });
  });

  describe('detectFormat', () => {
    describe('file path detection', () => {
      it('should detect gridset format', () => {
        expect(FileProcessor.detectFormat('test.gridset')).toBe('gridset');
        expect(FileProcessor.detectFormat('/path/to/file.gridset')).toBe('gridset');
      });

      it('should detect coughdrop format', () => {
        expect(FileProcessor.detectFormat('test.obf')).toBe('coughdrop');
        expect(FileProcessor.detectFormat('test.obz')).toBe('coughdrop');
      });

      it('should detect touchchat format', () => {
        expect(FileProcessor.detectFormat('test.ce')).toBe('touchchat');
        expect(FileProcessor.detectFormat('test.wfl')).toBe('touchchat');
        expect(FileProcessor.detectFormat('test.touchchat')).toBe('touchchat');
      });

      it('should detect snap format', () => {
        expect(FileProcessor.detectFormat('test.sps')).toBe('snap');
        expect(FileProcessor.detectFormat('test.spb')).toBe('snap');
      });

      it('should detect dot format', () => {
        expect(FileProcessor.detectFormat('test.dot')).toBe('dot');
      });

      it('should detect opml format', () => {
        expect(FileProcessor.detectFormat('test.opml')).toBe('opml');
      });

      it('should handle case insensitive extensions', () => {
        expect(FileProcessor.detectFormat('test.GRIDSET')).toBe('gridset');
        expect(FileProcessor.detectFormat('test.OBF')).toBe('coughdrop');
        expect(FileProcessor.detectFormat('test.DOT')).toBe('dot');
      });

      it('should return unknown for unrecognized extensions', () => {
        expect(FileProcessor.detectFormat('test.txt')).toBe('unknown');
        expect(FileProcessor.detectFormat('test.xyz')).toBe('unknown');
        expect(FileProcessor.detectFormat('test')).toBe('unknown');
      });

      it('should handle files without extensions', () => {
        expect(FileProcessor.detectFormat('filename')).toBe('unknown');
        expect(FileProcessor.detectFormat('/path/to/filename')).toBe('unknown');
      });

      it('should handle empty file paths', () => {
        expect(FileProcessor.detectFormat('')).toBe('unknown');
      });
    });

    describe('buffer detection', () => {
      it('should return unknown for buffer input', () => {
        const buffer = Buffer.from('test content');
        expect(FileProcessor.detectFormat(buffer)).toBe('unknown');
      });

      it('should return unknown for empty buffer', () => {
        const buffer = Buffer.alloc(0);
        expect(FileProcessor.detectFormat(buffer)).toBe('unknown');
      });

      it('should handle binary buffer data', () => {
        const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);
        expect(FileProcessor.detectFormat(buffer)).toBe('unknown');
      });
    });

    describe('edge cases', () => {
      it('should handle null/undefined input', () => {
        expect(FileProcessor.detectFormat(null as any)).toBe('unknown');
        expect(FileProcessor.detectFormat(undefined as any)).toBe('unknown');
      });

      it('should handle non-string, non-buffer input', () => {
        expect(FileProcessor.detectFormat(123 as any)).toBe('unknown');
        expect(FileProcessor.detectFormat({} as any)).toBe('unknown');
        expect(FileProcessor.detectFormat([] as any)).toBe('unknown');
      });
    });
  });
});
