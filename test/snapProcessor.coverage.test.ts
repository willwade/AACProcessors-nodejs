import { SnapProcessor } from '../src/processors/snapProcessor';
import { TreeFactory } from './utils/testFactories';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

describe('SnapProcessor Coverage', () => {
  const exampleFile: string = path.join(__dirname, '../examples/example.sps');
  const tempDbPath = path.join(__dirname, 'temp_snap.db');

  beforeEach(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('Audio Handling', () => {
    it('should load audio data when loadAudio is true', () => {
      const saveProcessor = new SnapProcessor();
      const tree = TreeFactory.createSimple();
      saveProcessor.saveFromTree(tree, tempDbPath);

      const db = new Database(tempDbPath);
      const firstButton = db.prepare('SELECT Id FROM Button ORDER BY Id LIMIT 1').get() as { Id: number };
      db.close();

      const audioData = Buffer.from('audio data');
      saveProcessor.addAudioToButton(tempDbPath, firstButton.Id, audioData, 'test.wav');

      const processor = new SnapProcessor(null, { loadAudio: true });
      const loadedTree = processor.loadIntoTree(tempDbPath);
      const page = Object.values(loadedTree.pages)[0];
      expect(page).toBeDefined();
      const buttonWithAudio = page?.buttons.find((button) => button.audioRecording);
      expect(buttonWithAudio).toBeDefined();
      expect(buttonWithAudio?.audioRecording?.data).toEqual(audioData);
    });

    it('should add audio to a button', () => {
      // Use a real file to test against
      fs.copyFileSync(exampleFile, tempDbPath);

      const processor = new SnapProcessor();
      const audioData = Buffer.from('new audio data');
      processor.addAudioToButton(tempDbPath, 1, audioData, 'test.wav');

      const db = new Database(tempDbPath);
      const row = db.prepare('SELECT * FROM Button WHERE Id = ?').get(1) as any;
      expect(row.MessageRecordingId).toBeGreaterThan(0);
      const audioRow = db
        .prepare('SELECT * FROM PageSetData WHERE Id = ?')
        .get(row.MessageRecordingId) as any;
      expect(audioRow.Data).toEqual(audioData);
      db.close();
    });

    it('should create an audio-enhanced pageset', () => {
      const enhancedDbPath = path.join(__dirname, 'enhanced.db');
      if (fs.existsSync(enhancedDbPath)) {
        fs.unlinkSync(enhancedDbPath);
      }

      const processor = new SnapProcessor();
      const audioMappings = new Map<number, { audioData: Buffer; metadata?: string }>();
      audioMappings.set(1, { audioData: Buffer.from('new audio') });

      processor.createAudioEnhancedPageset(exampleFile, enhancedDbPath, audioMappings);

      expect(fs.existsSync(enhancedDbPath)).toBe(true);
      const db = new Database(enhancedDbPath);
      const row = db.prepare('SELECT * FROM Button WHERE Id = ?').get(1) as any;
      expect(row.MessageRecordingId).toBeGreaterThan(0);
      db.close();
      fs.unlinkSync(enhancedDbPath);
    });
  });

  describe('Database Corruption and Schema', () => {
    it('should throw an error for a corrupted database file', () => {
      fs.writeFileSync(tempDbPath, 'not a database');
      const processor = new SnapProcessor();
      expect(() => processor.loadIntoTree(tempDbPath)).toThrow('Invalid SQLite database file');
    });

    it('should handle missing tables gracefully', () => {
      const db = new Database(tempDbPath);
      db.exec('CREATE TABLE Page (Id INTEGER PRIMARY KEY, UniqueId TEXT, Name TEXT);');
      db.close();

      const processor = new SnapProcessor();
      // This should not throw, but return an empty tree
      const tree = processor.loadIntoTree(tempDbPath);
      expect(tree.pages).toEqual({});
    });
  });
});
