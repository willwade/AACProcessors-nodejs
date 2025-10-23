import AdmZip from 'adm-zip';
import {
  createWordlist,
  extractWordlists,
  updateWordlist,
  wordlistToXml,
  WordList,
  WordListItem,
} from '../src/processors/gridset/wordlistHelpers';

describe('Grid3 Wordlist Helpers', () => {
  describe('createWordlist', () => {
    it('creates wordlist from simple string array', () => {
      const input = ['hello', 'goodbye', 'thank you'];
      const wordlist = createWordlist(input);

      expect(wordlist.items).toHaveLength(3);
      expect(wordlist.items[0].text).toBe('hello');
      expect(wordlist.items[1].text).toBe('goodbye');
      expect(wordlist.items[2].text).toBe('thank you');
    });

    it('creates wordlist from array of WordListItem objects', () => {
      const input: WordListItem[] = [
        { text: 'hello', image: '[WIDGIT]greetings/hello.emf', partOfSpeech: 'Interjection' },
        { text: 'goodbye', image: '[WIDGIT]greetings/goodbye.emf', partOfSpeech: 'Interjection' },
      ];
      const wordlist = createWordlist(input);

      expect(wordlist.items).toHaveLength(2);
      expect(wordlist.items[0].text).toBe('hello');
      expect(wordlist.items[0].image).toBe('[WIDGIT]greetings/hello.emf');
      expect(wordlist.items[0].partOfSpeech).toBe('Interjection');
    });

    it('creates wordlist from dictionary of strings', () => {
      const input = {
        greeting: 'hello',
        farewell: 'goodbye',
        gratitude: 'thank you',
      };
      const wordlist = createWordlist(input);

      expect(wordlist.items).toHaveLength(3);
      expect(wordlist.items.map((i) => i.text)).toContain('hello');
      expect(wordlist.items.map((i) => i.text)).toContain('goodbye');
    });

    it('creates wordlist from dictionary of objects', () => {
      const input: Record<string, WordListItem> = {
        greeting: { text: 'hello', partOfSpeech: 'Interjection' },
        farewell: { text: 'goodbye', partOfSpeech: 'Interjection' },
      };
      const wordlist = createWordlist(input);

      expect(wordlist.items).toHaveLength(2);
      expect(wordlist.items[0].partOfSpeech).toBe('Interjection');
    });

    it('handles empty array', () => {
      const wordlist = createWordlist([]);
      expect(wordlist.items).toHaveLength(0);
    });

    it('handles empty object', () => {
      const wordlist = createWordlist({});
      expect(wordlist.items).toHaveLength(0);
    });
  });

  describe('wordlistToXml', () => {
    it('converts wordlist to valid XML', () => {
      const wordlist: WordList = {
        items: [
          { text: 'hello', image: '[WIDGIT]hello.emf', partOfSpeech: 'Interjection' },
          { text: 'goodbye', partOfSpeech: 'Interjection' },
        ],
      };

      const xml = wordlistToXml(wordlist);

      expect(xml).toContain('<WordList>');
      expect(xml).toContain('</WordList>');
      expect(xml).toContain('<Items>');
      expect(xml).toContain('hello');
      expect(xml).toContain('goodbye');
      expect(xml).toContain('[WIDGIT]hello.emf');
    });

    it('handles single item wordlist', () => {
      const wordlist: WordList = {
        items: [{ text: 'hello' }],
      };

      const xml = wordlistToXml(wordlist);
      expect(xml).toContain('hello');
      expect(xml).toContain('<WordList>');
    });

    it('includes PartOfSpeech as Unknown when not specified', () => {
      const wordlist: WordList = {
        items: [{ text: 'hello' }],
      };

      const xml = wordlistToXml(wordlist);
      expect(xml).toContain('Unknown');
    });
  });

  describe('extractWordlists', () => {
    function createTestGridset(gridName: string, wordlistXml: string): Buffer {
      const zip = new AdmZip();

      // Create a minimal grid.xml with wordlist
      const gridXml = `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>test-grid-id</GridGuid>
  <BackgroundColour>#E2EDF8FF</BackgroundColour>
  <ColumnDefinitions>
    <ColumnDefinition />
  </ColumnDefinitions>
  <RowDefinitions>
    <RowDefinition />
  </RowDefinitions>
  <Cells>
    <Cell X="0" Y="0">
      <Content>
        <ContentType>AutoContent</ContentType>
        <ContentSubType>WordList</ContentSubType>
      </Content>
    </Cell>
  </Cells>
  ${wordlistXml}
</Grid>`;

      zip.addFile(`Grids/${gridName}/grid.xml`, Buffer.from(gridXml, 'utf8'));
      return zip.toBuffer();
    }

    it('extracts wordlist from gridset', () => {
      const wordlistXml = `<WordList>
  <Items>
    <WordListItem>
      <Text><s><r>hello</r></s></Text>
      <Image>[WIDGIT]hello.emf</Image>
      <PartOfSpeech>Interjection</PartOfSpeech>
    </WordListItem>
    <WordListItem>
      <Text><s><r>goodbye</r></s></Text>
      <Image>[WIDGIT]goodbye.emf</Image>
      <PartOfSpeech>Interjection</PartOfSpeech>
    </WordListItem>
  </Items>
</WordList>`;

      const gridset = createTestGridset('Greetings', wordlistXml);
      const wordlists = extractWordlists(gridset);

      expect(wordlists.size).toBe(1);
      expect(wordlists.has('Greetings')).toBe(true);

      const wordlist = wordlists.get('Greetings')!;
      expect(wordlist.items).toHaveLength(2);
      expect(wordlist.items[0].text).toBe('hello');
      expect(wordlist.items[0].image).toBe('[WIDGIT]hello.emf');
      expect(wordlist.items[1].text).toBe('goodbye');
    });

    it('returns empty map for gridset without wordlists', () => {
      const zip = new AdmZip();
      const gridXml = `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>test-grid-id</GridGuid>
  <Cells><Cell X="0" Y="0"><Content></Content></Cell></Cells>
</Grid>`;

      zip.addFile('Grids/Home/grid.xml', Buffer.from(gridXml, 'utf8'));
      const wordlists = extractWordlists(zip.toBuffer());

      expect(wordlists.size).toBe(0);
    });

    it('handles multiple grids with wordlists', () => {
      const zip = new AdmZip();

      const createGrid = (name: string, items: string[]) => {
        const itemsXml = items
          .map(
            (item) => `
    <WordListItem>
      <Text><s><r>${item}</r></s></Text>
      <PartOfSpeech>Unknown</PartOfSpeech>
    </WordListItem>`
          )
          .join('');

        return `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>${name}-id</GridGuid>
  <Cells><Cell X="0" Y="0"><Content></Content></Cell></Cells>
  <WordList>
    <Items>${itemsXml}
    </Items>
  </WordList>
</Grid>`;
      };

      zip.addFile('Grids/Greetings/grid.xml', Buffer.from(createGrid('Greetings', ['hello', 'hi']), 'utf8'));
      zip.addFile('Grids/Farewells/grid.xml', Buffer.from(createGrid('Farewells', ['goodbye', 'bye']), 'utf8'));

      const wordlists = extractWordlists(zip.toBuffer());

      expect(wordlists.size).toBe(2);
      expect(wordlists.get('Greetings')?.items).toHaveLength(2);
      expect(wordlists.get('Farewells')?.items).toHaveLength(2);
    });

    it('throws error for invalid gridset buffer', () => {
      const invalidBuffer = Buffer.from('not a zip file');
      expect(() => extractWordlists(invalidBuffer)).toThrow();
    });

    it('skips grids with malformed wordlist XML', () => {
      const zip = new AdmZip();
      const gridXml = `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>test-id</GridGuid>
  <Cells><Cell X="0" Y="0"><Content></Content></Cell></Cells>
  <WordList>
    <Items>MALFORMED</Items>
  </WordList>
</Grid>`;

      zip.addFile('Grids/Test/grid.xml', Buffer.from(gridXml, 'utf8'));
      const wordlists = extractWordlists(zip.toBuffer());

      // Should not throw, just skip the malformed grid
      expect(wordlists.size).toBe(0);
    });
  });

  describe('updateWordlist', () => {
    function createTestGridset(gridName: string, initialWordlistXml?: string): Buffer {
      const zip = new AdmZip();

      const wordlistSection = initialWordlistXml || `<WordList>
  <Items>
    <WordListItem>
      <Text><s><r>old</r></s></Text>
      <PartOfSpeech>Unknown</PartOfSpeech>
    </WordListItem>
  </Items>
</WordList>`;

      const gridXml = `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>test-grid-id</GridGuid>
  <BackgroundColour>#E2EDF8FF</BackgroundColour>
  <ColumnDefinitions>
    <ColumnDefinition />
  </ColumnDefinitions>
  <RowDefinitions>
    <RowDefinition />
  </RowDefinitions>
  <Cells>
    <Cell X="0" Y="0">
      <Content>
        <ContentType>AutoContent</ContentType>
        <ContentSubType>WordList</ContentSubType>
      </Content>
    </Cell>
  </Cells>
  ${wordlistSection}
</Grid>`;

      zip.addFile(`Grids/${gridName}/grid.xml`, Buffer.from(gridXml, 'utf8'));
      return zip.toBuffer();
    }

    it('updates wordlist in existing grid', () => {
      const gridset = createTestGridset('Greetings');
      const newWordlist = createWordlist(['hello', 'hi', 'hey']);

      const updated = updateWordlist(gridset, 'Greetings', newWordlist);
      const wordlists = extractWordlists(updated);

      expect(wordlists.has('Greetings')).toBe(true);
      const wordlist = wordlists.get('Greetings')!;
      expect(wordlist.items).toHaveLength(3);
      expect(wordlist.items.map((i) => i.text)).toEqual(['hello', 'hi', 'hey']);
    });

    it('updates wordlist with metadata', () => {
      const gridset = createTestGridset('Greetings');
      const newWordlist = createWordlist([
        { text: 'hello', image: '[WIDGIT]hello.emf', partOfSpeech: 'Interjection' },
        { text: 'goodbye', image: '[WIDGIT]goodbye.emf', partOfSpeech: 'Interjection' },
      ]);

      const updated = updateWordlist(gridset, 'Greetings', newWordlist);
      const wordlists = extractWordlists(updated);

      const wordlist = wordlists.get('Greetings')!;
      expect(wordlist.items[0].image).toBe('[WIDGIT]hello.emf');
      expect(wordlist.items[0].partOfSpeech).toBe('Interjection');
    });

    it('replaces existing wordlist completely', () => {
      const gridset = createTestGridset('Greetings');
      const extracted1 = extractWordlists(gridset);
      expect(extracted1.get('Greetings')?.items[0].text).toBe('old');

      const newWordlist = createWordlist(['new1', 'new2']);
      const updated = updateWordlist(gridset, 'Greetings', newWordlist);
      const extracted2 = extractWordlists(updated);

      expect(extracted2.get('Greetings')?.items).toHaveLength(2);
      expect(extracted2.get('Greetings')?.items[0].text).toBe('new1');
    });

    it('throws error for non-existent grid', () => {
      const gridset = createTestGridset('Greetings');
      const newWordlist = createWordlist(['hello']);

      expect(() => updateWordlist(gridset, 'NonExistent', newWordlist)).toThrow(
        'Grid "NonExistent" not found in gridset'
      );
    });

    it('throws error for invalid gridset buffer', () => {
      const invalidBuffer = Buffer.from('not a zip file');
      const newWordlist = createWordlist(['hello']);

      expect(() => updateWordlist(invalidBuffer, 'Greetings', newWordlist)).toThrow();
    });

    it('preserves other grids when updating one', () => {
      const zip = new AdmZip();

      const createGrid = (name: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>${name}-id</GridGuid>
  <Cells><Cell X="0" Y="0"><Content></Content></Cell></Cells>
  <WordList>
    <Items>
      <WordListItem>
        <Text><s><r>${name}-item</r></s></Text>
        <PartOfSpeech>Unknown</PartOfSpeech>
      </WordListItem>
    </Items>
  </WordList>
</Grid>`;

      zip.addFile('Grids/Greetings/grid.xml', Buffer.from(createGrid('Greetings'), 'utf8'));
      zip.addFile('Grids/Farewells/grid.xml', Buffer.from(createGrid('Farewells'), 'utf8'));

      const newWordlist = createWordlist(['updated']);
      const updated = updateWordlist(zip.toBuffer(), 'Greetings', newWordlist);
      const wordlists = extractWordlists(updated);

      expect(wordlists.get('Greetings')?.items[0].text).toBe('updated');
      expect(wordlists.get('Farewells')?.items[0].text).toBe('Farewells-item');
    });
  });
});

