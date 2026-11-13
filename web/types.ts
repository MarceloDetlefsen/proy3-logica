export type Term =
  { k: "var"; name: string } | { k: "app"; fn: string; args: Term[] };

export type Formula =
  | { k: "pred"; name: string; args: Term[] }
  | { k: "not"; f: Formula }
  | { k: "bin"; op: "and" | "or" | "imp" | "iff"; l: Formula; r: Formula }
  | { k: "quant"; q: "forall" | "exists"; v: string; f: Formula };

export type Language = {
  funcs: Record<string, number>;
  preds: Record<string, number>;
};

export type SymbolDecl = {
  name: string;
  arity: number;
};

export type ValidateLanguageRequest = {
  funcs: SymbolDecl[];
  preds: SymbolDecl[];
};

export type ValidateLanguageResponse = {
  language: Language;
  errors: LogicError[];
};

export type AnalyzeRequest = {
  input: string;
  language: Language;
};

export type AnalyzeResponse = {
  formula?: Formula;
  freeVars: string[];
  warnings: Warning[];
  errors: LogicError[];
};

export type LogicError = {
  code: string;
  message: string;
  start: number;
  end: number;
  path?: string;
};

export type WarningKind =
  | "duplicate_tuple"
  | "extra_env"
  | "quantifier_vacuous"
  | "quantifier_shadowed";

export type Warning = {
  kind: WarningKind;
  message: string;
  path?: string;
};

export type FuncEntry = {
  args: string[];
  value: string;
};

export type Interpretation = {
  domain: string[];
  funcs: Record<string, FuncEntry[]>;
  rels: Record<string, string[][]>;
};

export type Interp = Interpretation;

export type Env = Record<string, string>;

export type ExplanationBinding = {
  variable: string;
  value: string;
};

export type Explanation = {
  holds: boolean;
  rule:
    | "pred"
    | "not"
    | "and"
    | "or"
    | "imp"
    | "iff"
    | "forall"
    | "exists"
    | "mock";
  formula: string;
  summary: string;
  env: Record<string, string>;
  terms?: { term: string; value: string }[];
  witness?: { variable: string; value: string };
  counterexample?: { variable: string; value: string };
  checked?: number;
  domainSize?: number;
  decisive?: number[];
  truncated?: boolean;
  children: Explanation[];
};

export type InterpretationValidateRequest = {
  language: Language;
  interpretation: Interpretation;
};

export type InterpretationValidateResponse = {
  errors: LogicError[];
  warnings: Warning[];
};

export type EvaluateRequest = {
  language: Language;
  input: string;
  interpretation: Interpretation;
  env: Env;
};

export type EvaluateResult = {
  value: boolean;
  formula: string;
  freeVars: string[];
  explanation: Explanation;
};

export type EvaluateResponse = {
  errors: LogicError[];
  warnings: Warning[];
  result?: EvaluateResult;
};
