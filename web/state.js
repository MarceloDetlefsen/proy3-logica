export const state = {
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

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

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

export async function request(path, body) {
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

function mockRequest(path, body) {
  const example = state.example;
  if (!example) {
    if (path === "/api/language/validate") {
      return Promise.resolve({
        language: { funcs: {}, preds: {} },
        errors: [],
      });
    }
    if (path === "/api/interpretation/validate") {
      return Promise.resolve({ errors: [], warnings: [] });
    }
    if (path === "/api/analyze") {
      return Promise.resolve({ freeVars: [], warnings: [], errors: [] });
    }
    return Promise.resolve({ errors: [], warnings: [] });
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
    const explanation = {
      holds: value,
      rule: "mock",
      formula: example.input,
      summary: "Resultado de ejemplo precalculado para recorrer la interfaz.",
      env: example.env || {},
      children: [],
    };
    if (example.expect?.witness) explanation.witness = example.expect.witness;
    if (example.expect?.counterexample) {
      explanation.counterexample = example.expect.counterexample;
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

function mockErrors(codes) {
  return codes.map((code) => ({
    code,
    message: `El ejemplo contiene el caso ${code}.`,
    start: 0,
    end: 0,
    path: code.startsWith("ENV_") ? "env" : undefined,
  }));
}

function mockFreeVariables(example) {
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
