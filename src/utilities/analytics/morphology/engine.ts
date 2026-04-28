import { MorphRuleSet, MorphRule } from './types';
import type { Grid3VerbForms } from './grid3VerbsParser';

export class MorphologyEngine {
  private ruleSet: MorphRuleSet;
  private grid3Verbs?: Map<string, string[]>;
  private cache = new Map<string, string[]>();

  constructor(ruleSetOrLocale: string | MorphRuleSet) {
    if (typeof ruleSetOrLocale === 'string') {
      this.ruleSet = this.loadBundled(ruleSetOrLocale);
    } else {
      this.ruleSet = ruleSetOrLocale;
    }
  }

  static fromGrid3Verbs(verbForms: Grid3VerbForms): MorphologyEngine {
    const engine = new MorphologyEngine({
      locale: verbForms.locale,
      version: 1,
      irregular: {},
      regular: {},
    });
    engine.grid3Verbs = verbForms.verbs;
    return engine;
  }

  get locale(): string {
    return this.ruleSet.locale;
  }

  inflect(base: string, pos: string): string[] {
    const key = `${base.toLowerCase()}|${pos}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (this.grid3Verbs) {
      const forms = this.grid3Verbs.get(base) || this.grid3Verbs.get(base.toLowerCase());
      if (forms) {
        this.cache.set(key, forms);
        return forms;
      }
    }

    const forms = this.computeForms(base, pos);
    this.cache.set(key, forms);
    return forms;
  }

  isFormOf(word: string, base: string, pos: string): boolean {
    const forms = this.inflect(base, pos);
    const lower = word.toLowerCase();
    return forms.some((f) => f.toLowerCase() === lower);
  }

  expandVocabulary(
    buttons: Array<{ label: string; pos?: string; predictions?: string[] }>
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const btn of buttons) {
      const pos = btn.pos;
      if (!pos || pos === 'Unknown' || pos === 'Ignore') continue;
      const forms = this.inflect(btn.label, pos);
      if (forms.length > 0) {
        result.set(btn.label, forms);
      }
    }
    return result;
  }

  inflectWithSlots(base: string, pos: string): Array<{ slot: string; form: string }> {
    const lower = base.toLowerCase();
    const result: Array<{ slot: string; form: string }> = [];
    const seen = new Set<string>();

    const irregular = this.ruleSet.irregular[pos]?.[lower];
    const regularSlots = this.ruleSet.regular[pos];

    if (irregular) {
      for (const [slot, value] of Object.entries(irregular)) {
        if (slot === 'extra' && Array.isArray(value)) {
          value.forEach((v) => {
            if (!seen.has(v)) {
              seen.add(v);
              result.push({ slot, form: v });
            }
          });
        } else if (Array.isArray(value)) {
          value.forEach((v) => {
            if (!seen.has(v)) {
              seen.add(v);
              result.push({ slot, form: v });
            }
          });
        } else {
          if (!seen.has(value)) {
            seen.add(value);
            result.push({ slot, form: value });
          }
        }
      }
    }

    if (!regularSlots) return result;

    for (const [slot, rulesOrAlias] of Object.entries(regularSlots)) {
      if (irregular && irregular[slot] !== undefined) continue;

      let rules: MorphRule[];
      if (typeof rulesOrAlias === 'string') {
        const aliased = regularSlots[rulesOrAlias];
        if (!aliased || typeof aliased === 'string') continue;
        rules = aliased;
      } else {
        rules = rulesOrAlias;
      }

      const form = this.applyRules(lower, rules);
      if (form && form !== lower && !seen.has(form)) {
        seen.add(form);
        result.push({ slot, form });
      }
    }

    return result;
  }

  private computeForms(base: string, pos: string): string[] {
    const lower = base.toLowerCase();
    const forms = new Set<string>();

    const irregular = this.ruleSet.irregular[pos]?.[lower];
    const regularSlots = this.ruleSet.regular[pos];

    if (irregular) {
      for (const [slot, value] of Object.entries(irregular)) {
        if (slot === 'extra' && Array.isArray(value)) {
          value.forEach((v) => forms.add(v));
        } else if (Array.isArray(value)) {
          value.forEach((v) => forms.add(v));
        } else {
          forms.add(value);
        }
      }
    }

    if (!regularSlots) {
      return Array.from(forms);
    }

    for (const [slot, rulesOrAlias] of Object.entries(regularSlots)) {
      if (irregular && irregular[slot] !== undefined) continue;

      let rules: MorphRule[];
      if (typeof rulesOrAlias === 'string') {
        const aliased = regularSlots[rulesOrAlias];
        if (!aliased || typeof aliased === 'string') continue;
        rules = aliased;
      } else {
        rules = rulesOrAlias;
      }

      const form = this.applyRules(lower, rules);
      if (form && form !== lower) {
        forms.add(form);
      }
    }

    return Array.from(forms);
  }

  private applyRules(word: string, rules: MorphRule[]): string | undefined {
    for (const rule of rules) {
      const regex = new RegExp(rule.match, 'i');
      if (regex.test(word)) {
        return word.replace(new RegExp(rule.match, 'i'), rule.replace);
      }
    }
    return undefined;
  }

  /**
   * Infer the most likely POS for a word by checking the irregular tables.
   * Returns the POS if found in any irregular table, or null if not found.
   * Priority: Verb > Noun > Adjective > Pronoun
   */
  inferPOS(word: string): string | null {
    const lower = word.toLowerCase();
    for (const pos of ['Verb', 'Noun', 'Adjective', 'Pronoun']) {
      if (this.ruleSet.irregular[pos]?.[lower]) {
        return pos;
      }
    }
    return null;
  }

  private loadBundled(locale: string): MorphRuleSet {
    const normalized = locale.toLowerCase().replace('_', '-');
    switch (normalized) {
      case 'en-gb':
      case 'en-us':
      case 'en-au':
      case 'en-ca':
      case 'en-nz':
      case 'en-za':
      case 'en':
        return builtinEn();
      default:
        return { locale, version: 1, irregular: {}, regular: {} };
    }
  }
}

function builtinEn(): MorphRuleSet {
  return {
    locale: 'en-gb',
    version: 1,
    irregular: {
      Verb: {
        be: {
          '3sg': 'is',
          past: 'was',
          pastPart: 'been',
          presPart: 'being',
          extra: ['am', 'are', 'were'],
        },
        have: {
          '3sg': 'has',
          past: 'had',
          pastPart: 'had',
          presPart: 'having',
        },
        do: { '3sg': 'does', past: 'did', pastPart: 'done', presPart: 'doing' },
        go: {
          '3sg': 'goes',
          past: 'went',
          pastPart: 'gone',
          presPart: 'going',
        },
        say: {
          '3sg': 'says',
          past: 'said',
          pastPart: 'said',
          presPart: 'saying',
        },
        get: {
          '3sg': 'gets',
          past: 'got',
          pastPart: 'got',
          presPart: 'getting',
        },
        make: {
          '3sg': 'makes',
          past: 'made',
          pastPart: 'made',
          presPart: 'making',
        },
        come: {
          '3sg': 'comes',
          past: 'came',
          pastPart: 'come',
          presPart: 'coming',
        },
        take: {
          '3sg': 'takes',
          past: 'took',
          pastPart: 'taken',
          presPart: 'taking',
        },
        know: {
          '3sg': 'knows',
          past: 'knew',
          pastPart: 'known',
          presPart: 'knowing',
        },
        think: {
          '3sg': 'thinks',
          past: 'thought',
          pastPart: 'thought',
          presPart: 'thinking',
        },
        see: {
          '3sg': 'sees',
          past: 'saw',
          pastPart: 'seen',
          presPart: 'seeing',
        },
        give: {
          '3sg': 'gives',
          past: 'gave',
          pastPart: 'given',
          presPart: 'giving',
        },
        find: {
          '3sg': 'finds',
          past: 'found',
          pastPart: 'found',
          presPart: 'finding',
        },
        tell: {
          '3sg': 'tells',
          past: 'told',
          pastPart: 'told',
          presPart: 'telling',
        },
        feel: {
          '3sg': 'feels',
          past: 'felt',
          pastPart: 'felt',
          presPart: 'feeling',
        },
        run: {
          '3sg': 'runs',
          past: 'ran',
          pastPart: 'run',
          presPart: 'running',
        },
        fly: {
          '3sg': 'flies',
          past: 'flew',
          pastPart: 'flown',
          presPart: 'flying',
        },
        try: {
          '3sg': 'tries',
          past: 'tried',
          pastPart: 'tried',
          presPart: 'trying',
        },
        leave: {
          '3sg': 'leaves',
          past: 'left',
          pastPart: 'left',
          presPart: 'leaving',
        },
        call: {
          '3sg': 'calls',
          past: 'called',
          pastPart: 'called',
          presPart: 'calling',
        },
        ask: {
          '3sg': 'asks',
          past: 'asked',
          pastPart: 'asked',
          presPart: 'asking',
        },
        put: {
          '3sg': 'puts',
          past: 'put',
          pastPart: 'put',
          presPart: 'putting',
        },
        read: {
          '3sg': 'reads',
          past: 'read',
          pastPart: 'read',
          presPart: 'reading',
        },
        eat: {
          '3sg': 'eats',
          past: 'ate',
          pastPart: 'eaten',
          presPart: 'eating',
        },
        drink: {
          '3sg': 'drinks',
          past: 'drank',
          pastPart: 'drunk',
          presPart: 'drinking',
        },
        sleep: {
          '3sg': 'sleeps',
          past: 'slept',
          pastPart: 'slept',
          presPart: 'sleeping',
        },
        speak: {
          '3sg': 'speaks',
          past: 'spoke',
          pastPart: 'spoken',
          presPart: 'speaking',
        },
        write: {
          '3sg': 'writes',
          past: 'wrote',
          pastPart: 'written',
          presPart: 'writing',
        },
        sit: {
          '3sg': 'sits',
          past: 'sat',
          pastPart: 'sat',
          presPart: 'sitting',
        },
        stand: {
          '3sg': 'stands',
          past: 'stood',
          pastPart: 'stood',
          presPart: 'standing',
        },
        fall: {
          '3sg': 'falls',
          past: 'fell',
          pastPart: 'fallen',
          presPart: 'falling',
        },
        hold: {
          '3sg': 'holds',
          past: 'held',
          pastPart: 'held',
          presPart: 'holding',
        },
        keep: {
          '3sg': 'keeps',
          past: 'kept',
          pastPart: 'kept',
          presPart: 'keeping',
        },
        buy: {
          '3sg': 'buys',
          past: 'bought',
          pastPart: 'bought',
          presPart: 'buying',
        },
        bring: {
          '3sg': 'brings',
          past: 'brought',
          pastPart: 'brought',
          presPart: 'bringing',
        },
        catch: {
          '3sg': 'catches',
          past: 'caught',
          pastPart: 'caught',
          presPart: 'catching',
        },
        teach: {
          '3sg': 'teaches',
          past: 'taught',
          pastPart: 'taught',
          presPart: 'teaching',
        },
        fight: {
          '3sg': 'fights',
          past: 'fought',
          pastPart: 'fought',
          presPart: 'fighting',
        },
        swim: {
          '3sg': 'swims',
          past: 'swam',
          pastPart: 'swum',
          presPart: 'swimming',
        },
        sing: {
          '3sg': 'sings',
          past: 'sang',
          pastPart: 'sung',
          presPart: 'singing',
        },
        draw: {
          '3sg': 'draws',
          past: 'drew',
          pastPart: 'drawn',
          presPart: 'drawing',
        },
        drive: {
          '3sg': 'drives',
          past: 'drove',
          pastPart: 'driven',
          presPart: 'driving',
        },
        ride: {
          '3sg': 'rides',
          past: 'rode',
          pastPart: 'ridden',
          presPart: 'riding',
        },
        grow: {
          '3sg': 'grows',
          past: 'grew',
          pastPart: 'grown',
          presPart: 'growing',
        },
        throw: {
          '3sg': 'throws',
          past: 'threw',
          pastPart: 'thrown',
          presPart: 'throwing',
        },
        break: {
          '3sg': 'breaks',
          past: 'broke',
          pastPart: 'broken',
          presPart: 'breaking',
        },
        wake: {
          '3sg': 'wakes',
          past: 'woke',
          pastPart: 'woken',
          presPart: 'waking',
        },
        wear: {
          '3sg': 'wears',
          past: 'wore',
          pastPart: 'worn',
          presPart: 'wearing',
        },
        win: {
          '3sg': 'wins',
          past: 'won',
          pastPart: 'won',
          presPart: 'winning',
        },
        choose: {
          '3sg': 'chooses',
          past: 'chose',
          pastPart: 'chosen',
          presPart: 'choosing',
        },
        hide: {
          '3sg': 'hides',
          past: 'hid',
          pastPart: 'hidden',
          presPart: 'hiding',
        },
        steal: {
          '3sg': 'steals',
          past: 'stole',
          pastPart: 'stolen',
          presPart: 'stealing',
        },
        begin: {
          '3sg': 'begins',
          past: 'began',
          pastPart: 'begun',
          presPart: 'beginning',
        },
        ring: {
          '3sg': 'rings',
          past: 'rang',
          pastPart: 'rung',
          presPart: 'ringing',
        },
        swing: {
          '3sg': 'swings',
          past: 'swung',
          pastPart: 'swung',
          presPart: 'swinging',
        },
        blow: {
          '3sg': 'blows',
          past: 'blew',
          pastPart: 'blown',
          presPart: 'blowing',
        },
        show: {
          '3sg': 'shows',
          past: 'showed',
          pastPart: 'shown',
          presPart: 'showing',
        },
        shut: {
          '3sg': 'shuts',
          past: 'shut',
          pastPart: 'shut',
          presPart: 'shutting',
        },
        cut: {
          '3sg': 'cuts',
          past: 'cut',
          pastPart: 'cut',
          presPart: 'cutting',
        },
        hit: {
          '3sg': 'hits',
          past: 'hit',
          pastPart: 'hit',
          presPart: 'hitting',
        },
        hurt: {
          '3sg': 'hurts',
          past: 'hurt',
          pastPart: 'hurt',
          presPart: 'hurting',
        },
        let: {
          '3sg': 'lets',
          past: 'let',
          pastPart: 'let',
          presPart: 'letting',
        },
        set: {
          '3sg': 'sets',
          past: 'set',
          pastPart: 'set',
          presPart: 'setting',
        },
        cost: {
          '3sg': 'costs',
          past: 'cost',
          pastPart: 'cost',
          presPart: 'costing',
        },
        send: {
          '3sg': 'sends',
          past: 'sent',
          pastPart: 'sent',
          presPart: 'sending',
        },
        build: {
          '3sg': 'builds',
          past: 'built',
          pastPart: 'built',
          presPart: 'building',
        },
        spend: {
          '3sg': 'spends',
          past: 'spent',
          pastPart: 'spent',
          presPart: 'spending',
        },
        lend: {
          '3sg': 'lends',
          past: 'lent',
          pastPart: 'lent',
          presPart: 'lending',
        },
        lose: {
          '3sg': 'loses',
          past: 'lost',
          pastPart: 'lost',
          presPart: 'losing',
        },
        mean: {
          '3sg': 'means',
          past: 'meant',
          pastPart: 'meant',
          presPart: 'meaning',
        },
        meet: {
          '3sg': 'meets',
          past: 'met',
          pastPart: 'met',
          presPart: 'meeting',
        },
        pay: {
          '3sg': 'pays',
          past: 'paid',
          pastPart: 'paid',
          presPart: 'paying',
        },
        sell: {
          '3sg': 'sells',
          past: 'sold',
          pastPart: 'sold',
          presPart: 'selling',
        },
        hang: {
          '3sg': 'hangs',
          past: 'hung',
          pastPart: 'hung',
          presPart: 'hanging',
        },
        shine: {
          '3sg': 'shines',
          past: 'shone',
          pastPart: 'shone',
          presPart: 'shining',
        },
        dig: {
          '3sg': 'digs',
          past: 'dug',
          pastPart: 'dug',
          presPart: 'digging',
        },
        stick: {
          '3sg': 'sticks',
          past: 'stuck',
          pastPart: 'stuck',
          presPart: 'sticking',
        },
        spin: {
          '3sg': 'spins',
          past: 'spun',
          pastPart: 'spun',
          presPart: 'spinning',
        },
        spread: {
          '3sg': 'spreads',
          past: 'spread',
          pastPart: 'spread',
          presPart: 'spreading',
        },
        bite: {
          '3sg': 'bites',
          past: 'bit',
          pastPart: 'bitten',
          presPart: 'biting',
        },
        feed: {
          '3sg': 'feeds',
          past: 'fed',
          pastPart: 'fed',
          presPart: 'feeding',
        },
        lead: {
          '3sg': 'leads',
          past: 'led',
          pastPart: 'led',
          presPart: 'leading',
        },
        light: {
          '3sg': 'lights',
          past: 'lit',
          pastPart: 'lit',
          presPart: 'lighting',
        },
        shoot: {
          '3sg': 'shoots',
          past: 'shot',
          pastPart: 'shot',
          presPart: 'shooting',
        },
        slide: {
          '3sg': 'slides',
          past: 'slid',
          pastPart: 'slid',
          presPart: 'sliding',
        },
      },
      Noun: {
        child: { plural: 'children' },
        person: { plural: 'people' },
        man: { plural: 'men' },
        woman: { plural: 'women' },
        mouse: { plural: 'mice' },
        foot: { plural: 'feet' },
        tooth: { plural: 'teeth' },
        goose: { plural: 'geese' },
        sheep: { plural: 'sheep' },
        fish: { plural: 'fish' },
        deer: { plural: 'deer' },
        ox: { plural: 'oxen' },
        leaf: { plural: 'leaves' },
        loaf: { plural: 'loaves' },
        wolf: { plural: 'wolves' },
        calf: { plural: 'calves' },
        half: { plural: 'halves' },
        knife: { plural: 'knives' },
        life: { plural: 'lives' },
        wife: { plural: 'wives' },
        self: { plural: 'selves' },
        shelf: { plural: 'shelves' },
        elf: { plural: 'elves' },
        thief: { plural: 'thieves' },
        roof: { plural: 'roofs' },
        chief: { plural: 'chiefs' },
        belief: { plural: 'beliefs' },
        proof: { plural: 'proofs' },
        hoof: { plural: 'hooves' },
        scarf: { plural: 'scarves' },
        wharf: { plural: 'wharves' },
        bus: { plural: 'buses' },
        glass: { plural: 'glasses' },
        class: { plural: 'classes' },
        box: { plural: 'boxes' },
        fox: { plural: 'foxes' },
        watch: { plural: 'watches' },
        match: { plural: 'matches' },
        brush: { plural: 'brushes' },
        dish: { plural: 'dishes' },
        wish: { plural: 'wishes' },
        wash: { plural: 'washes' },
        bush: { plural: 'bushes' },
        push: { plural: 'pushes' },
        potato: { plural: 'potatoes' },
        tomato: { plural: 'tomatoes' },
        hero: { plural: 'heroes' },
        echo: { plural: 'echoes' },
        veto: { plural: 'vetoes' },
        mango: { plural: 'mangoes' },
        mosquito: { plural: 'mosquitoes' },
        tornado: { plural: 'tornadoes' },
        volcano: { plural: 'volcanoes' },
        radio: { plural: 'radios' },
        studio: { plural: 'studios' },
        video: { plural: 'videos' },
        piano: { plural: 'pianos' },
        photo: { plural: 'photos' },
        zoo: { plural: 'zoos' },
        bamboo: { plural: 'bamboos' },
        embryo: { plural: 'embryos' },
        ratio: { plural: 'ratios' },
        scenario: { plural: 'scenarios' },
        analysis: { plural: 'analyses' },
        basis: { plural: 'bases' },
        crisis: { plural: 'crises' },
        diagnosis: { plural: 'diagnoses' },
        hypothesis: { plural: 'hypotheses' },
        oasis: { plural: 'oases' },
        parenthesis: { plural: 'parentheses' },
        synthesis: { plural: 'syntheses' },
        thesis: { plural: 'theses' },
        phenomenon: { plural: 'phenomena' },
        criterion: { plural: 'criteria' },
        datum: { plural: 'data' },
        medium: { plural: 'media' },
        curriculum: { plural: 'curricula' },
        bacterium: { plural: 'bacteria' },
        stimulus: { plural: 'stimuli' },
        syllabus: { plural: 'syllabi' },
        focus: { plural: 'foci' },
        nucleus: { plural: 'nuclei' },
        fungus: { plural: 'fungi' },
        cactus: { plural: 'cacti' },
        appendix: { plural: 'appendices' },
        index: { plural: 'indices' },
        matrix: { plural: 'matrices' },
        vertex: { plural: 'vertices' },
      },
      Adjective: {
        good: { comparative: 'better', superlative: 'best' },
        bad: { comparative: 'worse', superlative: 'worst' },
        far: { comparative: 'farther', superlative: 'farthest' },
        little: { comparative: 'less', superlative: 'least' },
        much: { comparative: 'more', superlative: 'most' },
        many: { comparative: 'more', superlative: 'most' },
        well: { comparative: 'better', superlative: 'best' },
        old: {
          comparative: 'older',
          superlative: 'oldest',
          extra: ['elder', 'eldest'],
        },
        late: {
          comparative: 'later',
          superlative: 'latest',
          extra: ['latter', 'last'],
        },
      },
      Pronoun: {
        i: {
          objective: 'me',
          possessive: 'my',
          possessivePronoun: 'mine',
        },
        you: {
          objective: 'you',
          possessive: 'your',
          possessivePronoun: 'yours',
        },
        he: {
          objective: 'him',
          possessive: 'his',
          possessivePronoun: 'his',
        },
        she: {
          objective: 'her',
          possessive: 'her',
          possessivePronoun: 'hers',
        },
        it: {
          objective: 'it',
          possessive: 'its',
        },
        we: {
          objective: 'us',
          possessive: 'our',
          possessivePronoun: 'ours',
        },
        they: {
          objective: 'them',
          possessive: 'their',
          possessivePronoun: 'theirs',
        },
        mine: { extra: ['my'] },
        yours: { extra: ['your'] },
        his: { extra: ['him'] },
        hers: { extra: ['her'] },
        ours: { extra: ['our'] },
        theirs: { extra: ['their'] },
      },
    },
    regular: {
      Verb: {
        '3sg': [
          { match: '(ss|sh|ch|x|z|o)$', replace: '$1es' },
          { match: '([^aeiou])y$', replace: '$1ies' },
          { match: '$', replace: 's' },
        ],
        past: [
          { match: '([^aeiou])y$', replace: '$1ied' },
          { match: '([^aeiou][aeiou])([^aeiouwxy])$', replace: '$1$2$2ed' },
          { match: '(.*)e$', replace: '$1ed' },
          { match: '$', replace: 'ed' },
        ],
        pastPart: 'past',
        presPart: [
          { match: 'ie$', replace: 'ying' },
          { match: '(.*)e$', replace: '$1ing' },
          { match: '([^aeiou][aeiou])([^aeiouwxy])$', replace: '$1$2$2ing' },
          { match: '$', replace: 'ing' },
        ],
      },
      Noun: {
        plural: [
          { match: '(ss|sh|ch|x|z)$', replace: '$1es' },
          { match: '([^aeiou])y$', replace: '$1ies' },
          { match: 'fe$', replace: 'ves' },
          { match: 'f$', replace: 'ves' },
          { match: '$', replace: 's' },
        ],
      },
      Adjective: {
        comparative: [
          { match: 'e$', replace: 'r' },
          { match: '([^aeiou])y$', replace: '$1ier' },
          { match: '([^aeiou][aeiou])([^aeiouwxy])$', replace: '$1$2$2er' },
          { match: '$', replace: 'er' },
        ],
        superlative: [
          { match: 'e$', replace: 'st' },
          { match: '([^aeiou])y$', replace: '$1iest' },
          { match: '([^aeiou][aeiou])([^aeiouwxy])$', replace: '$1$2$2est' },
          { match: '$', replace: 'est' },
        ],
      },
    },
  };
}
