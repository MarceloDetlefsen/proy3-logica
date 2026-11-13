import {
  $,
  state,
  escapeHTML,
  debounce,
  request,
  currentLanguage,
} from "./state.js";

export function createLanguageUI(actions) {
  const funcsHost = $("#func-list");
  const predsHost = $("#pred-list");

  function declarations() {
    const toDeclarations = (symbols) =>
      symbols.map((symbol) => ({
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
    }
    host.append(list);
  }

  const validate = debounce(async () => {
    try {
      const result = await request("/api/language/validate", declarations());
      state.langValid = result.errors.length === 0;
      renderErrors(result.errors);
      actions.renderTables();
      actions.validateInterpretation();
      actions.analyze();
      actions.updateEvaluate();
    } catch (error) {
      state.langValid = false;
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
      const label = isFunction ? "de función" : "de predicado";
      row.innerHTML = `<label class="sr-only">Nombre ${label}</label>
        <input class="input symbol-name" aria-label="Nombre ${label}" value="${escapeHTML(symbol.name)}" placeholder="${isFunction ? "f" : "P"}">
        <label class="sr-only">Aridad${isFunction ? " (0 indica constante)" : ""}</label>
        <input class="input symbol-arity" aria-label="Aridad${isFunction ? " (0 indica constante)" : ""}" type="number" min="${isFunction ? 0 : 1}" max="100" value="${symbol.arity}">
        <button class="button danger small remove-symbol" aria-label="Eliminar símbolo">Eliminar</button>`;

      $(".symbol-name", row).addEventListener("input", (event) => {
        symbols[index].name = event.target.value;
        validate();
      });
      $(".symbol-arity", row).addEventListener("input", (event) => {
        symbols[index].arity =
          event.target.value === "" ? "" : Number(event.target.value);
        validate();
      });
      $(".remove-symbol", row).addEventListener("click", () => {
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

  function loadLanguage(language) {
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

  $("#add-func").addEventListener("click", () => {
    state.funcs.push({ name: "", arity: 1 });
    renderSymbols("func");
    validate();
  });
  $("#add-pred").addEventListener("click", () => {
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
