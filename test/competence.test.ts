import { describe, expect, it } from '@jest/globals';
import {
  analyzeTimeline,
  classifyInflection,
  getClosedClassSet,
  lexicalDiversity,
  morphologicalDiversity,
  movingAverageTTR,
  spellingValidity,
  summarizeActivity,
  syntacticDiversity,
  tokenize,
  type CompetenceUtterance,
} from '../src/utilities/analytics/competence';

describe('competence / tokenize', () => {
  it('lowercases and keeps apostrophes inside words', () => {
    expect(tokenize("I DON'T want it")).toEqual(['i', "don't", 'want', 'it']);
  });

  it('drops punctuation but keeps accented characters', () => {
    expect(tokenize('Hallo, wereld! Café — och "ja".')).toEqual([
      'hallo',
      'wereld',
      'café',
      'och',
      'ja',
    ]);
  });

  it('returns [] for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   !!! ')).toEqual([]);
  });
});

describe('competence / movingAverageTTR (MATTR)', () => {
  it('returns nulls for an empty stream', () => {
    const r = movingAverageTTR([], 30);
    expect(r.median).toBeNull();
    expect(r.nWindows).toBe(0);
  });

  it('treats a short sample as a single window TTR', () => {
    const r = movingAverageTTR(['a', 'b', 'c'], 30);
    // 3 unique / 3 = 1.0
    expect(r.median).toBeCloseTo(1.0);
    expect(r.nWindows).toBe(1);
  });

  it('gives a higher diversity for a varied stream than a repetitive one', () => {
    const varied = (
      'the quick brown fox jumps over lazy dog cat hat bat ' +
      'sun moon star tree leaf rock river hill cloud rain wind'
    ).split(/\s+/);
    const repetitive = Array.from({ length: 40 }, () => 'yes');
    expect(lexicalDiversity(varied, 30).median!).toBeGreaterThan(
      lexicalDiversity(repetitive, 30).median!
    );
    // Repetitive single-word stream has TTR ~ 1/30 within windows.
    expect(lexicalDiversity(repetitive, 30).median).toBeCloseTo(1 / 30, 5);
  });

  it('MATTR is sample-length insensitive (more repetition does not inflate it)', () => {
    const base = 'a b c d e f g h i j k l m n o'.split(/\s+/); // 15 unique
    const doubled = [...base, ...base]; // same words repeated
    // With window 15, repeated unique set still yields TTR 1.0 per window.
    expect(movingAverageTTR(base, 15).median).toBeCloseTo(1.0);
    expect(movingAverageTTR(doubled, 15).median).toBeCloseTo(1.0);
  });
});

describe('competence / syntacticDiversity (MA-UPC-TWR-30)', () => {
  it('returns null median for a language with no closed-class set', () => {
    const r = syntacticDiversity(['and', 'but'], { lang: 'xx', windowSize: 30 });
    expect(r.median).toBeNull();
  });

  it('detects prepositions and conjunctions in English', () => {
    expect(getClosedClassSet('en-GB')!.has('because')).toBe(true);
    expect(getClosedClassSet('en')!.has('under')).toBe(true);
    expect(getClosedClassSet('en')!.has('banana')).toBe(false);
  });

  it('scores a window rich in varied connectors higher than one using only "and"', () => {
    const rich =
      'I went to the shop and bought milk but the milk was off so I went back because it was bad although they refunded me'.split(
        /\s+/
      );
    const onlyAnd = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 'and' : 'cat'));
    const r1 = syntacticDiversity(rich, { lang: 'en', windowSize: 15 });
    const r2 = syntacticDiversity(onlyAnd, { lang: 'en', windowSize: 15 });
    expect(r1.median!).toBeGreaterThan(r2.median!);
    // Only "and" repeated ~8x per window -> distinct/total = 1/8.
    expect(r2.median!).toBeLessThan(0.2);
  });

  it('supports Dutch closed-class set', () => {
    expect(getClosedClassSet('nl-BE')!.has('omdat')).toBe(true);
    expect(getClosedClassSet('nl')!.has('onder')).toBe(true);
  });
});

describe('competence / morphologicalDiversity (proxy)', () => {
  it('returns null for non-English (documented limitation)', () => {
    const r = morphologicalDiversity(['lopen', 'gelopen'], { lang: 'nl', windowSize: 5 });
    expect(r.median).toBeNull();
  });

  it('classifies obvious inflections', () => {
    expect(classifyInflection('running')).toBe('progressive');
    expect(classifyInflection('jumped')).toBe('past');
    expect(classifyInflection('biggest')).toBe('superlative');
    expect(classifyInflection('happily')).toBe('adverb');
    expect(classifyInflection('cats')).toBe('plural');
    expect(classifyInflection("dad's")).toBe('possessive');
  });

  it('keeps guarded base words as base', () => {
    expect(classifyInflection('is')).toBe('base');
    expect(classifyInflection('ring')).toBe('base');
    expect(classifyInflection('best')).toBe('base');
  });

  it('scores a stream with varied morphology above a base-only stream', () => {
    const morphed = 'cats running jumped faster biggest quickly dogs walked eating smaller'.split(
      /\s+/
    );
    const base = 'cat run jump fast big quick dog walk eat small'.split(/\s+/);
    const r1 = morphologicalDiversity(morphed, { lang: 'en', windowSize: 10 });
    // base-only stream has no inflected words -> null
    const r2 = morphologicalDiversity(base, { lang: 'en', windowSize: 10 });
    expect(r1.median).not.toBeNull();
    expect(r2.median).toBeNull();
  });
});

