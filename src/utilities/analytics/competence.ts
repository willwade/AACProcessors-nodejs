/**
 * Linguistic Competence Metrics
 *
 * Privacy-preserving analysis of AAC *spoken output* (phrase history), based on:
 *   - Niemeijer, Sheldon & Hillary Zisk (2025), "Measuring AAC user linguistic
 *     competence: A novel approach", AssistiveWare (Communication Matters handout).
 *   - Frisch, Wade et al. (2026), "It's Complicated: On the Design and Evaluation
 *     of AI-Powered AAC Interfaces", arXiv:2606.24854.
 *
 * All functions here are pure and platform-agnostic (no I/O, no Bun/Node APIs).
 * They compute only aggregate statistics and never return the raw text they are
 * given. This makes them safe to run on-device and trivially unit-testable.
 *
 * The four dimensions of linguistic competence (Light, 1989) and the measures we
 * use for each, following the AssistiveWare findings:
 *
 *   Semantic      -> MATTR-30  (lexical diversity, the strongest overall measure)
 *   Syntactic     -> MA-UPC-TWR-30  (preposition + conjunction diversity)
 *   Morphological -> MA-UMORPH-TLWR-30 (proxy; documented below)
 *   Phonological  -> proportion of unique words correctly spelled (optional, weak)
 *
 * Key design choices, straight from the AssistiveWare paper:
 *   - Diversity beats density (density plateaus); we use diversity measures.
 *   - Moving-average windows of 30 words (Covington & McFall, 2010) make the
 *     measures insensitive to sample length and usable for tiny language samples.
 *   - MLU is reported only as a *distribution* and never as a headline, because
 *     it conflates linguistic, operational, strategic and social competence.
 */

/** A single spoken utterance with a production timestamp (epoch ms). */
export interface CompetenceUtterance {
  text: string;
  timestampMs: number;
}

/** A tokenised word stream produced in chronological order. */
export type WordStream = string[];

/** Options shared by the dimension measures. */
export interface DiversityOptions {
  /** Moving-average window size in words. The papers use 30. */
  windowSize?: number;
  /** BCP-47-ish language code, e.g. "en-GB", "nl-BE". Only the primary subtag matters. */
  lang?: string;
}

export interface DiversityResult {
  /** Median of the per-window values (the headline figure, per the paper). */
  median: number | null;
  mean: number | null;
  /** Number of windows that contributed a value (after any skipping). */
  nWindows: number;
  /** The window size used. */
  windowSize: number;
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
  while ((m = TOKENReexec()) !== null) {
    let tok = m[0].toLowerCase();
    // Strip stray leading/trailing apostrophes introduced by quotes.
    tok = tok.replace(/^['’]+|['’]+$/g, '');
    if (tok.length > 0) out.push(tok);
  }
  return out;

  function TOKENReexec(): RegExpExecArray | null {
    return TOKEN_RE.exec(text);
  }
}

/* ------------------------------------------------------------------ *
 * Semantic competence: lexical diversity (MATTR-30)
 * ------------------------------------------------------------------ */

/**
 * Compute a type-token ratio for one segment of words.
 */
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
 *
 * Returns the headline `median` plus mean and window count.
 */
