import { describe, it, expect } from '@jest/globals';
import {
  parseMessageWithSymbols,
  alignWords,
  reattachSymbols,
  translateWithSymbols,
  extractSymbolsFromButton,
  type ParsedMessage,
} from '../src/processors/gridset/symbolAlignment';

describe('Symbol Alignment Utilities', () => {
  describe('parseMessageWithSymbols', () => {
    it('should parse plain text without symbols', async () => {
      const result = parseMessageWithSymbols('Hello world');

      expect(result.text).toBe('Hello world');
      expect(result.words).toEqual(['Hello', 'world']);
      expect(result.symbols).toEqual([]);
    });

    it('should parse text with richText symbols attached', async () => {
      const richTextSymbols = [
        { text: 'apple', image: '[widgit]/food/apple.png' },
        { text: 'juice', image: '[widgit]/food/juice.png' },
      ];

      const result = parseMessageWithSymbols('I want apple juice', richTextSymbols);

      expect(result.text).toBe('I want apple juice');
      expect(result.words).toEqual(['I', 'want', 'apple', 'juice']);
      expect(result.symbols).toHaveLength(2);

      // Check apple symbol
      const appleSymbol = result.symbols.find((s) => s.originalWord === 'apple');
      expect(appleSymbol).toBeDefined();
      expect(appleSymbol?.wordIndex).toBe(2);
      expect(appleSymbol?.symbolRef).toBe('[widgit]/food/apple.png');

      // Check juice symbol
      const juiceSymbol = result.symbols.find((s) => s.originalWord === 'juice');
      expect(juiceSymbol).toBeDefined();
      expect(juiceSymbol?.wordIndex).toBe(3);
      expect(juiceSymbol?.symbolRef).toBe('[widgit]/food/juice.png');
    });

    it('should handle fuzzy matching for case differences', async () => {
      const richTextSymbols = [{ text: 'Apple', image: '[widgit]/food/apple.png' }];

      const result = parseMessageWithSymbols('I want apple', richTextSymbols);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].originalWord).toBe('apple');
      expect(result.symbols[0].wordIndex).toBe(2);
    });

    it('should normalize whitespace', async () => {
      const result = parseMessageWithSymbols('I   want   apple');

      expect(result.text).toBe('I want apple');
      expect(result.words).toEqual(['I', 'want', 'apple']);
    });

    it('should handle empty message', async () => {
      const result = parseMessageWithSymbols('');

      expect(result.text).toBe('');
      expect(result.words).toEqual([]);
      expect(result.symbols).toEqual([]);
    });
  });

  describe('alignWords', () => {
    it('should align identical words (cognates)', async () => {
      const originalWords = ['I', 'want', 'apple', 'juice'];
      const translatedWords = ['Yo', 'quiero', 'apple', 'jugo'];

      const alignment = alignWords(originalWords, translatedWords);

      expect(alignment).toHaveLength(4);

      // Check apple alignment (identical word)
      const appleAlignment = alignment.find((a) => a.originalWord === 'apple');
      expect(appleAlignment).toBeDefined();
      expect(appleAlignment?.translatedWord).toBe('apple');
      expect(appleAlignment?.originalIndex).toBe(2);
      expect(appleAlignment?.translatedIndex).toBe(2);
    });

    it('should use positional alignment for non-matching words', async () => {
      const originalWords = ['I', 'want', 'apple'];
      const translatedWords = ['Yo', 'quiero', 'manzana'];

      const alignment = alignWords(originalWords, translatedWords);

      expect(alignment).toHaveLength(3);

      // First word should align with first word
      expect(alignment[0].originalWord).toBe('I');
      expect(alignment[0].translatedWord).toBe('Yo');

      // Last word should align with last word
      expect(alignment[2].originalWord).toBe('apple');
      expect(alignment[2].translatedWord).toBe('manzana');
    });

    it('should handle different length sentences', async () => {
      const originalWords = ['Hello', 'world'];
      const translatedWords = ['Hola', 'mundo', 'amigo'];

      const alignment = alignWords(originalWords, translatedWords);

      expect(alignment.length).toBeGreaterThan(0);
      // All original words should be aligned
      expect(alignment.filter((a) => a.originalIndex !== undefined)).toHaveLength(2);
    });

    it('should handle numbers and punctuation', async () => {
      const originalWords = ['I', 'want', '2', 'apples'];
      const translatedWords = ['Quiero', '2', 'manzanas'];

      const alignment = alignWords(originalWords, translatedWords);

      // Number '2' should align exactly
      const numberAlignment = alignment.find((a) => a.originalWord === '2');
      expect(numberAlignment).toBeDefined();
      expect(numberAlignment?.translatedWord).toBe('2');
    });
  });

  describe('reattachSymbols', () => {
    it('should reattach symbols to translated words based on alignment', async () => {
      const originalParsed: ParsedMessage = {
        text: 'I want apple',
        words: ['I', 'want', 'apple'],
        symbols: [
          {
            symbolRef: '[widgit]/food/apple.png',
            wordIndex: 2,
            originalWord: 'apple',
            startPos: 7,
            endPos: 12,
          },
        ],
      };

      const alignment = [
        {
          originalWord: 'I',
          translatedWord: 'Yo',
          originalIndex: 0,
          translatedIndex: 0,
        },
        {
          originalWord: 'want',
          translatedWord: 'quiero',
          originalIndex: 1,
          translatedIndex: 1,
        },
        {
          originalWord: 'apple',
          translatedWord: 'manzana',
          originalIndex: 2,
          translatedIndex: 2,
        },
      ];

      const result = reattachSymbols('Yo quiero manzana', originalParsed, alignment);

      expect(result.text).toBe('Yo quiero manzana');
      expect(result.richTextSymbols).toHaveLength(1);
      expect(result.richTextSymbols[0].text).toBe('manzana');
      expect(result.richTextSymbols[0].image).toBe('[widgit]/food/apple.png');
    });

    it('should handle multiple symbols', async () => {
      const originalParsed: ParsedMessage = {
        text: 'I want apple juice',
        words: ['I', 'want', 'apple', 'juice'],
        symbols: [
          {
            symbolRef: '[widgit]/food/apple.png',
            wordIndex: 2,
            originalWord: 'apple',
            startPos: 7,
            endPos: 12,
          },
          {
            symbolRef: '[widgit]/food/juice.png',
            wordIndex: 3,
            originalWord: 'juice',
            startPos: 13,
            endPos: 18,
          },
        ],
      };

      const alignment = [
        {
          originalWord: 'I',
          translatedWord: 'Yo',
          originalIndex: 0,
          translatedIndex: 0,
        },
        {
          originalWord: 'want',
          translatedWord: 'quiero',
          originalIndex: 1,
          translatedIndex: 1,
        },
        {
          originalWord: 'apple',
          translatedWord: 'manzana',
          originalIndex: 2,
          translatedIndex: 2,
        },
        {
          originalWord: 'juice',
          translatedWord: 'jugo',
          originalIndex: 3,
          translatedIndex: 3,
        },
      ];

      const result = reattachSymbols('Yo quiero manzana jugo', originalParsed, alignment);

      expect(result.richTextSymbols).toHaveLength(2);
      expect(result.richTextSymbols[0].text).toBe('manzana');
      expect(result.richTextSymbols[1].text).toBe('jugo');
    });

    it('should fallback to original word if alignment not found', async () => {
      const originalParsed: ParsedMessage = {
        text: 'I want apple',
        words: ['I', 'want', 'apple'],
        symbols: [
          {
            symbolRef: '[widgit]/food/apple.png',
            wordIndex: 2,
            originalWord: 'apple',
            startPos: 7,
            endPos: 12,
          },
        ],
      };

      const alignment = [
        {
          originalWord: 'I',
          translatedWord: 'Yo',
          originalIndex: 0,
          translatedIndex: 0,
        },
        {
          originalWord: 'want',
          translatedWord: 'quiero',
          originalIndex: 1,
          translatedIndex: 1,
        },
        // No alignment for 'apple'
      ];

      const result = reattachSymbols('Yo quiero fruta', originalParsed, alignment);

      expect(result.richTextSymbols).toHaveLength(1);
      expect(result.richTextSymbols[0].text).toBe('apple'); // Fallback to original
      expect(result.richTextSymbols[0].image).toBe('[widgit]/food/apple.png');
    });
  });

  describe('translateWithSymbols (integration)', () => {
    it('should complete the full pipeline', async () => {
      const originalMessage = 'I want apple juice';
      const translatedText = 'Yo quiero jugo de manzana';
      const richTextSymbols = [
        { text: 'apple', image: '[widgit]/food/apple.png' },
        { text: 'juice', image: '[widgit]/food/juice.png' },
      ];

      const result = translateWithSymbols(originalMessage, translatedText, richTextSymbols);

      expect(result.text).toBe('Yo quiero jugo de manzana');
      expect(result.richTextSymbols).toHaveLength(2);

      // Symbols should be reattached to translated words
      const appleSymbol = result.richTextSymbols.find((s) => s.image?.includes('apple'));
      expect(appleSymbol).toBeDefined();
      expect(appleSymbol?.text).not.toBe('apple'); // Should be a translated word

      const juiceSymbol = result.richTextSymbols.find((s) => s.image?.includes('juice'));
      expect(juiceSymbol).toBeDefined();
    });

    it('should handle messages without symbols', async () => {
      const result = translateWithSymbols('Hello', 'Hola');

      expect(result.text).toBe('Hola');
      expect(result.richTextSymbols).toEqual([]);
    });

    it('should handle English to Spanish translation', async () => {
      const originalMessage = 'I want water';
      const translatedText = 'Yo quiero agua';
      const richTextSymbols = [{ text: 'water', image: '[widgit]/food/water.png' }];

      const result = translateWithSymbols(originalMessage, translatedText, richTextSymbols);

      expect(result.text).toBe('Yo quiero agua');
      expect(result.richTextSymbols).toHaveLength(1);
      expect(result.richTextSymbols[0].image).toBe('[widgit]/food/water.png');
      // The symbol should be attached to 'agua' (the translation of 'water')
      expect(result.richTextSymbols[0].text).toBeTruthy();
    });

    it('should handle symbol library references', async () => {
      const originalMessage = 'home';
      const translatedText = 'casa';
      const richTextSymbols = [{ text: 'home', image: '[widgit]/places/home.png' }];

      const result = translateWithSymbols(originalMessage, translatedText, richTextSymbols);

      expect(result.richTextSymbols[0].image).toBe('[widgit]/places/home.png');
    });
  });

  describe('extractSymbolsFromButton', () => {
    it('should extract symbols from semanticAction.richText.symbols', async () => {
      const button = {
        label: 'apple',
        message: 'I want apple',
        semanticAction: {
          richText: {
            text: 'I want apple',
            symbols: [{ text: 'apple', image: '[widgit]/food/apple.png' }],
          },
        },
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toEqual([{ text: 'apple', image: '[widgit]/food/apple.png' }]);
    });

    it('should extract symbols from symbolLibrary and symbolPath', async () => {
      const button = {
        label: 'apple',
        message: 'apple',
        symbolLibrary: 'widgit',
        symbolPath: '/food/apple.png',
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toBeDefined();
      expect(symbols).toHaveLength(1);
      expect(symbols?.[0].text).toBe('apple');
      expect(symbols?.[0].image).toBe('[widgit]/food/apple.png');
    });

    it('should extract symbols from image field if it is a symbol reference', async () => {
      const button = {
        label: 'home',
        message: 'home',
        image: '[widgit]/places/home.png',
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toBeDefined();
      expect(symbols).toHaveLength(1);
      expect(symbols?.[0].text).toBe('home');
      expect(symbols?.[0].image).toBe('[widgit]/places/home.png');
    });

    it('should return undefined for regular image paths (not symbol references)', async () => {
      const button = {
        label: 'photo',
        message: 'photo',
        image: 'images/photo.png',
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toBeUndefined();
    });

    it('should return undefined for buttons without symbols', async () => {
      const button = {
        label: 'hello',
        message: 'hello',
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toBeUndefined();
    });

    it('should handle empty label and message', async () => {
      const button = {
        symbolLibrary: 'widgit',
        symbolPath: '/food/apple.png',
      };

      const symbols = extractSymbolsFromButton(button);

      expect(symbols).toBeUndefined();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle AAC gridset button translation', async () => {
      // Simulate a real AAC button with a symbol
      const button = {
        id: 'btn1',
        label: 'apple',
        message: 'I want apple',
        semanticAction: {
          richText: {
            text: 'I want apple',
            symbols: [{ text: 'apple', image: '[widgit]/food/apple.png' }],
          },
        },
      };

      const originalMessage = button.message;
      const translatedText = 'Yo quiero manzana';
      const symbols = extractSymbolsFromButton(button);

      const result = translateWithSymbols(originalMessage, translatedText, symbols);

      expect(result.text).toBe('Yo quiero manzana');
      expect(result.richTextSymbols).toHaveLength(1);
      expect(result.richTextSymbols[0].image).toBe('[widgit]/food/apple.png');
      // Symbol should be attached to the translation of 'apple' (which is 'manzana')
      expect(['manzana', 'quiero']).toContain(result.richTextSymbols[0].text);
    });

    it('should handle multi-word phrases with symbols', async () => {
      const originalMessage = 'I want to go home';
      const translatedText = 'Quiero ir a casa';
      const richTextSymbols = [{ text: 'home', image: '[widgit]/places/home.png' }];

      const result = translateWithSymbols(originalMessage, translatedText, richTextSymbols);

      expect(result.richTextSymbols).toHaveLength(1);
      expect(result.richTextSymbols[0].image).toBe('[widgit]/places/home.png');
    });

    it('should preserve all symbols in a sentence with multiple symbols', async () => {
      const originalMessage = 'I eat apple and banana';
      const translatedText = 'Como manzana y plátano';
      const richTextSymbols = [
        { text: 'apple', image: '[widgit]/food/apple.png' },
        { text: 'banana', image: '[widgit]/food/banana.png' },
      ];

      const result = translateWithSymbols(originalMessage, translatedText, richTextSymbols);

      expect(result.richTextSymbols).toHaveLength(2);
      expect(result.richTextSymbols.some((s) => s.image?.includes('apple'))).toBe(true);
      expect(result.richTextSymbols.some((s) => s.image?.includes('banana'))).toBe(true);
    });
  });
});
