import { ObfProcessor } from '../src/processors/obfProcessor';
import { AstericsGridProcessor } from '../src/processors/astericsGridProcessor';
import path from 'path';
import fs from 'fs';

type AstericsGridJson = {
  grids: Array<{
    label?: Record<string, string>;
    gridElements: Array<{ label?: Record<string, string> }>;
  }>;
};

describe('Multilingual Support via processTexts', () => {
  const tempDir = path.join(__dirname, 'temp_multilingual');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('AstericsGridProcessor', () => {
    const assetsDir = path.join(__dirname, 'assets/asterics');
    const exampleGrd = path.join(assetsDir, 'example2.grd');

    it('adds the new locale alongside existing languages', async () => {
      const processor = new AstericsGridProcessor();
      const output = path.join(tempDir, 'asterics_multi.grd');

      const translations = new Map<string, string>([
        ['Change in element', 'Cambio elemento'],
        ['I', 'Io'],
        ['You', 'Tu'],
      ]);

      await processor.processTexts(exampleGrd, translations, output, 'it');

      const content = fs.readFileSync(output, 'utf8');
      const json = JSON.parse(content) as AstericsGridJson;

      const grid = json.grids.find((g) => g.label?.en === 'Change in element');
      expect(grid).toBeDefined();
      if (!grid) return;

      expect(grid.label?.it).toBe('Cambio elemento');
      expect(grid.label?.en).toBe('Change in element');

      const elementI = grid.gridElements.find((el) => el.label?.en === 'I');
      expect(elementI).toBeDefined();
      if (!elementI) return;

      expect(elementI.label?.it).toBe('Io');
      expect(elementI.label?.en).toBe('I');

      const elementYou = grid.gridElements.find((el) => el.label?.en === 'You');
      expect(elementYou).toBeDefined();
      if (!elementYou) return;

      expect(elementYou.label?.it).toBe('Tu');
      expect(elementYou.label?.en).toBe('You');
    });
  });

  describe('ObfProcessor', () => {
    const assetsDir = path.join(__dirname, 'assets/obf');
    const multiObf = path.join(assetsDir, 'multilingual.obf');

    it('should add a new language to OBF strings', async () => {
      const processor = new ObfProcessor();
      const output = path.join(tempDir, 'obf_multi.obf');

      // multilingual.obf has en, es, fr.
      // en: "happy" -> "happy"
      // es: "happy" -> "contento"

      // We want to add 'de' (German).
      const translations = new Map<string, string>();
      translations.set('happy', 'glücklich');
      translations.set('time', 'zeit'); // time is mapped to :time in file

      // Note: In OBF, "happy" is the value for key "happy".
      // ":time" is key, "time" is value.
      // My implementation maps VALUE to KEYS.
      // So 'time' -> matches ':time' -> adds 'de'[':time'] = 'zeit'.

      await processor.processTexts(multiObf, translations, output, 'de');

      const content = fs.readFileSync(output, 'utf8');
      const json = JSON.parse(content);

      expect(json.strings).toBeDefined();
      expect(json.strings.de).toBeDefined();
      expect(json.strings.de.happy).toBe('glücklich');
      expect(json.strings.de[':time']).toBe('zeit');

      // Existing shouldn't change
      expect(json.strings.en.happy).toBe('happy');
    });
  });
});