describe('competence / spellingValidity', () => {
  it('returns null without a dictionary', () => {
    expect(spellingValidity(['hello', 'wrld'])).toBeNull();
  });

  it('counts dictionary hits over unique alphabetic words', () => {
    const dict = new Set(['hello', 'world']);
    // unique alphabetic words: hello, world, xyz -> 2/3
    expect(spellingValidity(['hello', 'world', 'xyz', 'hello'], dict)).toBeCloseTo(2 / 3, 5);
  });

  it('ignores non-alphabetic tokens', () => {
    const dict = new Set(['hello']);
    expect(spellingValidity(['hello', '12', 'a'], dict)).toBeCloseTo(1.0, 5); // only "hello" checked
  });
});

describe('competence / summarizeActivity', () => {
  it('counts utterances, words, active days and words per utterance', () => {
    const DAY = 86_400_000;
    const utts: CompetenceUtterance[] = [
      { text: 'hello world', timestampMs: 0 },
      { text: 'good morning', timestampMs: DAY }, // next day
      { text: 'bye', timestampMs: DAY + 1000 }, // same day
    ];
    const a = summarizeActivity(utts);
    expect(a.utterances).toBe(3);
    expect(a.words).toBe(5); // hello world good morning bye
    expect(a.activeDays).toBe(2);
    expect(a.wordsPerUtterance.median).toBe(2);
    expect(a.wordsPerUtterance.n).toBe(3);
  });
});

describe('competence / analyzeTimeline', () => {
  const DAY = 86_400_000;

  function buildCorpus(): CompetenceUtterance[] {
    const now = Date.now();
    const utts: CompetenceUtterance[] = [];
    // Two months ago: simple, repetitive vocabulary.
    const simpleMonth = now - 60 * DAY;
    for (let i = 0; i < 30; i++) {
      utts.push({ text: 'I want it yes', timestampMs: simpleMonth + i * 1000 });
    }
    // This month: richer, more syntactically complex vocabulary.
    for (let i = 0; i < 30; i++) {
      utts.push({
        text: 'I think that we should go to the park because the weather is lovely although it might rain',
        timestampMs: now - i * 60_000,
      });
    }
    return utts;
  }

  it('bins utterances by month and computes per-bin metrics', () => {
    const report = analyzeTimeline(buildCorpus(), {
      months: 3,
      windowSize: 15,
      minWordsPerMonth: 1,
      lang: 'en',
    });
    expect(report.schema).toBe('aac-competence-report/v1');
    expect(report.timeline.length).toBeGreaterThanOrEqual(1);
    for (const bin of report.timeline) {
      expect(bin.suppressed).toBe(false);
      expect(bin.lexicalDiversity.median).not.toBeNull();
    }
  });

  it('flags sparse months as suppressed and omits their diversity figures', () => {
    const now = Date.now();
    const report = analyzeTimeline([{ text: 'hi', timestampMs: now - 40 * DAY }], {
      months: 3,
      minWordsPerMonth: 150,
      lang: 'en',
    });
    const suppressed = report.timeline.filter((b) => b.suppressed);
    expect(suppressed.length).toBeGreaterThan(0);
    expect(suppressed[0].lexicalDiversity.median).toBeNull();
    expect(suppressed[0].suppressReason).toContain('fewer than');
  });

  it('emits no raw text or word lists anywhere in the report', () => {
    const report = analyzeTimeline(buildCorpus(), {
      months: 3,
      windowSize: 15,
      minWordsPerMonth: 1,
      lang: 'en',
    });
    const json = JSON.stringify(report);
    expect(json).not.toContain('hello');
    expect(json).not.toContain('because the weather');
    expect(report.privacy.rawUtterancesIncluded).toBe(false);
    expect(report.privacy.wordListsIncluded).toBe(false);
    expect(report.privacy.fringeWordFrequencyIncluded).toBe(false);
  });

  it('trends lexical diversity upward for an improving corpus', () => {
    const report = analyzeTimeline(buildCorpus(), {
      months: 3,
      windowSize: 15,
      minWordsPerMonth: 1,
      lang: 'en',
    });
    expect(report.trend.metric).toBe('lexicalDiversity.median');
    expect(report.trend.direction).toBe('up');
    expect(report.trend.delta!).toBeGreaterThan(0);
  });

  it('respects the trailing-months window (drops old utterances)', () => {
    const now = Date.now();
    const report = analyzeTimeline(
      [{ text: 'very old utterance here', timestampMs: now - 400 * DAY }],
      { months: 3, minWordsPerMonth: 1, lang: 'en' }
    );
    expect(report.timeline.length).toBe(0);
    expect(report.overall.totalUtterances).toBe(0);
  });
});
