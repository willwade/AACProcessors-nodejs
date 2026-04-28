import { MorphologyEngine } from "../src/utilities/analytics/morphology/engine";
import { MorphRuleSet } from "../src/utilities/analytics/morphology/types";

describe("MorphologyEngine", () => {
  describe("built-in English rules", () => {
    let engine: MorphologyEngine;

    beforeEach(() => {
      engine = new MorphologyEngine("en-gb");
    });

    describe("irregular verbs", () => {
      test("go -> goes, going, gone, went", () => {
        const forms = engine.inflect("go", "Verb");
        expect(forms).toContain("goes");
        expect(forms).toContain("going");
        expect(forms).toContain("gone");
        expect(forms).toContain("went");
        expect(forms).not.toContain("goed");
      });

      test("be -> is, am, are, was, were, been, being", () => {
        const forms = engine.inflect("be", "Verb");
        expect(forms).toContain("is");
        expect(forms).toContain("am");
        expect(forms).toContain("are");
        expect(forms).toContain("was");
        expect(forms).toContain("were");
        expect(forms).toContain("been");
        expect(forms).toContain("being");
      });

      test("have -> has, had, having", () => {
        const forms = engine.inflect("have", "Verb");
        expect(forms).toContain("has");
        expect(forms).toContain("had");
        expect(forms).toContain("having");
      });

      test("do -> does, did, done, doing", () => {
        const forms = engine.inflect("do", "Verb");
        expect(forms).toContain("does");
        expect(forms).toContain("did");
        expect(forms).toContain("done");
        expect(forms).toContain("doing");
      });

      test("say -> says, said, saying", () => {
        const forms = engine.inflect("say", "Verb");
        expect(forms).toContain("says");
        expect(forms).toContain("said");
        expect(forms).toContain("saying");
      });

      test("get -> gets, got, getting", () => {
        const forms = engine.inflect("get", "Verb");
        expect(forms).toContain("gets");
        expect(forms).toContain("got");
        expect(forms).toContain("getting");
      });

      test("take -> takes, took, taken, taking", () => {
        const forms = engine.inflect("take", "Verb");
        expect(forms).toContain("takes");
        expect(forms).toContain("took");
        expect(forms).toContain("taken");
        expect(forms).toContain("taking");
      });

      test("come -> comes, came, coming", () => {
        const forms = engine.inflect("come", "Verb");
        expect(forms).toContain("comes");
        expect(forms).toContain("came");
        expect(forms).toContain("coming");
      });
    });

    describe("regular verbs", () => {
      test("walk -> walks, walked, walking", () => {
        const forms = engine.inflect("walk", "Verb");
        expect(forms).toContain("walks");
        expect(forms).toContain("walked");
        expect(forms).toContain("walking");
      });

      test("watch -> watches, watched, watching", () => {
        const forms = engine.inflect("watch", "Verb");
        expect(forms).toContain("watches");
        expect(forms).toContain("watched");
        expect(forms).toContain("watching");
      });

      test("carry -> carries, carried, carrying", () => {
        const forms = engine.inflect("carry", "Verb");
        expect(forms).toContain("carries");
        expect(forms).toContain("carried");
        expect(forms).toContain("carrying");
      });

      test("like -> likes, liked, liking", () => {
        const forms = engine.inflect("like", "Verb");
        expect(forms).toContain("likes");
        expect(forms).toContain("liked");
        expect(forms).toContain("liking");
      });
    });

    describe("irregular nouns", () => {
      test("child -> children", () => {
        const forms = engine.inflect("child", "Noun");
        expect(forms).toContain("children");
      });

      test("person -> people", () => {
        const forms = engine.inflect("person", "Noun");
        expect(forms).toContain("people");
      });

      test("mouse -> mice", () => {
        const forms = engine.inflect("mouse", "Noun");
        expect(forms).toContain("mice");
      });

      test("foot -> feet", () => {
        const forms = engine.inflect("foot", "Noun");
        expect(forms).toContain("feet");
      });

      test("sheep -> sheep (no change)", () => {
        const forms = engine.inflect("sheep", "Noun");
        expect(forms).toContain("sheep");
        expect(forms.length).toBe(1);
      });
    });

    describe("regular nouns", () => {
      test("book -> books", () => {
        const forms = engine.inflect("book", "Noun");
        expect(forms).toContain("books");
      });

      test("thing -> things", () => {
        const forms = engine.inflect("thing", "Noun");
        expect(forms).toContain("things");
      });

      test("story -> stories", () => {
        const forms = engine.inflect("story", "Noun");
        expect(forms).toContain("stories");
      });

      test("bus -> buses", () => {
        const forms = engine.inflect("bus", "Noun");
        expect(forms).toContain("buses");
      });
    });

    describe("adjectives", () => {
      test("good -> better, best", () => {
        const forms = engine.inflect("good", "Adjective");
        expect(forms).toContain("better");
        expect(forms).toContain("best");
      });

      test("bad -> worse, worst", () => {
        const forms = engine.inflect("bad", "Adjective");
        expect(forms).toContain("worse");
        expect(forms).toContain("worst");
      });

      test("big -> bigger, biggest", () => {
        const forms = engine.inflect("big", "Adjective");
        expect(forms).toContain("bigger");
        expect(forms).toContain("biggest");
      });

      test("happy -> happier, happiest", () => {
        const forms = engine.inflect("happy", "Adjective");
        expect(forms).toContain("happier");
        expect(forms).toContain("happiest");
      });
    });

    describe("pronouns", () => {
      test("I -> me, my, mine", () => {
        const forms = engine.inflect("I", "Pronoun");
        expect(forms).toContain("me");
        expect(forms).toContain("my");
        expect(forms).toContain("mine");
      });

      test("they -> them, their, theirs", () => {
        const forms = engine.inflect("they", "Pronoun");
        expect(forms).toContain("them");
        expect(forms).toContain("their");
        expect(forms).toContain("theirs");
      });
    });
  });

  describe("isFormOf", () => {
    let engine: MorphologyEngine;

    beforeEach(() => {
      engine = new MorphologyEngine("en-gb");
    });

    test('detects "went" as form of "go"', () => {
      expect(engine.isFormOf("went", "go", "Verb")).toBe(true);
    });

    test('detects "going" as form of "go"', () => {
      expect(engine.isFormOf("going", "go", "Verb")).toBe(true);
    });

    test('detects "children" as form of "child"', () => {
      expect(engine.isFormOf("children", "child", "Noun")).toBe(true);
    });

    test("does not match unrelated words", () => {
      expect(engine.isFormOf("running", "go", "Verb")).toBe(false);
    });

    test("case insensitive", () => {
      expect(engine.isFormOf("Went", "Go", "Verb")).toBe(true);
      expect(engine.isFormOf("WENT", "go", "Verb")).toBe(true);
    });
  });

  describe("expandVocabulary", () => {
    let engine: MorphologyEngine;

    beforeEach(() => {
      engine = new MorphologyEngine("en-gb");
    });

    test("expands verb buttons", () => {
      const buttons = [
        { label: "go", pos: "Verb" },
        { label: "book", pos: "Noun" },
      ];
      const result = engine.expandVocabulary(buttons);

      expect(result.get("go")).toContain("goes");
      expect(result.get("go")).toContain("going");
      expect(result.get("go")).toContain("went");
      expect(result.get("go")).toContain("gone");
      expect(result.get("book")).toContain("books");
    });

    test("skips Unknown and Ignore POS", () => {
      const buttons = [
        { label: "hello", pos: "Unknown" },
        { label: "world", pos: "Ignore" },
      ];
      const result = engine.expandVocabulary(buttons);
      expect(result.has("hello")).toBe(false);
      expect(result.has("world")).toBe(false);
    });

    test("skips buttons without POS", () => {
      const buttons = [{ label: "hello" }];
      const result = engine.expandVocabulary(buttons);
      expect(result.has("hello")).toBe(false);
    });
  });

  describe("custom rule set", () => {
    test("accepts custom MorphRuleSet", () => {
      const customRules: MorphRuleSet = {
        locale: "test",
        version: 1,
        irregular: {},
        regular: {
          Verb: {
            past: [{ match: "$", replace: "ed" }],
          },
        },
      };

      const engine = new MorphologyEngine(customRules);
      const forms = engine.inflect("walk", "Verb");
      expect(forms).toContain("walked");
    });
  });

  describe("unknown locale", () => {
    test("returns empty for unsupported locale", () => {
      const engine = new MorphologyEngine("xx-xx");
      const forms = engine.inflect("go", "Verb");
      expect(forms).toEqual([]);
    });
  });

  describe("caching", () => {
    test("caches results for same base+pos", () => {
      const engine = new MorphologyEngine("en-gb");
      const first = engine.inflect("go", "Verb");
      const second = engine.inflect("go", "Verb");
      expect(first).toBe(second);
    });
  });
});
