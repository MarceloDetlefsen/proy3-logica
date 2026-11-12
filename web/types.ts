export type Term =
  | { k: 'var'; name: string }
  | { k: 'app'; fn: string; args: Term[] };

export type Formula =
  | { k: 'pred'; name: string; args: Term[] }
  | { k: 'not'; f: Formula }
  | { k: 'bin'; op: 'and' | 'or' | 'imp' | 'iff'; l: Formula; r: Formula }
  | { k: 'quant'; q: 'forall' | 'exists'; v: string; f: Formula };

export type Interp = {
  domain: string[];
  funcs: Record<string, Record<string, string>>;
  rels: Record<string, string[][]>;
};

export type Env = Record<string, string>;

export type Explanation = {
  holds: boolean;
  rule: string;
  witness?: Env;
  counter?: Env;
  children: Explanation[];
};
