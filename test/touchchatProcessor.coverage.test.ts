import { TouchChatProcessor } from '../src/processors/touchchatProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import os from 'os';
import Database from 'better-sqlite3';

describe('TouchChatProcessor Coverage', () => {
  const _exampleFile: string = path.join(__dirname, '../examples/example.ce');
  const tempDir = path.join(os.tmpdir(), 'touchchat-test');
  const tempDbPath = path.join(tempDir, 'vocab.c4v');
  const tempZipPath = path.join(__dirname, 'temp.ce');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
  });

  describe('File Handling', () => {
    it('should throw an error if no .c4v file is found in the archive', () => {
      const zip = new AdmZip();
      zip.addFile('test.txt', Buffer.from('hello'));
      zip.writeZip(tempZipPath);

      const processor = new TouchChatProcessor();
      expect(() => processor.loadIntoTree(tempZipPath)).toThrow(
        'No .c4v vocab DB found in TouchChat export'
      );
    });
  });

  describe('Save and Load with UNIQUE constraints', () => {
    it('should save and reload a tree without UNIQUE constraint violations', () => {
      const processor = new TouchChatProcessor();
      const tree = new AACTree();
      const originalPage1 = new AACPage({
        id: '1',
        name: 'Page 1',
        buttons: [],
      });
      const button1 = new AACButton({ id: '101', label: 'Button 1' });
      originalPage1.addButton(button1);
      tree.addPage(originalPage1);

      const originalPage2 = new AACPage({
        id: '2',
        name: 'Page 2',
        buttons: [],
      });
      const button2 = new AACButton({ id: '102', label: 'Button 2' });
      originalPage2.addButton(button2);
      tree.addPage(originalPage2);

      processor.saveFromTree(tree, tempZipPath);

      const newProcessor = new TouchChatProcessor();
      const newTree = newProcessor.loadIntoTree(tempZipPath);

      expect(Object.keys(newTree.pages).length).toBe(2);
      const loadedPage1 = newTree.getPage('1');
      const loadedPage2 = newTree.getPage('2');
      expect(loadedPage1).toBeDefined();
      expect(loadedPage2).toBeDefined();
      if (loadedPage1) {
        expect(loadedPage1.buttons.length).toBe(1);
      }
      if (loadedPage2) {
        expect(loadedPage2.buttons.length).toBe(1);
      }
    });
  });

  describe('Schema Variations', () => {
    it('should handle different table schemas gracefully', () => {
      const db = new Database(tempDbPath);
      db.exec(`
            CREATE TABLE resources (id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE pages (id INTEGER PRIMARY KEY, resource_id INTEGER);
        `);
      db.prepare('INSERT INTO resources (id, name) VALUES (?, ?)').run(1, 'Page 1');
      db.prepare('INSERT INTO pages (id, resource_id) VALUES (?, ?)').run(1, 1);
      db.close();

      const zip = new AdmZip();
      zip.addLocalFile(tempDbPath);
      zip.writeZip(tempZipPath);

      const processor = new TouchChatProcessor();
      const tree = processor.loadIntoTree(tempZipPath);
      expect(Object.keys(tree.pages).length).toBe(1);
      const testPage = tree.getPage('1');
      expect(testPage).toBeDefined();
      expect(testPage!.buttons.length).toBe(0); // No buttons table
    });
  });
});
