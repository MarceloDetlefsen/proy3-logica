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
import type { Formula, Term, Warning } from "../types.js";

export function createFormulaUI(actions) {
  const input = $("#formula-input") as HTMLTextAreaElement;
  const highlight = $("#formula-highlight");

  function renderHighlight(errors: { start: number; end: number }[] = []) {
    // Array.from separa por caracteres Unicode, igual que []rune en Go. Así los
    // offsets del lexer resaltan correctamente ∀, ¬, → y demás símbolos.
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
    // /api/analyze devuelve AST, libres y rangos de error; aún no requiere una
    // interpretación porque esta fase solamente estudia la fórmula.
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
          // setSelectionRange usa offsets UTF-16. Se reconstruye el prefijo
          // desde el índice de caracteres entregado por Go antes de seleccionar.
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

    const warnings = [
      ...result.warnings,
      ...(result.formula ? quantifierWarnings(result.formula) : []),
    ];
    if (warnings.length) {
      const warningList = document.createElement("ul");
      warningList.className = "warning-list";
      for (const warning of warnings) {
        const item = document.createElement("li");
        item.textContent = `${warning.path ? `${warning.path}: ` : ""}${warning.message}`;
        warningList.append(item);
      }
      host.append(warningList);
    }

    renderFreeVariables(result.errors.length ? [] : result.freeVars);
  }

  function quantifierWarnings(formula: Formula): Warning[] {
    // No invalidan el AST: enseñan cuantificadores vacuos y shadowing recorriendo
    // la estructura que ya validó el parser Go.
    const warnings: Warning[] = [];
    const hasFreeOccurrence = (node: Formula, variable: string): boolean => {
      switch (node.k) {
        case "pred":
          return node.args.some((term) => termHasVariable(term, variable));
        case "eq":
          return (
            termHasVariable(node.left, variable) ||
            termHasVariable(node.right, variable)
          );
        case "not":
          return hasFreeOccurrence(node.f, variable);
        case "bin":
          return (
            hasFreeOccurrence(node.l, variable) ||
            hasFreeOccurrence(node.r, variable)
          );
        case "quant":
          return node.v === variable
            ? false
            : hasFreeOccurrence(node.f, variable);
      }
    };
    const visit = (node: Formula, bound: Set<string>) => {
      switch (node.k) {
        case "eq":
          break;
        case "not":
          visit(node.f, bound);
          break;
        case "bin":
          visit(node.l, bound);
          visit(node.r, bound);
          break;
        case "quant": {
          if (!hasFreeOccurrence(node.f, node.v)) {
            warnings.push({
              kind: "quantifier_vacuous",
              message: `El cuantificador ${node.q === "forall" ? "∀" : "∃"}${node.v} no afecta el valor de su subfórmula.`,
              path: "formula",
            });
          }
          if (bound.has(node.v)) {
            warnings.push({
              kind: "quantifier_shadowed",
              message: `El cuantificador interno vuelve a declarar ${node.v} y oculta la asignación exterior.`,
              path: "formula",
            });
          }
          const next = new Set(bound);
          next.add(node.v);
          visit(node.f, next);
          break;
        }
      }
    };
    visit(formula, new Set());
    return warnings;
  }

  function termHasVariable(term: Term, variable: string): boolean {
    return term.k === "var"
      ? term.name === variable
      : term.args.some((argument) => termHasVariable(argument, variable));
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
    // setRangeText respeta selección y cursor; emitir input reutiliza el mismo
    // camino de análisis que una pulsación del teclado.
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

  async function generateRandomFormula() {
    const button = $("#generate-formula") as HTMLButtonElement;
    const status = $("#formula-generation-status");
    button.disabled = true;
    status.textContent = "Generando fórmula…";
    status.className = "generation-status";
    try {
      const funcs = state.funcs
        .filter((symbol) => symbol.name.trim())
        .map((symbol) => ({ name: symbol.name.trim(), arity: Number(symbol.arity) }));
      const preds = state.preds
        .filter((symbol) => symbol.name.trim())
        .map((symbol) => ({ name: symbol.name.trim(), arity: Number(symbol.arity) }));
      const languageResult = await request("/api/language/validate", { funcs, preds });
      if (languageResult.errors.length) {
        status.textContent = languageResult.errors.map((error) => error.message).join(" ");
        status.className = "generation-status error";
        return;
      }

      // Use the normalized language assembled from the current declarations.
      // The demo API returns submitted declarations while the real API returns
      // maps; this keeps formula generation independent of that response shape.
      const language = currentLanguage();
      // La generación vive en la UI, pero el resultado se somete al analizador
      // real: generar una cadena nunca sustituye la validación del backend.
      const generated = buildRandomFormula(language);
      if (!state.mockMode) {
        const analysis = await request("/api/analyze", { input: generated.input, language });
        if (analysis.errors.length) {
          status.textContent = `El analizador rechazó la fórmula generada: ${analysis.errors.map((error) => error.message).join(" ")}`;
          status.className = "generation-status error";
          return;
        }
        input.value = generated.input;
        state.env = randomEnvironment(analysis.freeVars);
        state.analysis = analysis;
        state.formulaValid = true;
        renderAnalysis(analysis);
        actions.updateEvaluate();
      } else {
        input.value = generated.input;
        state.env = randomEnvironment(generated.freeVars);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      status.textContent = "Fórmula aleatoria generada y validada.";
      status.className = "generation-status valid";
    } catch (error) {
      status.textContent = error.message;
      status.className = "generation-status error";
    } finally {
      button.disabled = false;
    }
  }

  function buildRandomFormula(language: { funcs: Record<string, number>; preds: Record<string, number> }) {
    const functions = Object.entries(language.funcs);
    const predicates = Object.entries(language.preds);
    const reserved = new Set([...functions.map(([name]) => name), ...predicates.map(([name]) => name), "forall", "exists"]);
    const usedVariables = new Set<string>();
    const freeVariables = new Set<string>();
    let variableIndex = 0;

    const freshVariable = () => {
      const candidates = ["x", "y", "z", "u", "v", "w", "t"];
      while (true) {
        const candidate = variableIndex < candidates.length ? candidates[variableIndex] : `v${variableIndex}`;
        variableIndex++;
        if (!reserved.has(candidate) && !usedVariables.has(candidate)) {
          usedVariables.add(candidate);
          return candidate;
        }
      }
    };

    const chooseVariable = (bound: string[]) => {
      if (bound.length && Math.random() < 0.6) {
        return bound[Math.floor(Math.random() * bound.length)];
      }
      const existingFree = [...freeVariables];
      if (existingFree.length && Math.random() < 0.55) {
        return existingFree[Math.floor(Math.random() * existingFree.length)];
      }
      const variable = freshVariable();
      freeVariables.add(variable);
      return variable;
    };

    const term = (bound: string[], depth = 0): string => {
      const canUseFunction = depth < 1 && functions.length > 0 && Math.random() < 0.42;
      if (canUseFunction) {
        const [name, arity] = functions[Math.floor(Math.random() * functions.length)];
        if (arity === 0) return name;
        const args = Array.from({ length: arity }, () => term(bound, depth + 1));
        return `${name}(${args.join(", ")})`;
      }
      const constants = functions.filter(([, arity]) => arity === 0);
      if (constants.length && Math.random() < 0.2) {
        return constants[Math.floor(Math.random() * constants.length)][0];
      }
      return chooseVariable(bound);
    };

    const atom = (bound: string[]) => {
      if (predicates.length && Math.random() < 0.72) {
        const [name, arity] = predicates[Math.floor(Math.random() * predicates.length)];
        const args = Array.from({ length: arity }, () => term(bound));
        return `${name}(${args.join(", ")})`;
      }
      return `${term(bound)} = ${term(bound)}`;
    };

    const formula = (depth: number, bound: string[]): string => {
      if (depth <= 0) return atom(bound);
      const choice = Math.floor(Math.random() * 8);
      if (choice === 0) return `¬(${formula(depth - 1, bound)})`;
      if (choice === 1) {
        const variable = freshVariable();
        const quantifier = Math.random() < 0.5 ? "∀" : "∃";
        return `${quantifier}${variable} (${formula(depth - 1, [...bound, variable])})`;
      }
      const operators = ["∧", "∨", "→", "↔"];
      const operator = operators[choice - 2] || "∧";
      return `(${formula(depth - 1, bound)} ${operator} ${formula(depth - 1, bound)})`;
    };

    return { input: formula(2, []), freeVars: [...freeVariables] };
  }

  function randomEnvironment(variables: string[]) {
    if (!state.domain.length) return {};
    return Object.fromEntries(
      variables.map((variable) => [
        variable,
        state.domain[Math.floor(Math.random() * state.domain.length)],
      ]),
    );
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
  $("#generate-formula").addEventListener("click", generateRandomFormula);

  return { analyze, load: loadFormula, generateRandom: generateRandomFormula };
}
