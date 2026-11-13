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
        list.append(item);
      }
      host.append(list);
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
    section.innerHTML = `<div class="row-head"><h3>Tabla de ${escapeHTML(name)} <span class="muted">(función, aridad ${arity}${arity === 0 ? ", constante" : ""})</span></h3>
      <button class="button small add-row">＋ Fila</button></div>`;
    const table = document.createElement("table");
    table.className = "table";
    const headers = Array.from(
      { length: arity },
      (_, index) => `<th>Argumento ${index + 1}</th>`,
    ).join("");
    table.innerHTML = `<thead><tr>${headers}<th>Resultado</th><th></th></tr></thead><tbody></tbody>`;
    appendTable(section, table);

    const rows = (state.funcRows[name] = existingRows || [
      Array(arity + 1).fill(""),
    ]);
    const body = $("tbody", table);
    const renderRows = () => {
      body.replaceChildren();
      rows.forEach((values, rowIndex) => {
        const row = document.createElement("tr");
        const argumentCells = Array.from({ length: arity }, (_, column) =>
          selectCell(name, `argumento ${column + 1}`, values, column),
        ).join("");
        row.innerHTML = `${argumentCells}${selectCell(name, "resultado", values, arity)}
          <td><button class="button danger small remove-row" aria-label="Eliminar fila">×</button></td>`;
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
      rows.push(Array(arity + 1).fill(""));
      renderRows();
    });
  }

  function renderRelationTable(name, arity, existingRows) {
    const section = document.createElement("section");
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
    $$("select", row).forEach((select) => {
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
    const field = $("#domain-input");
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

  $("#add-domain").addEventListener("click", addDomain);
  $("#domain-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDomain();
    }
  });

  return { renderTables, validate, renderDomain };
}
