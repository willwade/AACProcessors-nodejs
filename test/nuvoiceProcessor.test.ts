import fs from 'fs';
import path from 'path';
import { NuVoiceProcessor } from '../src/processors/nuvoiceProcessor';
import { listNuVoiceTextEntries, parseNuVoiceDocument } from '../src/processors/nuvoice/helpers';

describe('NuVoiceProcessor', () => {
  const tempDir = path.join(__dirname, 'temp_nuvoice');
  const sampleContent = [
    'v390 1 NUVOICE',
    'd042D4E2754086E65676174697665AA',
    'm0003FFFE0B0B515549434B2050484F4E45D2',
    'x000080474F0000040000005F0000007001000000006B005A0000000A0021000A0016000A000D000A0016000A000D000A000D00090016000A000D000A000D000A0016000A00E0080A0021000A0016000A000C000A0016000A000D000A000D000A0015000A000D000A000D000A0016000A00D3060A0021000A0016000A000D0009001600C1',
    'X0003FF0800F5',
    '',
  ].join('\r\n');

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

  it('parses representative NuVoice records correctly', () => {
    const document = parseNuVoiceDocument(sampleContent);

    expect(document.records).toHaveLength(5);

    const dictionary = document.records[1];
    expect(dictionary.type).toBe('d');
    if (dictionary.type !== 'd') {
      return;
    }
    expect(dictionary.word).toBe("-N'T");
    expect(dictionary.pronunciation).toBe('negative');
    expect(dictionary.checksumValid).toBe(true);

    const memory = document.records[2];
    expect(memory.type).toBe('m');
    if (memory.type !== 'm') {
      return;
    }
    expect(memory.addressHex).toBe('0003FFFE0B');
    expect(memory.textSegment?.text).toBe('QUICK PHONE');
    expect(memory.checksumValid).toBe(true);

    const layout = document.records[3];
    expect(layout.type).toBe('x');
    if (layout.type !== 'x') {
      return;
    }
    expect(layout.addressHex).toBe('000080');
    expect(layout.textSegment?.text).toBe('GO');
    expect(layout.checksumValid).toBe(true);
  });

  it('extracts text entries from an MTI buffer', async () => {
    const processor = new NuVoiceProcessor();
    const texts = await processor.extractTexts(Buffer.from(sampleContent, 'utf8'));

    expect(texts).toEqual(expect.arrayContaining(["-N'T", 'negative', 'QUICK PHONE', 'GO']));
  });

  it('loads a synthetic tree with grouped NuVoice pages', async () => {
    const processor = new NuVoiceProcessor();
    const tree = await processor.loadIntoTree(Buffer.from(sampleContent, 'utf8'));

    expect(tree.metadata.format).toBe('nuvoice');
    expect(tree.metadata.version).toBe('390');
    expect(tree.metadata.recordCounts).toEqual({
      d: 1,
      m: 1,
      x: 1,
      v: 1,
    });

    expect(tree.pages['dictionary']).toBeDefined();
    expect(tree.pages['memory']).toBeDefined();
    expect(tree.pages['layout']).toBeDefined();
    expect(tree.pages['main']).toBeDefined(); // Main navigation page
    expect(tree.pages['dictionary'].buttons[0].label).toBe("-N'T");
    expect(tree.pages['dictionary'].buttons[0].message).toBe('negative');
  });

  it('returns metadata-rich extracted strings', async () => {
    const processor = new NuVoiceProcessor();
    const inputPath = path.join(tempDir, 'sample.mti');
    fs.writeFileSync(inputPath, sampleContent, 'utf8');

    const result = await processor.extractStringsWithMetadata(inputPath);

    expect(result.errors).toEqual([]);
    expect(result.extractedStrings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          string: "-N'T",
          vocabPlacementMeta: expect.objectContaining({
            vocabLocations: expect.arrayContaining([
              expect.objectContaining({
                table: 'dictionary',
                column: 'WORD',
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          string: 'QUICK PHONE',
          vocabPlacementMeta: expect.objectContaining({
            vocabLocations: expect.arrayContaining([
              expect.objectContaining({
                table: 'memory',
                column: 'TEXT',
              }),
            ]),
          }),
        }),
      ])
    );
  });

  it('applies translations and regenerates valid checksums', async () => {
    const processor = new NuVoiceProcessor();
    const outputPath = path.join(tempDir, 'translated.mti');

    await processor.processTexts(
      Buffer.from(sampleContent, 'utf8'),
      new Map<string, string>([
        ["-N'T", 'NOT'],
        ['negative', 'neg-ah-tiv'],
        ['QUICK PHONE', 'FAST PHONE'],
        ['GO', 'VAYA'],
      ]),
      outputPath
    );

    const translated = fs.readFileSync(outputPath, 'utf8');
    const document = parseNuVoiceDocument(translated);
    const entries = listNuVoiceTextEntries(document).map((entry) => entry.source);

    expect(entries).toEqual(expect.arrayContaining(['NOT', 'neg-ah-tiv', 'FAST PHONE', 'VAYA']));
    expect(
      document.records
        .filter((record) => record.type !== 'v')
        .every((record) => record.checksumValid)
    ).toBe(true);
  });

  it('does not support saveFromTree yet', async () => {
    const processor = new NuVoiceProcessor();
    await expect(
      processor.saveFromTree(await processor.loadIntoTree(Buffer.from(sampleContent)), 'x')
    ).rejects.toThrow('saveFromTree is not supported');
  });
});
