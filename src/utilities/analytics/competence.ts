/**
 * Linguistic Competence Metrics
 *
 * Privacy-preserving analysis of AAC *spoken output* (phrase history), based on:
 *   - Niemeijer, Sheldon & Hillary Zisk (2025), "Measuring AAC user linguistic
 *     competence: A novel approach", AssistiveWare (Communication Matters handout).
 *   - Frisch, Wade et al. (2026), "It's Complicated: On the Design and Evaluation
 *     of AI-Powered AAC Interfaces", arXiv:2606.24854.
 *
 * DESIGN (read me):
 *   - **Source-agnostic.** The only input is `{ text, timestampMs }[]`. It does
 *     not know or care whether the speech history came from Grid 3, Snap,
 *     TouchChat, OBF/OBFL logs, or anything else. See `historyEntriesToCompetence*
 *     Utterances` (in history.ts) to adapt any `HistoryEntry[]` source.
 *   - **Language-agnostic core.** This module contains NO word lists. Language-
 *     specific resources (a closed-class word set, an inflection classifier) are
 *     INJECTED via `LanguageResources`. When a resource is missing for a
 *     language, the affected measure is reported as `unavailable` with a reason
 *     and a warning is raised — never silently wrong.
 *   - **Pure / no I/O.** No filesystem, no platform APIs. Runs anywhere (browser
 *     included) and emits only aggregate statistics (never the raw text).
 *
 * The four dimensions of linguistic competence (Light, 1989) and the measures we
 * use for each, following the AssistiveWare findings:
 *
 *   Semantic      -> MATTR-30 lexical diversity             (always available)
 *   Syntactic     -> preposition/conjunction diversity        (needs closedClassWords)
 *   Morphological -> inflected-form diversity                 (needs classifyInflection)
 *   Phonological  -> proportion of unique words in a dictionary (needs a dictionary)
 *
 * All diversity measures use 30-word moving-average windows (Covington & McFall,
 * 2010), making them sample-length independent and usable for the tiny, highly
 * variable samples typical of AAC. MLU is intentionally NOT a headline (it
 * conflates linguistic/operational/strategic/social competence in AAC); it is
 * reported only as a distribution.
 */

import type { VocabularySummary } from './metrics/vocabularyDump';

/** A single spoken utterance with a production timestamp (epoch ms). */
export interface CompetenceUtterance {
  text: string;
  timestampMs: number;
}

/** A tokenised word stream produced in chronological order. */
export type WordStream = string[];

/** Coarse inflection category used by the (injected) morphology classifier. */
export type InflectionCategory =
  | 'base'
  | 'plural'
  | 'possessive'
  | 'past'
  | 'progressive'
  | 'comparative'
  | 'superlative'
  | 'adverb';

/**
 * Language-specific resources, injected by the caller. Providing none leaves the
 * language-specific measures unavailable (with explicit warnings) — the semantic
 * measure still works for any language.
 */
export interface LanguageResources {
  /** Closed-class words (prepositions, conjunctions, ...) for syntactic diversity. */
  closedClassWords?: Set<string>;
  /** Maps a lowercased word to an inflection category for morphological diversity. */
  classifyInflection?: (word: string) => InflectionCategory;
}

export interface DiversityOptions {
  /** Moving-average window size in words. The papers use 30. */
  windowSize?: number;
  /** Closed-class word set (for the syntactic measure). */
  closedClassWords?: Set<string>;
  /** Inflection classifier (for the morphological measure). */
  classifyInflection?: (word: string) => InflectionCategory;
}

export interface DiversityResult {
  /** Median of the per-window values (the headline figure, per the paper). */
  median: number | null;
  mean: number | null;
  /** Number of windows that contributed a value (after any skipping). */
  nWindows: number;
  /** The window size used. */
  windowSize: number;
  /** Present when the measure could not be computed (e.g. missing language data). */
  unavailable?: string;
}

/* ------------------------------------------------------------------ *
 * Small statistics helpers
 * ------------------------------------------------------------------ */

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/* ------------------------------------------------------------------ *
 * Tokenisation
 * ------------------------------------------------------------------ */

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

/**
 * Tokenise raw text into a lowercased word stream.
 * Keeps intra-word apostrophes (don't, children's) but drops leading/trailing
 * punctuation and pure whitespace. Accented characters are preserved (\p{L}).
 */
