export interface MorphRule {
  match: string;
  replace: string;
}

export interface MorphRuleSet {
  locale: string;
  version: number;
  irregular: {
    [pos: string]: {
      [baseWord: string]: { [slot: string]: string | string[] };
    };
  };
  regular: {
    [pos: string]: {
      [slot: string]: MorphRule[] | string;
    };
  };
}

export interface MorphWordForms {
  base: string;
  pos: string;
  forms: string[];
}

export interface AstericsWordForm {
  lang?: string;
  tags: string[];
  value: string;
  pronunciation?: string;
  base?: string;
}

export interface VerbFormWithConditions {
  value: string;
  conditions: Map<string, string>;
}

export interface Grid3VerbFormsDetailed {
  locale: string;
  verbs: Map<string, VerbFormWithConditions[]>;
}
