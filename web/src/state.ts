import type {
  AnalyzeResponse,
  Env,
  EvaluateResponse,
  Explanation,
  ExplanationBinding,
  Interpretation,
  Language,
  LogicError,
  ValidateLanguageRequest,
  ValidateLanguageResponse,
} from "../types.js";

export type EditableSymbol = { name: string; arity: number | "" };

export type DemoExample = {
  name: string;
  description: string;
  language: Language;
  input: string;
  interpretation: Interpretation;
  env: Env;
  expect: {
    errorCodes: string[];
    value?: boolean;
    witness?: ExplanationBinding;
    counterexample?: ExplanationBinding;
    explanation?: Explanation;
  };
};

export const state: {
  funcs: EditableSymbol[];
  preds: EditableSymbol[];
  domain: string[];
  funcRows: Record<string, string[][]>;
  relRows: Record<string, string[][]>;
  env: Env;
  analysis: AnalyzeResponse | null;
  langValid: boolean;
  interpValid: boolean;
  formulaValid: boolean;
  mockMode: boolean;
  example: DemoExample | null;
} = {
  funcs: [],
  preds: [],
  domain: [],
  funcRows: {},
  relRows: {},
  env: {},
  analysis: null,
  langValid: false,
  interpValid: false,
  formulaValid: false,
  mockMode: new URLSearchParams(location.search).get("mock") === "1",
  example: null,
};

export const $ = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T => root.querySelector<T>(selector) as T;
export const $$ = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] => [...root.querySelectorAll<T>(selector)];

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

export function debounce(callback, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

export function request(
  path: "/api/language/validate",
  body: ValidateLanguageRequest,
): Promise<ValidateLanguageResponse>;
export function request(
  path: "/api/interpretation/validate",
  body: { language: Language; interpretation: Interpretation },
): Promise<{
  errors: LogicError[];
  warnings: { message: string; path?: string }[];
}>;
export function request(
  path: "/api/analyze",
  body: { input: string; language: Language },
): Promise<AnalyzeResponse>;
export function request(
  path: "/api/evaluate",
  body: {
    input: string;
    language: Language;
    interpretation: Interpretation;
    env: Env;
  },
): Promise<EvaluateResponse>;
export async function request(path: string, body: unknown): Promise<any> {
  if (state.mockMode) {
    return mockRequest(path, body);
  }
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Error HTTP ${response.status}`);
  }
  return data;
}

function mockRequest(path: string, body: any): Promise<any> {
  const example = state.example;
  if (!example) {
    if (path === "/api/language/validate") {
      return Promise.resolve({ language: body, errors: [] });
    }
    if (path === "/api/interpretation/validate") {
      return Promise.resolve({ errors: mockErrors(["DOMAIN_EMPTY"]), warnings: [] });
    }
    return Promise.resolve({
      freeVars: [],
      warnings: [],
      errors: mockErrors(["MOCK_NO_EXAMPLE"]),
    });
  }

  const codes = example.expect?.errorCodes || [];
  const validationCodes = new Set([
    "DOMAIN_EMPTY",
    "DOMAIN_INVALID_ELEMENT",
    "DOMAIN_DUPLICATE",
    "FUNC_MISSING",
    "FUNC_UNKNOWN",
    "FUNC_EMPTY",
    "FUNC_ARITY",
    "FUNC_NOT_IN_DOMAIN",
    "FUNC_DUPLICATE",
    "FUNC_INCOMPLETE",
    "REL_MISSING",
    "REL_UNKNOWN",
    "REL_EMPTY",
    "REL_ARITY",
    "REL_NOT_IN_DOMAIN",
    "LIMIT_EXCEEDED",
  ]);
  if (path === "/api/language/validate") {
    return Promise.resolve({ language: body, errors: [] });
  }
  if (path === "/api/interpretation/validate") {
    return Promise.resolve({
      errors: mockErrors(codes.filter((code) => validationCodes.has(code))),
      warnings: [],
    });
  }
  if (path === "/api/analyze") {
    const errors = codes.includes("UNDECLARED_SYMBOL")
      ? mockErrors(["UNDECLARED_SYMBOL"])
      : [];
    return Promise.resolve({
      freeVars: mockFreeVariables(example),
      warnings: [],
      errors,
    });
  }
  if (path === "/api/evaluate") {
    if (codes.length) {
      return Promise.resolve({ errors: mockErrors(codes), warnings: [] });
    }
    const value = Boolean(example.expect?.value);
    const explanation = example.expect.explanation;
    if (!explanation) {
      return Promise.reject(
        new Error("Este ejemplo todavía no incluye un árbol de explicación."),
      );
    }
    return Promise.resolve({
      errors: [],
      warnings: [],
      result: {
        value,
        formula: example.input,
        freeVars: mockFreeVariables(example),
        explanation,
      },
    });
  }
  return Promise.reject(new Error(`Endpoint mock desconocido: ${path}`));
}

function mockErrors(codes: string[]): LogicError[] {
  return codes.map((code) => ({
    code,
    message: `El ejemplo contiene el caso ${code}.`,
    start: 0,
    end: 0,
    path: code.startsWith("ENV_")
      ? "env"
      : code === "DOMAIN_EMPTY"
        ? "domain"
        : undefined,
  }));
}

function mockFreeVariables(example: DemoExample): string[] {
  const assignedVariables = Object.keys(example.env || {});
  if (assignedVariables.length) return assignedVariables;
  const quantified = new Set(
    [
      ...example.input.matchAll(
        /(?:∀|∃|forall|exists)\s*([\p{L}_][\p{L}\p{N}_]*)/giu,
      ),
    ].map((match) => match[1]),
  );
  const declared = new Set([
    ...Object.keys(example.language.funcs || {}),
    ...Object.keys(example.language.preds || {}),
    "forall",
    "exists",
  ]);
  const variables = [];
  for (const match of example.input.matchAll(/[\p{L}_][\p{L}\p{N}_]*/gu)) {
    const name = match[0];
    if (
      !declared.has(name) &&
      !quantified.has(name) &&
      !variables.includes(name)
    ) {
      variables.push(name);
    }
  }
  return variables;
}

export function announce(id, message, type = "") {
  const node = $(`#${id}`);
  node.className = `status ${type}`;
  node.textContent = message;
}

export function currentLanguage() {
  const funcs = {};
  const preds = {};
  for (const symbol of state.funcs) {
    if (symbol.name.trim() && Number.isInteger(Number(symbol.arity))) {
      funcs[symbol.name.trim()] = Number(symbol.arity);
    }
  }
  for (const symbol of state.preds) {
    if (symbol.name.trim() && Number.isInteger(Number(symbol.arity))) {
      preds[symbol.name.trim()] = Number(symbol.arity);
    }
  }
  return { funcs, preds };
}

export function currentInterpretation() {
  const funcs = {};
  const rels = {};
  for (const [name, rows] of Object.entries(state.funcRows)) {
    funcs[name] = rows.map((row) => ({
      args: row.slice(0, -1),
      value: row.at(-1) || "",
    }));
  }
  for (const [name, rows] of Object.entries(state.relRows)) {
    rels[name] = rows.map((row) => [...row]);
  }
  return { domain: [...state.domain], funcs, rels };
}

export function domainOptions(selected = "") {
  return `<option value="">Selecciona…</option>${state.domain
    .map(
      (value) =>
        `<option value="${escapeHTML(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`,
    )
    .join("")}`;
}