export function tokenize(text: string): WordStream {
  if (!text) return [];
  const out: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    let tok = m[0].toLowerCase();
    tok = tok.replace(/^['’]+|['’]+$/g, '');
    if (tok.length > 0) out.push(tok);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Semantic competence: lexical diversity (MATTR-30)  — always available
 * ------------------------------------------------------------------ */

function segmentTTR(segment: WordStream): number {
  if (segment.length === 0) return 0;
  return new Set(segment).size / segment.length;
}

/**
 * Moving-Average Type-Token Ratio (Covington & McFall, 2010).
 *
 * Slides a fixed-size window across the word stream and computes the TTR for
 * each window. The median across windows is sample-length independent, which is
 * exactly why it is preferred over plain TTR for highly variable AAC samples.
 */
export function movingAverageTTR(words: WordStream, windowSize = 30): DiversityResult {
  const n = words.length;
  const w = Math.max(1, Math.floor(windowSize));
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  if (n < w) {
    const v = segmentTTR(words);
    return { median: v, mean: v, nWindows: 1, windowSize: w };
  }

  const values: number[] = [];
  for (let i = 0; i <= n - w; i++) {
    values.push(segmentTTR(words.slice(i, i + w)));
  }
  return {
    median: median(values),
    mean: mean(values),
    nWindows: values.length,
    windowSize: w,
  };
}

/** Convenience: MATTR-30 lexical diversity (the semantic headline). */
export function lexicalDiversity(words: WordStream, windowSize = 30): DiversityResult {
  return movingAverageTTR(words, windowSize);
}

/* ------------------------------------------------------------------ *
 * Syntactic competence: closed-class diversity (MA-UPC-TWR-30)
 * ------------------------------------------------------------------ */

/**
 * Closed-class diversity (generalises AssistiveWare's MA-UPC-TWR-30).
 *
 * For each window, compute the type-token ratio restricted to the supplied
 * closed-class words (prepositions + conjunctions in the original paper). Windows
 * containing none are skipped. The caller supplies the set via
 * `closedClassWords`, so this works for any language without hardcoding here.
 */
export function syntacticDiversity(
  words: WordStream,
  options: DiversityOptions = {}
): DiversityResult {
  const w = Math.max(1, Math.floor(options.windowSize ?? 30));
  const closed = options.closedClassWords;
  if (!closed || closed.size === 0) {
    return {
      median: null,
      mean: null,
      nWindows: 0,
      windowSize: w,
      unavailable: 'no closed-class word data provided for this language',
    };
  }

  const n = words.length;
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  const values: number[] = [];
  const scan = (segment: WordStream): void => {
    const cc = segment.filter((tok) => closed.has(tok));
    if (cc.length > 0) {
      values.push(new Set(cc).size / cc.length);
    }
  };

  if (n < w) {
    scan(words);
  } else {
    for (let i = 0; i <= n - w; i++) {
      scan(words.slice(i, i + w));
    }
  }

  if (values.length === 0) {
    return {
      median: null,
      mean: null,
      nWindows: 0,
      windowSize: w,
      unavailable: 'no closed-class words found in the sample',
    };
  }
  return {
    median: median(values),
    mean: mean(values),
    nWindows: values.length,
    windowSize: w,
  };
}

/* ------------------------------------------------------------------ *
 * Morphological competence: inflected-form diversity (MA-UMORPH-TLWR-30 proxy)
 * ------------------------------------------------------------------ */

/**
 * Morphological diversity (proxy for MA-UMORPH-TLWR-30).
 *
 * Within each window, words the supplied classifier marks as inflected (any
 * category other than "base") contribute their surface forms to a type-token
 * ratio. Windows with no inflected words are skipped. The classifier is injected
 * (`classifyInflection`) so the heuristic lives with the caller, per language.
 *
 * Caveat (per AssistiveWare): for symbol-supported AAC, pre-stored morphology
 * buttons ("finished", "is", ...) heavily affect this measure — interpret trends
 * rather than absolutes.
 */
export function morphologicalDiversity(
  words: WordStream,
  options: DiversityOptions = {}
): DiversityResult {
  const w = Math.max(1, Math.floor(options.windowSize ?? 30));
  const classify = options.classifyInflection;
  if (!classify) {
    return {
      median: null,
      mean: null,
      nWindows: 0,
      windowSize: w,
      unavailable: 'no inflection classifier provided for this language',
    };
  }

  const n = words.length;
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  const values: number[] = [];
  const scan = (segment: WordStream): void => {
    const inflected = segment.filter((tok) => classify(tok) !== 'base');
    if (inflected.length > 0) {
      values.push(new Set(inflected).size / inflected.length);
    }
  };

  if (n < w) {
    scan(words);
  } else {
    for (let i = 0; i <= n - w; i++) {
      scan(words.slice(i, i + w));
    }
  }

  if (values.length === 0) {
    return {
      median: null,
      mean: null,
      nWindows: 0,
      windowSize: w,
      unavailable: 'no inflected word forms found in the sample',
    };
  }
  return {
    median: median(values),
    mean: mean(values),
    nWindows: values.length,
    windowSize: w,
  };
}

/* ------------------------------------------------------------------ *
 * Phonological competence: spelling validity (optional, weak)
 * ------------------------------------------------------------------ */

/**
 * Proportion of unique alphabetic words present in the supplied dictionary.
 * Unique words only, so it is not skewed by repetition or repeated misspellings.
 * Returns null (unavailable) if no dictionary is provided.
 */
export function spellingValidity(words: WordStream, dictionary?: Set<string>): number | null {
  if (!dictionary || dictionary.size === 0) return null;
  const unique = new Set(words);
  let checked = 0;
  let correct = 0;
  for (const tok of unique) {
    if (!/^\p{L}{2,}$/u.test(tok)) continue;
    checked++;
    if (dictionary.has(tok)) correct++;
  }
  return checked === 0 ? null : correct / checked;
}

/* ------------------------------------------------------------------ *
 * Lexical richness indices (Brunet's W, Honoré's R)
 *
 * Total-sample type-token measures that complement MATTR: they do not depend
 * on a moving window, so they behave differently on small/variable AAC
 * samples. Both are pure functions of the token-frequency distribution —
 * language-agnostic, no word lists needed. Used in DEPAC's lexical-complexity
 * feature set (Tasnim et al., 2022); lower W / higher R = richer vocabulary.
 * ------------------------------------------------------------------ */

export interface LexicalRichness {
  /** Brunet's index W = N · V^(-0.165). Range ~10–30; LOWER = richer. */
  brunetsW: number | null;
  /** Honoré's statistic R = 100·ln N / (1 − V1/V). HIGHER = richer. */
  honoresR: number | null;
  /** Hapax legomena (words used exactly once) — count only. */
  hapax: number;
  /** Number of distinct words (V). */
  types: number;
  /** Number of tokens (N). */
  tokens: number;
}

export function lexicalRichness(words: WordStream): LexicalRichness {
  const n = words.length;
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const v = freq.size;
  let v1 = 0;
  for (const c of freq.values()) if (c === 1) v1++;

  const brunetsW = n > 0 && v > 0 ? n * Math.pow(v, -0.165) : null;
  // Honoré's R is undefined when every word is a hapax (V1 = V) or N <= 1.
  const honoresR = n > 1 && v > 0 && v1 < v ? (100 * Math.log(n)) / (1 - v1 / v) : null;

  return { brunetsW, honoresR, hapax: v1, types: v, tokens: n };
}

/* ------------------------------------------------------------------ *
 * Activity / engagement statistics
 * ------------------------------------------------------------------ */

export interface DistributionStats {
  median: number | null;
  mean: number | null;
  p25: number | null;
  p75: number | null;
  n: number;
}

export interface ActivityStats {
  utterances: number;
  words: number;
  /** Distinct tokens — vocabulary breadth (count only, never the words). */
  uniqueWords: number;
  activeDays: number;
  wordsPerUtterance: DistributionStats;
}

function distribution(values: number[]): DistributionStats {
  return {
    median: median(values),
    mean: mean(values),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    n: values.length,
  };
}

/** Compute engagement/activity stats for a set of utterances. */
export function summarizeActivity(utterances: CompetenceUtterance[]): ActivityStats {
  const days = new Set<number>();
  let totalWords = 0;
  const wpu: number[] = [];
  for (const u of utterances) {
    const toks = tokenize(u.text);
    totalWords += toks.length;
    wpu.push(toks.length);
    const day = Math.floor(u.timestampMs / 86_400_000);
    days.add(day);
  }
  return {
    utterances: utterances.length,
    words: totalWords,
    uniqueWords: 0,
    activeDays: days.size,
    wordsPerUtterance: distribution(wpu),
  };
}

/* ------------------------------------------------------------------ *
 * Timeline analysis (the longitudinal engine)
 * ------------------------------------------------------------------ */

export interface MonthBin {
  /** Calendar month in local time, "YYYY-MM". */
  month: string;
  utterances: number;
  words: number;
  uniqueWords: number;
  activeDays: number;
  wordsPerUtterance: DistributionStats;
  /** Semantic — the headline measure. */
  lexicalDiversity: DiversityResult;
  /** Syntactic. null/unavailable when no closed-class data for the language. */
  syntacticDiversity: DiversityResult;
  /** Morphological (proxy). null/unavailable when no classifier for the language. */
  morphologicalDiversity: DiversityResult;
  /** Phonological — only when a dictionary is supplied. */
  spellingValidity: number | null;
  /** Lexical richness indices (Brunet's W, Honoré's R) — always available. */
  lexicalRichness: LexicalRichness;
  /** True when the month has too little data to trust the diversity figures. */
  suppressed: boolean;
  suppressReason: string | null;
}

export interface TrendResult {
  metric: string;
  /** Slope of the weighted linear regression, in metric units per month. */
  slopePerMonth: number | null;
  firstHalf: number | null;
  secondHalf: number | null;
  /** secondHalf - firstHalf. */
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

export interface DimensionSupport {
  available: boolean;
  reason?: string;
}

export interface PagesetSummary {
  label: string;
  gridsetIncluded: boolean;
  analysisVersion?: string;
  totalBoards: number;
  totalButtons: number;
  totalWords: number;
  grid: { rows: number; columns: number };
  effort: DistributionStats;
  hasDynamicPrediction: boolean;
  spellingEffort: { base: number | null; perLetter: number | null };
  /**
   * Counts-only vocabulary inventory (buttons, wordlists, prediction
   * dictionaries, smart-grammar word forms) — see dumpVocabulary().
   * Null/undefined when the caller did not compute it. Contains counts only.
   */
  vocabulary?: VocabularySummary | null;
  error?: string;
}

export interface UserSettingsSummary {
  startupGridSet: string | null;
  onlineAiToolsOptIn: boolean | null;
  accessMethods: string[];
  personalisation: {
    pronunciations: number;
    capitalisations: number;
    abbreviationExpansions: number;
    smallWords: number;
  };
}

export interface CompetenceReport {
  schema: string;
  generatedAt: string;
  privacy: {
    rawUtterancesIncluded: boolean;
    wordListsIncluded: boolean;
    fringeWordFrequencyIncluded: boolean;
    minAggregationWindowDays: number;
    notes: string[];
  };
  source: {
    platform: string;
    langCode?: string;
    userLabel?: string;
    dbPathIncluded: boolean;
  };
  config: {
    months: number;
    windowSize: number;
    lang: string;
    minWordsPerMonth: number;
    dictionaryProvided: boolean;
  };
  overall: {
    windowStart: string;
    windowEnd: string;
    totalUtterances: number;
    totalWords: number;
    monthsCovered: number;
    monthsSuppressed: number;
  };
  timeline: MonthBin[];
  trend: TrendResult;
  /** Per-dimension availability for the detected language (no silent degradation). */
  support: {
    lang: string;
    semantic: DimensionSupport;
    syntactic: DimensionSupport;
    morphological: DimensionSupport;
    phonological: DimensionSupport;
  };
  /** Human-readable notes about anything skipped or approximate. */
  warnings: string[];
  /** Structural metrics for the user's default gridset (null if unavailable). */
  pageset?: PagesetSummary | null;
  /** System-configuration context (access method, AI opt-in, startup gridset). */
  userSettings?: UserSettingsSummary | null;
}

export interface TimelineOptions {
  /** How many trailing months to analyse. Default 12. */
  months?: number;
  /** Moving-average window. Default 30. */
  windowSize?: number;
  /** Language code. Default "en". Used for reporting only. */
  lang?: string;
  /** Months with fewer than this many words are flagged suppressed. Default 150. */
  minWordsPerMonth?: number;
  /** Optional dictionary Set for the spelling measure. */
  dictionary?: Set<string>;
  /** Language-specific resources (closed-class words, inflection classifier). */
  resources?: LanguageResources;
  /** Epoch ms for "now". Defaults to Date.now(). Mainly for tests. */
  now?: number;
  /** Platform label for the report. Default "Grid3". */
  platform?: string;
  userLabel?: string;
  langCode?: string;
  dbPathIncluded?: boolean;
}

function monthKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function weightedSlope(points: Array<{ x: number; y: number; w: number }>): number | null {
  const usable = points.filter((p) => p.y !== null && isFinite(p.y));
  if (usable.length < 2) return null;
  let sw = 0;
  let swx = 0;
  let swy = 0;
  let swxx = 0;
  let swxy = 0;
  for (const p of usable) {
    const wgt = Math.max(p.w, 1);
    sw += wgt;
    swx += wgt * p.x;
    swy += wgt * p.y;
    swxx += wgt * p.x * p.x;
    swxy += wgt * p.x * p.y;
  }
  const denom = sw * swxx - swx * swx;
  if (denom === 0) return null;
  return (sw * swxy - swx * swy) / denom;
}

/**
 * Analyse a corpus of utterances as a longitudinal competence report.
 *
 * Utterances are filtered to the trailing `months` window, binned by calendar
 * month, and each bin is scored on the four competence dimensions plus activity.
 * Language-specific measures require matching `resources`; missing resources are
 * reported under `support` and `warnings` rather than silently dropped.
 *
 * No raw text, word list, or fringe-vocabulary frequency is included in the
 * returned report — only aggregate statistics.
 */
export function analyzeTimeline(
  utterances: CompetenceUtterance[],
  options: TimelineOptions = {}
): CompetenceReport {
  const months = Math.max(1, Math.floor(options.months ?? 12));
  const windowSize = Math.max(1, Math.floor(options.windowSize ?? 30));
  const lang = options.lang ?? 'en';
  const minWordsPerMonth = Math.max(0, Math.floor(options.minWordsPerMonth ?? 150));
  const dictionary = options.dictionary;
  const resources = options.resources ?? {};
  const now = options.now ?? Date.now();

  // ---- Filter to the trailing N months ----------------------------------
  const windowMs = months * 31 * 86_400_000;
  const windowStartMs = now - windowMs;
  const inWindow = utterances.filter(
    (u) =>
      u.timestampMs <= now && u.timestampMs > windowStartMs && u.text && u.text.trim().length > 0
  );

  // ---- Bin by month -----------------------------------------------------
  const bins = new Map<string, CompetenceUtterance[]>();
  for (const u of inWindow) {
    const key = monthKey(u.timestampMs);
    const arr = bins.get(key) ?? [];
    arr.push(u);
    bins.set(key, arr);
  }

  const sortedKeys = [...bins.keys()].sort();
  const timeline: MonthBin[] = [];

  for (const key of sortedKeys) {
    const monthUtts = (bins.get(key) ?? []).slice().sort((a, b) => a.timestampMs - b.timestampMs);

    const stream: WordStream = [];
    for (const u of monthUtts) stream.push(...tokenize(u.text));

    const activity = summarizeActivity(monthUtts);
    activity.uniqueWords = new Set(stream).size;

    const suppressed = stream.length < minWordsPerMonth;
    const suppressReason: string | null = suppressed
      ? `fewer than ${minWordsPerMonth} words (${stream.length})`
      : null;

    const lex = suppressed
      ? { median: null, mean: null, nWindows: 0, windowSize }
      : lexicalDiversity(stream, windowSize);
    const syn = suppressed
      ? { median: null, mean: null, nWindows: 0, windowSize }
      : syntacticDiversity(stream, { windowSize, closedClassWords: resources.closedClassWords });
    const mor = suppressed
      ? { median: null, mean: null, nWindows: 0, windowSize }
      : morphologicalDiversity(stream, {
          windowSize,
          classifyInflection: resources.classifyInflection,
        });
    const spell = suppressed ? null : spellingValidity(stream, dictionary);
    const rich: LexicalRichness = suppressed
      ? { brunetsW: null, honoresR: null, hapax: 0, types: 0, tokens: 0 }
      : lexicalRichness(stream);

    timeline.push({
      month: key,
      utterances: activity.utterances,
      words: activity.words,
      uniqueWords: activity.uniqueWords,
      activeDays: activity.activeDays,
      wordsPerUtterance: activity.wordsPerUtterance,
      lexicalDiversity: lex,
      syntacticDiversity: syn,
      morphologicalDiversity: mor,
      spellingValidity: spell,
      lexicalRichness: rich,
      suppressed,
      suppressReason,
    });
  }

  // ---- Support + warnings (no silent language degradation) --------------
  const warnings: string[] = [];
  const hasCC = !!resources.closedClassWords && resources.closedClassWords.size > 0;
  const hasMorph = !!resources.classifyInflection;
  if (!hasCC) {
    warnings.push(
      `Syntactic diversity unavailable: no closed-class word data for language '${lang}'. ` +
        `Provide resources.closedClassWords to enable it.`
    );
  }
  if (!hasMorph) {
    warnings.push(
      `Morphological diversity unavailable: no inflection classifier for language '${lang}'. ` +
        `Provide resources.classifyInflection to enable it.`
    );
  }
  if (!dictionary) {
    warnings.push('Spelling validity unavailable: no dictionary provided.');
  }
  const suppCount = timeline.filter((b) => b.suppressed).length;
  if (suppCount > 0) {
    warnings.push(
      `${suppCount} month(s) suppressed for having fewer than ${minWordsPerMonth} words.`
    );
  }

  // ---- Trend on the headline lexical-diversity median -------------------
  const points: Array<{ x: number; y: number; w: number }> = [];
  for (let i = 0; i < timeline.length; i++) {
    const b = timeline[i];
    if (b.suppressed) continue;
    const y = b.lexicalDiversity.median;
    if (y === null) continue;
    points.push({ x: i, y, w: b.words });
  }

  const slope = weightedSlope(points);
  const validYs = points.map((p) => p.y);
  const half = Math.floor(validYs.length / 2);
  let firstHalf: number | null = null;
  let secondHalf: number | null = null;
  if (validYs.length >= 2) {
    const fh = validYs.slice(0, Math.max(1, half));
    const sh = validYs.slice(Math.max(1, half));
    firstHalf = mean(fh);
    secondHalf = mean(sh);
  }
  const delta = firstHalf !== null && secondHalf !== null ? secondHalf - firstHalf : null;
  let direction: TrendResult['direction'] = 'unknown';
  if (slope !== null) {
    if (Math.abs(slope) < 0.0005) direction = 'flat';
    else direction = slope > 0 ? 'up' : 'down';
  } else if (delta !== null) {
    if (Math.abs(delta) < 0.005) direction = 'flat';
    else direction = delta > 0 ? 'up' : 'down';
  }

  const totalUtts = timeline.reduce((s, b) => s + b.utterances, 0);
  const totalWords = timeline.reduce((s, b) => s + b.words, 0);

  const dim = (available: boolean, reason?: string): DimensionSupport =>
    available ? { available: true } : { available: false, reason };

  return {
    schema: 'aac-competence-report/v1',
    generatedAt: new Date(now).toISOString(),
    privacy: {
      rawUtterancesIncluded: false,
      wordListsIncluded: false,
      fringeWordFrequencyIncluded: false,
      minAggregationWindowDays: 31,
      notes: [
        'All metrics computed locally; only aggregate statistics are emitted.',
        'Utterances are binned by calendar month so no pattern can be tied to a specific day or time.',
        'No word lists or fringe-vocabulary frequencies are included (per AssistiveWare privacy guidance).',
      ],
    },
    source: {
      platform: options.platform ?? 'Grid3',
      langCode: options.langCode,
      userLabel: options.userLabel,
      dbPathIncluded: options.dbPathIncluded === true,
    },
    config: {
      months,
      windowSize,
      lang,
      minWordsPerMonth,
      dictionaryProvided: !!dictionary,
    },
    overall: {
      windowStart: sortedKeys[0] ?? monthKey(windowStartMs),
      windowEnd: sortedKeys[sortedKeys.length - 1] ?? monthKey(now),
      totalUtterances: totalUtts,
      totalWords: totalWords,
      monthsCovered: timeline.length,
      monthsSuppressed: suppCount,
    },
    timeline,
    trend: {
      metric: 'lexicalDiversity.median',
      slopePerMonth: slope,
      firstHalf,
      secondHalf,
      delta,
      direction,
    },
    support: {
      lang,
      semantic: dim(true),
      syntactic: dim(hasCC, hasCC ? undefined : 'no closed-class data for this language'),
      morphological: dim(
        hasMorph,
        hasMorph ? undefined : 'no inflection classifier for this language'
      ),
      phonological: dim(!!dictionary, dictionary ? undefined : 'no dictionary provided'),
    },
    warnings,
  };
}
