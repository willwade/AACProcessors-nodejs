import { ObfProcessor } from '../src/processors/obfProcessor';
// import { AACButton } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';

describe('ObfProcessor Multilingual Support', () => {
  const assetsDir = path.join(__dirname, 'assets/obf');
  const multilingualObfPath = path.join(assetsDir, 'multilingual.obf');

  it('should resolve strings based on default locale (en)', async () => {
    const processor = new ObfProcessor();
    const tree = await processor.loadIntoTree(multilingualObfPath);
    const page = Object.values(tree.pages)[0];

    // Check buttons
    const btnHappy = page.buttons.find((b) => b.id.endsWith('::1'));
    const btnTime = page.buttons.find((b) => b.id.endsWith('::2'));
    const btnBrian = page.buttons.find((b) => b.id.endsWith('::3'));

    // "happy" -> "happy" (in strings.en)
    expect(btnHappy?.label).toBe('happy');

    // ":time" -> "time" (in strings.en)
    expect(btnTime?.label).toBe('time');

    // "Brian" -> "Brian" (fallback to attribute as-is)
    expect(btnBrian?.label).toBe('Brian');
  });

  it('should resolve strings based on locale "es"', async () => {
    const processor = new ObfProcessor();

    // Read and modify locale to 'es'
    const content = fs.readFileSync(multilingualObfPath, 'utf8');
    const obfData = JSON.parse(content);
    obfData.locale = 'es';

    const tree = await processor.loadIntoTree(JSON.stringify(obfData));
    const page = Object.values(tree.pages)[0];

    const btnHappy = page.buttons.find((b) => b.id.endsWith('::1'));
    const btnTime = page.buttons.find((b) => b.id.endsWith('::2'));
    const btnBrian = page.buttons.find((b) => b.id.endsWith('::3'));

    // "happy" -> "contento" (in strings.es)
    expect(btnHappy?.label).toBe('contento');

    // ":time" -> "hora" (in strings.es)
    expect(btnTime?.label).toBe('hora');

    // "Brian" -> "Brian" (fallback, not in strings.es)
    expect(btnBrian?.label).toBe('Brian');
  });

  it('should resolve strings based on locale "fr" (partial)', async () => {
    const processor = new ObfProcessor();

    const content = fs.readFileSync(multilingualObfPath, 'utf8');
    const obfData = JSON.parse(content);
    obfData.locale = 'fr';

    const tree = await processor.loadIntoTree(JSON.stringify(obfData));
    const page = Object.values(tree.pages)[0];

    const btnHappy = page.buttons.find((b) => b.id.endsWith('::1'));
    const btnTime = page.buttons.find((b) => b.id.endsWith('::2'));

    // "happy" -> "happy" (fallback to attribute, as not in strings.fr)
    expect(btnHappy?.label).toBe('happy');

    // ":time" -> "temps" (in strings.fr)
    expect(btnTime?.label).toBe('temps');
  });
});