export function movingAverageTTR(words: WordStream, windowSize = 30): DiversityResult {
  const n = words.length;
  const w = Math.max(1, Math.floor(windowSize));
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  // Fewer words than one window: compute TTR over the whole sample.
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
 * Syntactic competence: preposition + conjunction diversity (MA-UPC-TWR-30)
 * ------------------------------------------------------------------ */

/** English prepositions (closed set, indicator of relational syntax). */
const EN_PREPOSITIONS = new Set([
  'about',
  'above',
  'across',
  'after',
  'against',
  'along',
  'alongside',
  'amid',
  'among',
  'amongst',
  'around',
  'as',
  'at',
  'atop',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'besides',
  'between',
  'beyond',
  'by',
  'despite',
  'down',
  'during',
  'except',
  'for',
  'from',
  'in',
  'inside',
  'into',
  'near',
  'of',
  'off',
  'on',
  'onto',
  'opposite',
  'out',
  'outside',
  'over',
  'past',
  'per',
  'plus',
  'round',
  'since',
  'than',
  'through',
  'throughout',
  'till',
  'to',
  'toward',
  'towards',
  'under',
  'underneath',
  'unlike',
  'until',
  'up',
  'upon',
  'versus',
  'via',
  'with',
  'within',
  'without',
]);

/** English conjunctions (closed set, indicator of clausal complexity). */
const EN_CONJUNCTIONS = new Set([
  'and',
  'but',
  'or',
  'nor',
  'yet',
  'so',
  'although',
  'because',
  'considering',
  'if',
  'lest',
  'once',
  'provided',
  'since',
  'than',
  'that',
  'though',
  'unless',
  'until',
  'when',
  'whenever',
  'where',
  'whereas',
  'wherever',
  'whether',
  'while',
  'whilst',
  'why',
  'neither',
  'either',
  'both',
]);

/** Dutch prepositions. */
const NL_PREPOSITIONS = new Set([
  'aan',
  'achter',
  'bij',
  'door',
  'tijdens',
  'in',
  'boven',
  'langs',
  'met',
  'na',
  'naar',
  'om',
  'onder',
  'op',
  'over',
  'rond',
  'per',
  'sinds',
  'tegen',
  'uit',
  'van',
  'voor',
  'tot',
  'tussen',
  'binnen',
  'buiten',
  'behalve',
  'wegens',
  'krachtens',
  'volgens',
]);

/** Dutch conjunctions. */
const NL_CONJUNCTIONS = new Set([
  'en',
  'of',
  'maar',
  'want',
  'dus',
  'omdat',
  'toen',
  'voordat',
  'nadat',
  'terwijl',
  'indien',
  'mits',
  'tenzij',
  'hoewel',
  'ofschoon',
  'zodra',
  'zolang',
  'als',
  'dat',
  'noch',
]);

/**
 * Get the closed-set (prepositions ∪ conjunctions) for a language, or null if
 * unsupported. Callers should skip the syntactic measure when this is null.
 */
export function getClosedClassSet(lang?: string): Set<string> | null {
  const primary = (lang || 'en').split(/[-_]/)[0].toLowerCase();
  switch (primary) {
    case 'en':
      return new Set<string>([...EN_PREPOSITIONS, ...EN_CONJUNCTIONS]);
    case 'nl':
      return new Set<string>([...NL_PREPOSITIONS, ...NL_CONJUNCTIONS]);
    default:
      return null;
  }
}

/**
 * Syntactic diversity: MA-UPC-TWR-30.
 *
 * For each 30-word window, compute the type-token ratio restricted to the
 * closed-class words that indicate syntactic complexity (prepositions and
 * conjunctions). Windows containing none of these are skipped (no syntactic
 * signal). The median across contributing windows is reported.
 */
export function syntacticDiversity(
  words: WordStream,
  options: DiversityOptions = {}
): DiversityResult {
  const w = Math.max(1, Math.floor(options.windowSize ?? 30));
  const closed = getClosedClassSet(options.lang);
  if (!closed) {
    return { median: null, mean: null, nWindows: 0, windowSize: w };
  }

  const n = words.length;
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  const values: number[] = [];
  const scan = (segment: WordStream): void => {
    const upc = segment.filter((tok) => closed.has(tok));
    if (upc.length > 0) {
      values.push(new Set(upc).size / upc.length);
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
    return { median: null, mean: null, nWindows: 0, windowSize: w };
  }
  return { median: median(values), mean: mean(values), nWindows: values.length, windowSize: w };
}

/* ------------------------------------------------------------------ *
 * Morphological competence: MA-UMORPH-TLWR-30 (documented proxy)
 * ------------------------------------------------------------------ */

export type InflectionCategory =
  | 'base'
  | 'plural'
  | 'possessive'
  | 'past'
  | 'progressive'
  | 'comparative'
  | 'superlative'
  | 'adverb';

const BASE_GUARD = new Set([
  // Words that look inflected but are base forms; avoids the worst false hits.
  'is',
  'as',
  'was',
  'has',
  'his',
  'its',
  'us',
  'bus',
  'gas',
  'yes',
  'this',
  'miss',
  'loss',
  'boss',
  'less',
  'dress',
  'guess',
  'press',
  'cross',
  'class',
  'glass',
  'pass',
  'mass',
  'ass',
  'bed',
  'red',
  'fed',
  'led',
  'wed',
  'shed',
  'ted',
  'bred',
  'her',
  'per',
  'der',
  'fer',
  'ring',
  'sing',
  'king',
  'thing',
  'bring',
  'long',
  'wing',
  'spring',
  'string',
  'sting',
  'cling',
  'swing',
  'fling',
  'slang',
  'best',
  'rest',
  'test',
  'west',
  'nest',
  'chest',
  'pest',
  'vest',
  'quest',
  'fest',
  'lest',
  'beast',
  'feast',
  'breast',
  'fly',
  'ply',
  'sly',
  'ally',
  'rally',
  'supply',
  'reply',
  'apply',
  'comply',
  'rely',
  'family',
  'only',
  'lonely',
  'likely',
  'lovely',
  'silly',
  'holy',
  'uly',
  'fully',
]);

/**
 * Crude, dependency-free inflection classifier for English.
 *
 * This is intentionally a *heuristic proxy*: it identifies the morphological
 * operation encoded by a word's suffix so we can measure how diverse the user's
 * morphological production is. It is NOT a lemmatiser. False positives/negatives
 * are expected and documented; the measure is used comparatively across time
 * bins, not as an absolute clinical score.
 */
export function classifyInflection(word: string): InflectionCategory {
  const w = word.toLowerCase();
  if (w.length < 3) return 'base';

  // Possessive first (apostrophe forms): "dad's", "dogs'".
  if (w.endsWith("'s") || w.endsWith("s'")) return 'possessive';

  if (BASE_GUARD.has(w)) return 'base';

  if (w.endsWith('ing') && w.length > 4) return 'progressive';
  if (w.endsWith('est') && w.length > 4) return 'superlative';
  if (w.endsWith('ies') && w.length > 3) return 'plural'; // berries, stories
  if (w.endsWith('ied') && w.length > 3) return 'past'; // carried
  if (w.endsWith('ed') && w.length > 3 && !w.endsWith('eed')) return 'past';
  if (w.endsWith('er') && w.length > 3) return 'comparative';
  if (w.endsWith('ly') && w.length > 3) return 'adverb';
  if (w.endsWith('es') && w.length > 3) return 'plural';
  if (
    w.endsWith('s') &&
    !w.endsWith('ss') &&
    !w.endsWith('us') &&
    !w.endsWith('is') &&
    w.length > 2
  ) {
    return 'plural';
  }
  return 'base';
}

/**
 * Morphological diversity (proxy for MA-UMORPH-TLWR-30).
 *
 * Within each 30-word window, look at the words carrying a morphological
 * operation (any category other than "base") and compute the type-token ratio
 * over their *surface forms*. A higher value means the user is producing a
 * broader, less-repetitive range of inflected forms locally. Windows with no
 * inflected words are skipped.
 *
 * Caveat (per AssistiveWare): for symbol-supported AAC, pre-stored morphology
 * buttons (e.g. "finished", "all done", "is") heavily affect this measure, so
 * interpret trends rather than absolutes.
 */
export function morphologicalDiversity(
  words: WordStream,
  options: DiversityOptions = {}
): DiversityResult {
  const w = Math.max(1, Math.floor(options.windowSize ?? 30));
  const lang = (options.lang || 'en').split(/[-_]/)[0].toLowerCase();
  if (lang !== 'en') {
    return { median: null, mean: null, nWindows: 0, windowSize: w };
  }

  const n = words.length;
  if (n === 0) return { median: null, mean: null, nWindows: 0, windowSize: w };

  const values: number[] = [];
  const scan = (segment: WordStream): void => {
    const inflected = segment.filter((tok) => classifyInflection(tok) !== 'base');
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
    return { median: null, mean: null, nWindows: 0, windowSize: w };
  }
  return { median: median(values), mean: mean(values), nWindows: values.length, windowSize: w };
}

/* ------------------------------------------------------------------ *
 * Phonological competence: spelling validity (optional, weak)
 * ------------------------------------------------------------------ */

/**
 * Proportion of unique alphabetic words present in the supplied dictionary.
 *
 * Focuses on *unique* words so it is not skewed by repetition or repeated
 * misspellings. Pass a dictionary Set (e.g. loaded from a hunspell/aspell
 * wordlist). Returns null if no dictionary is provided.
 */
export function spellingValidity(words: WordStream, dictionary?: Set<string>): number | null {
  if (!dictionary || dictionary.size === 0) return null;
  const unique = new Set(words);
  let checked = 0;
  let correct = 0;
  for (const tok of unique) {
    // Only consider alphabetic tokens of reasonable length.
    if (!/^\p{L}{2,}$/u.test(tok)) continue;
    checked++;
    if (dictionary.has(tok)) correct++;
  }
  return checked === 0 ? null : correct / checked;
}

/* ------------------------------------------------------------------ *
 * Activity / engagement statistics (multidimensional, distributional)
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
    uniqueWords: 0, // filled by caller from the ordered stream for accuracy
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
  /** Syntactic. null if language unsupported. */
  syntacticDiversity: DiversityResult;
  /** Morphological (proxy). null if language unsupported. */
  morphologicalDiversity: DiversityResult;
  /** Phonological — only when a dictionary is supplied. */
  spellingValidity: number | null;
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

/**
 * Structural / effort summary of the user's AAC pageset (gridset).
 *
 * Computed from the existing MetricsCalculator so competence numbers can be read
 * alongside the vocabulary design that shapes them (grid size, vocabulary size,
 * effort, prediction) — the AssistiveWare paper stresses that setup affects both
 * competence and its measurement. Contains NO word labels (privacy).
 */
export interface PagesetSummary {
  /** Hashed label unless the caller opts in to revealing the file name. */
  label: string;
  gridsetIncluded: boolean;
  analysisVersion?: string;
  totalBoards: number;
  totalButtons: number;
  totalWords: number;
  grid: { rows: number; columns: number };
  /** Effort distribution across all scored buttons (lower = easier). */
  effort: DistributionStats;
  hasDynamicPrediction: boolean;
  spellingEffort: { base: number | null; perLetter: number | null };
  /** Present if the gridset could not be loaded/analysed. */
  error?: string;
}

/**
 * Privacy-safe system-configuration context for the user (Grid 3 UserSettings).
 *
 * These are NOT chat content — they describe how the system is set up, which is
 * essential for interpreting the competence numbers. Notably `onlineAiToolsOptIn`
 * records whether the user has enabled the vendor's online AI tools, letting
 * competence trends be read against whether AI assistance was even active.
 */
export interface UserSettingsSummary {
  /** Vocabulary/gridset name configured as the startup set (a product name). */
  startupGridSet: string | null;
  /** Whether the user opted in to the vendor's online AI tools. */
  onlineAiToolsOptIn: boolean | null;
  /** Enabled access method names (e.g. Touch, Pointer, EyeGaze, Switch). */
  accessMethods: string[];
  /** Counts of user-created personalisation entries (aggregate across languages). */
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
  /** Language code. Default "en". */
  lang?: string;
  /** Months with fewer than this many words are flagged suppressed. Default 150. */
  minWordsPerMonth?: number;
  /** Optional dictionary Set for the spelling measure. */
  dictionary?: Set<string>;
  /** Epoch ms for "now". Defaults to Date.now(). Mainly for tests. */
  now?: number;
  /** Platform label for the report. Default "Grid3". */
  platform?: string;
  userLabel?: string;
  langCode?: string;
  dbPathIncluded?: boolean;
}

/**
 * Build a YYYY-MM key from epoch ms in local time.
 */
function monthKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Weighted linear-regression slope. Weights account for uneven sample sizes so
 * that a noisy low-volume month cannot dominate the trend.
 */
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
 * The headline lexical-diversity trend across months is summarised.
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
    const monthUtts = bins
      .get(key)!
      .slice()
      .sort((a, b) => a.timestampMs - b.timestampMs);

    // Ordered word stream for the sliding-window measures.
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
      : syntacticDiversity(stream, { windowSize, lang });
    const mor = suppressed
      ? { median: null, mean: null, nWindows: 0, windowSize }
      : morphologicalDiversity(stream, { windowSize, lang });
    const spell = suppressed ? null : spellingValidity(stream, dictionary);

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
      suppressed,
      suppressReason,
    });
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
      monthsSuppressed: timeline.filter((b) => b.suppressed).length,
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
  };
}
