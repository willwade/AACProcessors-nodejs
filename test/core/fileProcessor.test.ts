import FileProcessor from '../../src/core/fileProcessor';
import path from 'path';
import fs from 'fs';

describe('FileProcessor', () => {
    const tempDir = path.join(__dirname, 'temp_fileProcessor');
    const tempFile = path.join(tempDir, 'test.txt');
    const tempDotFile = path.join(tempDir, 'test.dot');

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
    });

    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('readFile and writeFile', () => {
        it('should write and read a file', () => {
            const content = 'hello world';
            FileProcessor.writeFile(tempFile, content);
            const buffer = FileProcessor.readFile(tempFile);
            expect(buffer.toString()).toBe(content);
        });
    });

    describe('detectFormat', () => {
        it('should detect format from file extension', () => {
            expect(FileProcessor.detectFormat('test.gridset')).toBe('gridset');
            expect(FileProcessor.detectFormat('test.obf')).toBe('coughdrop');
            expect(FileProcessor.detectFormat('test.obz')).toBe('coughdrop');
            expect(FileProcessor.detectFormat('test.ce')).toBe('touchchat');
            expect(FileProcessor.detectFormat('test.sps')).toBe('snap');
            expect(FileProcessor.detectFormat('test.dot')).toBe('dot');
            expect(FileProcessor.detectFormat('test.opml')).toBe('opml');
            expect(FileProcessor.detectFormat('test.unknown')).toBe('unknown');
        });

        it('should return "unknown" for a buffer', () => {
            const buffer = Buffer.from('hello world');
            expect(FileProcessor.detectFormat(buffer)).toBe('unknown');
        });
    });
});
