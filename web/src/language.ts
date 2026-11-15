import {
  $,
  state,
  escapeHTML,
  debounce,
  request,
  currentLanguage,
} from "./state.js";
import type { Language } from "../types.js";

export function createLanguageUI(actions) {
  const funcsHost = $("#func-list");
  const predsHost = $("#pred-list");
  let errorSequence = 0;
  let hasInteracted = false;
  const touchedSymbols = new WeakSet<object>();

  function declarations() {
    const toDeclarations = (symbols) =>
      symbols
        .filter((symbol) => symbol.name.trim() || touchedSymbols.has(symbol))
        .map((symbol) => ({
          name: symbol.name.trim(),
          arity: Number(symbol.arity),
        }));
    return {
      funcs: toDeclarations(state.funcs),
      preds: toDeclarations(state.preds),
    };
  }

  function renderErrors(errors) {
    const host = $("#language-status");
    clearRowErrors();
    host.replaceChildren();
    if (!errors.length) {
      host.textContent = "Lenguaje válido.";
      host.className = "status valid";
      return;
    }

    host.className = "status";
    const list = document.createElement("ul");
    list.className = "error-list";
    for (const error of errors) {
      const item = document.createElement("li");
      item.textContent = error.message;
      list.append(item);
      markRowError(error.message);
    }
    host.append(list);
  }

  function clearRowErrors() {
    document.querySelectorAll(".symbol-row.has-error").forEach((row) => {
      row.classList.remove("has-error");
      row.removeAttribute("aria-invalid");
      row.querySelectorAll("[aria-invalid=true]").forEach((field) => {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      });
      row.querySelector(".field-error")?.remove();
    });
  }

  function markRowError(message: string) {
    const quotedName = message.match(/["“]([^"”]*)["”]/)?.[1];
    if (quotedName === undefined) return;

    const rows = [...document.querySelectorAll<HTMLElement>(".symbol-row")];
    const kind = message.includes("ya fue declarado")
      ? ""
      : message.includes("predicado")
        ? "pred"
        : message.includes("función")
          ? "func"
          : "";
    const matches = rows.filter((row) =>
      row.dataset.symbolName === quotedName && (!kind || row.dataset.symbolKind === kind),
    );
    for (const row of matches) {
      row.classList.add("has-error");
      row.setAttribute("aria-invalid", "true");
      const field = message.includes("aridad")
        ? row.querySelector<HTMLInputElement>(".symbol-arity")
        : row.querySelector<HTMLInputElement>(".symbol-name");
      field?.setAttribute("aria-invalid", "true");
      if (field) {
        const description = document.createElement("span");
        description.className = "field-error";
        description.id = `language-error-${errorSequence++}`;
        description.setAttribute("role", "alert");
        description.textContent = message;
        field.setAttribute("aria-describedby", description.id);
        row.append(description);
      }
    }
  }

  const validate = debounce(async () => {
    const hasNamedSymbol = [...state.funcs, ...state.preds].some((symbol) =>
      symbol.name.trim(),
    );
    if (
      !hasInteracted &&
      !state.example &&
      !hasNamedSymbol
    ) {
      state.langValid = false;
      const host = $("#language-status");
      host.replaceChildren();
      host.className = "status";
      actions.updateEvaluate();
      return;
    }
    try {
      const result = await request("/api/language/validate", declarations());
      state.langValid = result.errors.length === 0;
      state.languageErrors = result.errors;
      renderErrors(result.errors);
      actions.renderTables();
      actions.validateInterpretation();
      actions.analyze();
      actions.updateEvaluate();
    } catch (error) {
      state.langValid = false;
      state.languageErrors = [];
      const host = $("#language-status");
      host.textContent = error.message;
      host.className = "status error";
      actions.updateEvaluate();
    }
  }, 200);

  function renderSymbols(kind) {
    const isFunction = kind === "func";
    const symbols = isFunction ? state.funcs : state.preds;
    const host = isFunction ? funcsHost : predsHost;
    host.replaceChildren();

    symbols.forEach((symbol, index) => {
      const row = document.createElement("div");
      row.className = "symbol-row";
      row.dataset.symbolName = symbol.name.trim();
      row.dataset.symbolKind = kind;
      const label = isFunction ? "de función" : "de predicado";
      row.innerHTML = `<label class="sr-only">Nombre ${label}</label>
        <input class="input symbol-name" aria-label="Nombre ${label}" value="${escapeHTML(symbol.name)}" placeholder="${isFunction ? "f" : "P"}">
        <label class="sr-only">Aridad${isFunction ? " (0 indica constante)" : ""}</label>
        <input class="input symbol-arity" aria-label="Aridad${isFunction ? " (0 indica constante)" : ""}" type="number" min="${isFunction ? 0 : 1}" max="100" value="${symbol.arity}">
        <button class="button danger small remove-symbol" aria-label="Eliminar símbolo">Eliminar</button>`;

      $(".symbol-name", row).addEventListener("input", (event) => {
        hasInteracted = true;
        touchedSymbols.add(symbol);
        symbols[index].name = (event.currentTarget as HTMLInputElement).value;
        row.dataset.symbolName = symbols[index].name.trim();
        validate();
      });
      $(".symbol-arity", row).addEventListener("input", (event) => {
        hasInteracted = true;
        touchedSymbols.add(symbol);
        const input = event.currentTarget as HTMLInputElement;
        symbols[index].arity = input.value === "" ? "" : Number(input.value);
        validate();
      });
      $(".remove-symbol", row).addEventListener("click", () => {
        hasInteracted = true;
        symbols.splice(index, 1);
        renderAll();
      });
      host.append(row);
    });
  }

  function renderAll() {
    renderSymbols("func");
    renderSymbols("pred");
    actions.renderTables();
    validate();
  }

  function loadLanguage(language: Language) {
    hasInteracted = true;
    state.funcs = Object.entries(language.funcs || {}).map(([name, arity]) => ({
      name,
      arity,
    }));
    state.preds = Object.entries(language.preds || {}).map(([name, arity]) => ({
      name,
      arity,
    }));
    renderAll();
  }

  function clearLanguage() {
    hasInteracted = false;
    state.example = null;
    state.funcs = [{ name: "", arity: 1 }];
    state.preds = [{ name: "", arity: 1 }];
    state.languageErrors = [];
    state.langValid = false;
    renderSymbols("func");
    renderSymbols("pred");
    actions.renderTables();
    actions.validateInterpretation();
    actions.analyze();
    actions.updateEvaluate();
    actions.updateSummary?.();
    const host = $("#language-status");
    host.textContent = "Lenguaje limpiado. Empieza a declarar símbolos desde cero.";
    host.className = "status";
    (funcsHost.querySelector(".symbol-name") as HTMLInputElement | null)?.focus();
  }

  $("#clear-language")?.addEventListener("click", clearLanguage);

  $("#add-func").addEventListener("click", () => {
    const emptyIndex = state.funcs.findIndex((symbol) => !symbol.name.trim());
    if (emptyIndex >= 0) {
      $(".symbol-name", funcsHost.children[emptyIndex]).focus();
      return;
    }
    hasInteracted = true;
    state.funcs.push({ name: "", arity: 1 });
    renderSymbols("func");
    validate();
  });
  $("#add-pred").addEventListener("click", () => {
    const emptyIndex = state.preds.findIndex((symbol) => !symbol.name.trim());
    if (emptyIndex >= 0) {
      $(".symbol-name", predsHost.children[emptyIndex]).focus();
      return;
    }
    hasInteracted = true;
    state.preds.push({ name: "", arity: 1 });
    renderSymbols("pred");
    validate();
  });

  state.funcs = [{ name: "", arity: 1 }];
  state.preds = [{ name: "", arity: 1 }];
  renderAll();

  return {
    getLanguage: currentLanguage,
    validate,
    load: loadLanguage,
  };
}
