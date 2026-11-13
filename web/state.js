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
