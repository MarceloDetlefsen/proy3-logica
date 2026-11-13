import {
  $,
  $$,
  state,
  escapeHTML,
  request,
  announce,
  currentLanguage,
  currentInterpretation,
  domainOptions,
} from "./state.js";
import type { Interpretation } from "../types.js";

export function createInterpretationUI(actions) {
  const tables = $("#tables");

  async function validate() {
    try {
      const result = await request("/api/interpretation/validate", {
        language: currentLanguage(),
        interpretation: currentInterpretation(),
      });
      state.interpValid = result.errors.length === 0;
      renderMessages(result.errors, result.warnings);
    } catch (error) {
      state.interpValid = false;
      announce("interpretation-status", error.message, "error");
    }
    actions.updateEvaluate();
  }

  function renderMessages(errors, warnings) {
    const host = $("#interpretation-status");
    $$(".has-error", tables).forEach((element) => {
      element.classList.remove("has-error");
      element.removeAttribute("aria-invalid");
    });
    host.replaceChildren();
    host.className = "status";
    if (!errors.length && !warnings.length) {
      host.textContent = "Interpretación válida.";
      host.className = "status valid";
      return;
    }

    for (const [items, className] of [
      [errors, "error-list"],
      [warnings, "warning-list"],
    ]) {
      if (!items.length) continue;
      const list = document.createElement("ul");
      list.className = className;
      for (const message of items) {
        const item = document.createElement("li");
        item.dataset.path = message.path || "";
        item.textContent = `${message.path ? `${message.path}: ` : ""}${message.message}`;
        if (className === "error-list") markErrorPath(message.path || "");
        list.append(item);
      }
      host.append(list);
    }
  }

  function markErrorPath(path) {
    const section = $$("section[data-symbol]", tables).find((candidate) => {
      const prefix = candidate.dataset.symbolType === "func" ? "funcs" : "rels";
      return (
        path === `${prefix}.${candidate.dataset.symbol}` ||
        path.startsWith(`${prefix}.${candidate.dataset.symbol}[`)
      );
    });
    if (!section) return;
    section.classList.add("has-error");
    const row = $$("tr[data-path]", section).find((candidate) =>
      path.startsWith(candidate.dataset.path),
    );
    if (row) {
      row.classList.add("has-error");
      row.setAttribute("aria-invalid", "true");
    }
  }

  function renderTables() {
    const previousFunctions = state.funcRows;
    const previousRelations = state.relRows;
    state.funcRows = {};
    state.relRows = {};
    tables.replaceChildren();
    const language = currentLanguage();

    for (const [name, arity] of Object.entries(language.funcs)) {
      renderFunctionTable(name, arity, previousFunctions[name]);
    }
    for (const [name, arity] of Object.entries(language.preds)) {
      renderRelationTable(name, arity, previousRelations[name]);
    }
    validate();
  }

  function renderFunctionTable(name, arity, existingRows) {
    const section = document.createElement("section");
    section.dataset.symbol = name;
    section.dataset.symbolType = "func";
    section.innerHTML = `<div class="row-head"><h3>Tabla de ${escapeHTML(name)} <span class="muted">(función, aridad ${arity}${arity === 0 ? ", constante" : ""})</span></h3></div>`;
    const tuples = functionTuples(arity);
    if (tuples === null) {
      state.funcRows[name] = [];
      const warning = document.createElement("p");
      warning.className = "error-list";
      warning.textContent = "La tabla requeriría más de 10 000 filas, el máximo admitido.";
      section.append(warning);
      tables.append(section);
      return;
    }
    const table = document.createElement("table");
    table.className = "table";
    const headers = Array.from(
      { length: arity },
      (_, index) => `<th>Argumento ${index + 1}</th>`,
    ).join("");
    table.innerHTML = `<thead><tr>${headers}<th>Resultado</th></tr></thead><tbody></tbody>`;
    appendTable(section, table);

    const previousValues = new Map(
      (existingRows || [])
        .filter((values) => values.length === arity + 1)
        .map((values) => [
          JSON.stringify(values.slice(0, arity)),
          values[arity] || "",
        ]),
    );
    const rows = (state.funcRows[name] = tuples.map((args) => [
      ...args,
      previousValues.get(JSON.stringify(args)) || "",
    ]));
    const body = $("tbody", table);
    const renderRows = () => {
      body.replaceChildren();
      rows.forEach((values, rowIndex) => {
        const row = document.createElement("tr");
        row.dataset.path = `funcs.${name}[${rowIndex}]`;
        const argumentCells = Array.from({ length: arity }, (_, column) =>
          `<td><span class="tuple-value">${escapeHTML(values[column])}</span></td>`,
        ).join("");
        row.innerHTML = `${argumentCells}${selectCell(name, "resultado", values, arity)}`;
        bindSelects(row, values);
        body.append(row);
      });
    };

    renderRows();
  }

  function functionTuples(arity) {
    if (arity === 0) return [[]];
    if (arity < 0 || state.domain.length === 0) return [];
    let count = 1;
    for (let position = 0; position < arity; position++) {
      count *= state.domain.length;
      if (count > 10_000) return null;
    }
    let tuples = [[]];
    for (let position = 0; position < arity; position++) {
      tuples = tuples.flatMap((prefix) =>
        state.domain.map((value) => [...prefix, value]),
      );
    }
    return tuples;
  }

  function renderRelationTable(name, arity, existingRows) {
    const section = document.createElement("section");
    section.dataset.symbol = name;
    section.dataset.symbolType = "rel";
    section.innerHTML = `<div class="row-head"><h3>Relación ${escapeHTML(name)} <span class="muted">(aridad ${arity})</span></h3>
      <button class="button small add-row">＋ Tupla</button></div>`;
    const table = document.createElement("table");
    table.className = "table";
    const headers = Array.from(
      { length: arity },
      (_, index) => `<th>Posición ${index + 1}</th>`,
    ).join("");
    table.innerHTML = `<thead><tr>${headers}<th></th></tr></thead><tbody></tbody>`;
    appendTable(section, table);

    const rows = (state.relRows[name] = existingRows || [
      Array(arity).fill(""),
    ]);
    const body = $("tbody", table);
    const renderRows = () => {
      body.replaceChildren();
      rows.forEach((values, rowIndex) => {
        const row = document.createElement("tr");
        row.dataset.path = `rels.${name}[${rowIndex}]`;
        const cells = Array.from({ length: arity }, (_, column) =>
          selectCell(name, `posición ${column + 1}`, values, column),
        ).join("");
        row.innerHTML = `${cells}<td><button class="button danger small remove-row" aria-label="Eliminar tupla">×</button></td>`;
        bindSelects(row, values);
        $(".remove-row", row).addEventListener("click", () => {
          rows.splice(rowIndex, 1);
          renderRows();
          validate();
        });
        body.append(row);
      });
    };

    renderRows();
    $(".add-row", section).addEventListener("click", () => {
      rows.push(Array(arity).fill(""));
      renderRows();
    });
  }

  function appendTable(section, table) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    wrapper.append(table);
    section.append(wrapper);
    tables.append(section);
  }

  function selectCell(name, label, values, column) {
    return `<td><select class="cell" aria-label="${escapeHTML(name)} ${label}" data-col="${column}">${domainOptions(values[column])}</select></td>`;
  }

  function bindSelects(row, values) {
    $$<HTMLSelectElement>("select", row).forEach((select) => {
      select.addEventListener("change", () => {
        values[Number(select.dataset.col)] = select.value;
        validate();
      });
    });
  }

  function renderDomain() {
    const host = $("#domain-chips");
    host.replaceChildren();
    state.domain.forEach((value, index) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${escapeHTML(value)} <button aria-label="Quitar ${escapeHTML(value)}" title="Quitar">×</button>`;
      $("button", chip).addEventListener("click", () => {
        state.domain.splice(index, 1);
        renderDomain();
        renderTables();
        actions.analyze();
      });
      host.append(chip);
    });
  }

  function addDomain() {
    const field = $("#domain-input") as HTMLInputElement;
    const value = field.value.trim();
    if (!value) return;
    if (state.domain.includes(value)) {
      announce(
        "interpretation-status",
        `El elemento ${value} ya está en el dominio.`,
        "error",
      );
      return;
    }
    state.domain.push(value);
    field.value = "";
    renderDomain();
    renderTables();
    actions.analyze();
  }

  function loadInterpretation(interpretation: Interpretation) {
    state.domain = [...(interpretation.domain || [])];
    state.funcRows = Object.fromEntries(
      Object.entries(interpretation.funcs || {}).map(([name, entries]) => [
        name,
        entries.map((entry) => [...entry.args, entry.value]),
      ]),
    );
    state.relRows = Object.fromEntries(
      Object.entries(interpretation.rels || {}).map(([name, tuples]) => [
        name,
        tuples.map((tuple) => [...tuple]),
      ]),
    );
    renderDomain();
    renderTables();
    actions.analyze();
  }

  $("#add-domain").addEventListener("click", addDomain);
  $("#domain-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDomain();
    }
  });

  return { renderTables, validate, renderDomain, load: loadInterpretation };
}
