import {
  $,
  state,
  escapeHTML,
  debounce,
  request,
  announce,
  currentLanguage,
  domainOptions,
} from "./state.js";

export function createFormulaUI(actions) {
  const input = $("#formula-input") as HTMLTextAreaElement;
  const highlight = $("#formula-highlight");

  function renderHighlight(errors: { start: number; end: number }[] = []) {
    const characters = Array.from(input.value);
    const ranges = [...errors].sort((left, right) => left.start - right.start);
    let output = "";
    let cursor = 0;
    for (const error of ranges) {
      const start = Math.max(cursor, Math.min(characters.length, error.start));
      const end = Math.max(start, Math.min(characters.length, error.end));
      output += escapeHTML(characters.slice(cursor, start).join(""));
      if (start === end) {
        output += '<span class="error-caret">│</span>';
      } else {
        output += `<mark class="error-range">${escapeHTML(characters.slice(start, end).join(""))}</mark>`;
      }
      cursor = end;
    }
    output += escapeHTML(characters.slice(cursor).join(""));
    highlight.innerHTML = output || " ";
  }

  const analyze = debounce(async () => {
    state.analysis = null;
    if (!input.value.trim()) {
      state.formulaValid = false;
      $("#formula-status").replaceChildren();
      $("#free-vars").replaceChildren();
      announce("formula-status", "Escribe una fórmula para analizarla.");
      actions.updateEvaluate();
      return;
    }

    try {
      const result = await request("/api/analyze", {
        input: input.value,
        language: currentLanguage(),
      });
      state.analysis = result;
      state.formulaValid = result.errors.length === 0;
      renderAnalysis(result);
    } catch (error) {
      state.formulaValid = false;
      announce("formula-status", error.message, "error");
    }
    actions.updateEvaluate();
  }, 250);

  function renderAnalysis(result) {
    const host = $("#formula-status");
    host.replaceChildren();
    host.className = "status";
    renderHighlight(result.errors);

    if (result.errors.length) {
      const list = document.createElement("ul");
      list.className = "error-list";
      for (const error of result.errors) {
        const item = document.createElement("li");
        item.textContent = `${error.message} (${error.start}–${error.end})`;
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute(
          "aria-label",
          `${error.message} Ir al error en la fórmula.`,
        );
        const locateError = () => {
          input.focus();
          const chars = Array.from(input.value);
          const start = chars.slice(0, error.start).join("").length;
          const end = chars.slice(0, error.end).join("").length;
          input.setSelectionRange(start, end);
        };
        item.addEventListener("click", locateError);
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            locateError();
          }
        });
        list.append(item);
      }
      host.append(list);
    } else {
      host.textContent = "Fórmula válida.";
      host.className = "status valid";
    }

    renderFreeVariables(result.errors.length ? [] : result.freeVars);
  }

  function renderFreeVariables(variables) {
    const host = $("#free-vars");
    host.replaceChildren();
    if (!variables.length) return;

    const title = document.createElement("strong");
    title.textContent = `Variables libres: ${variables.join(", ")}`;
    host.append(title);

    const grid = document.createElement("div");
    grid.className = "env-grid";
    for (const variable of variables) {
      const label = document.createElement("label");
      label.innerHTML = `${escapeHTML(variable)}<select class="cell" aria-label="Valor para ${escapeHTML(variable)}">${domainOptions(state.env[variable] || "")}</select>`;
      const select = $("select", label) as HTMLSelectElement;
      select.addEventListener("change", () => {
        state.env[variable] = select.value;
        actions.updateEvaluate();
      });
      grid.append(label);
    }
    host.append(grid);
  }

  function insertAtCursor(symbol) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(symbol, start, end, "end");
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function loadFormula(value, environment = {}) {
    input.value = value;
    state.env = { ...environment };
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  input.addEventListener("input", () => {
    renderHighlight();
    analyze();
  });
  input.addEventListener("scroll", () => {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  });
  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () =>
      insertAtCursor((button as HTMLElement).dataset.insert || ""),
    );
  });

  return { analyze, load: loadFormula };
}
