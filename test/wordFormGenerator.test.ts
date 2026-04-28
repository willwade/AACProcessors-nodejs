/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WordFormGenerator } from "../src/utilities/analytics/morphology/wordFormGenerator";
import { MorphologyEngine } from "../src/utilities/analytics/morphology/engine";
import { Grid3VerbsParser } from "../src/utilities/analytics/morphology/grid3VerbsParser";
import { join } from "path";

const SYNTHETIC_XML = join(__dirname, "assets", "grid3", "synthetic-verbs.xml");

describe("WordFormGenerator", () => {
  let generator: WordFormGenerator;
  let engine: MorphologyEngine;

  beforeEach(() => {
    generator = new WordFormGenerator();
    engine = new MorphologyEngine("en-gb");
  });

  describe("generateFromEngineSlots", () => {
    test("regular verb walk -> BASE + 3.PERS + PAST + GERUND", () => {
      const forms = generator.generateFromEngineSlots("walk", "Verb", engine);
      const base = forms.find((f) => f.tags.includes("BASE"));
      expect(base).toBeDefined();
      expect(base!.value).toBe("walk");

      const third = forms.find((f) => f.tags.includes("3.PERS"));
      expect(third).toBeDefined();
      expect(third!.value).toBe("walks");

      const past = forms.find(
        (f) => f.tags.includes("PAST") && !f.tags.includes("PARTICIPLE"),
      );
      expect(past).toBeDefined();
      expect(past!.value).toBe("walked");

      const gerund = forms.find((f) => f.tags.includes("GERUND"));
      expect(gerund).toBeDefined();
      expect(gerund!.value).toBe("walking");
    });

    test("irregular verb go -> correct tagged forms", () => {
      const forms = generator.generateFromEngineSlots("go", "Verb", engine);

      const went = forms.find((f) => f.value === "went");
      expect(went).toBeDefined();
      expect(went!.tags).toContain("PAST");

      const goes = forms.find((f) => f.value === "goes");
      expect(goes).toBeDefined();
      expect(goes!.tags).toContain("3.PERS");

      const gone = forms.find((f) => f.value === "gone");
      expect(gone).toBeDefined();
      expect(gone!.tags).toContain("PAST");
      expect(gone!.tags).toContain("PARTICIPLE");

      const going = forms.find((f) => f.value === "going");
      expect(going).toBeDefined();
      expect(going!.tags).toContain("GERUND");
    });

    test("noun book -> BASE + PLURAL", () => {
      const forms = generator.generateFromEngineSlots("book", "Noun", engine);

      const base = forms.find((f) => f.tags.includes("BASE"));
      expect(base).toBeDefined();
      expect(base!.value).toBe("book");

      const plural = forms.find((f) => f.tags.includes("PLURAL"));
      expect(plural).toBeDefined();
      expect(plural!.value).toBe("books");
    });

    test("adjective big -> BASE + COMPARATIVE + SUPERLATIVE", () => {
      const forms = generator.generateFromEngineSlots(
        "big",
        "Adjective",
        engine,
      );

      const comp = forms.find((f) => f.tags.includes("COMPARATIVE"));
      expect(comp).toBeDefined();
      expect(comp!.value).toBe("bigger");

      const sup = forms.find((f) => f.tags.includes("SUPERLATIVE"));
      expect(sup).toBeDefined();
      expect(sup!.value).toBe("biggest");
    });

    test("all forms have lang", () => {
      const forms = generator.generateFromEngineSlots(
        "walk",
        "Verb",
        engine,
        "en",
      );
      for (const f of forms) {
        expect(f.lang).toBe("en");
      }
    });

    test("inflected forms have base set", () => {
      const forms = generator.generateFromEngineSlots(
        "go",
        "Verb",
        engine,
        "en",
      );
      const nonBase = forms.filter((f) => !f.tags.includes("BASE"));
      for (const f of nonBase) {
        expect(f.base).toBe("go");
      }
    });
  });

  describe("generateFromGrid3Conditions", () => {
    test("maps person/time conditions to AsTeRICS tags", () => {
      const forms = generator.generateFromGrid3Conditions(
        "walk",
        [
          {
            value: "walks",
            conditions: new Map([
              ["person", "third"],
              ["time", "present"],
            ]),
          },
          {
            value: "walked",
            conditions: new Map([["time", "past"]]),
          },
        ],
        "en",
      );

      const base = forms.find((f) => f.tags.includes("BASE"));
      expect(base).toBeDefined();
      expect(base!.value).toBe("walk");

      const walks = forms.find((f) => f.value === "walks");
      expect(walks).toBeDefined();
      expect(walks!.tags).toContain("3.PERS");

      const walked = forms.find((f) => f.value === "walked");
      expect(walked).toBeDefined();
      expect(walked!.tags).toContain("PAST");
    });

    test("maps participleType to correct tags", () => {
      const forms = generator.generateFromGrid3Conditions(
        "go",
        [
          {
            value: "gone",
            conditions: new Map([["participleType", "pastparticiple"]]),
          },
          {
            value: "going",
            conditions: new Map([["participleType", "presentparticiple"]]),
          },
        ],
        "en",
      );

      const gone = forms.find((f) => f.value === "gone");
      expect(gone).toBeDefined();
      expect(gone!.tags).toContain("PAST");
      expect(gone!.tags).toContain("PARTICIPLE");

      const going = forms.find((f) => f.value === "going");
      expect(going).toBeDefined();
      expect(going!.tags).toContain("GERUND");
    });

    test("deduplicates same value+tags combos", () => {
      const forms = generator.generateFromGrid3Conditions(
        "test",
        [
          { value: "tested", conditions: new Map([["time", "past"]]) },
          { value: "tested", conditions: new Map([["time", "past"]]) },
        ],
        "en",
      );

      const testedForms = forms.filter((f) => f.value === "tested");
      expect(testedForms.length).toBe(1);
    });
  });

  describe("conditionsToTags", () => {
    test("maps person conditions", () => {
      const tags = generator.conditionsToTags(new Map([["person", "first"]]));
      expect(tags).toContain("1.PERS");
    });

    test("maps number conditions", () => {
      const tags = generator.conditionsToTags(new Map([["number", "plural"]]));
      expect(tags).toContain("PLURAL");
    });

    test("maps time conditions", () => {
      const tags = generator.conditionsToTags(new Map([["time", "past"]]));
      expect(tags).toContain("PAST");
    });

    test("returns UNKNOWN for unmapped conditions", () => {
      const tags = generator.conditionsToTags(
        new Map([["unknownDim", "unknownVal"]]),
      );
      expect(tags).toContain("UNKNOWN");
    });
  });

  describe("end-to-end with synthetic XML", () => {
    test("walk via synthetic parser produces correct word forms", () => {
      const parser = new Grid3VerbsParser();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const xml = fs.readFileSync(SYNTHETIC_XML, "utf-8");
      const detailed = parser.parseXmlDetailed(xml);

      const walkForms = detailed.verbs.get("walk");
      expect(walkForms).toBeDefined();

      const astericsForms = generator.generateFromGrid3Conditions(
        "walk",
        walkForms!,
        "en",
      );

      expect(astericsForms.length).toBeGreaterThan(1);
      const base = astericsForms.find((f) => f.tags.includes("BASE"));
      expect(base!.value).toBe("walk");
    });
  });
});
