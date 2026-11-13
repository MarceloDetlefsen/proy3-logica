import {
  $,
  state,
  escapeHTML,
  request,
  currentLanguage,
  currentInterpretation,
} from "./state.js";

export function createEvaluationUI(actions) {
  const resultHost = $("#result");
  const button = $("#evaluate");

  function updateButton() {
    const hasAssignments = state.analysis?.freeVars.every((variable) =>
      state.domain.includes(state.env[variable]),
    );
    button.disabled = !(
      state.langValid &&
      state.interpValid &&
      state.formulaValid &&
      state.analysis &&
      hasAssignments
    );
  }

  function renderExplanation(node, depth = 0) {
    const details = document.createElement("details");
    details.open = depth < 1;
    const heading = document.createElement("summary");
    heading.innerHTML = `<strong>${escapeHTML(node.formula)}</strong>
      <span class="badge">${node.holds ? "verdadero" : "falso"}</span>
      <span class="muted">${escapeHTML(node.rule)}</span>`;
    details.append(heading);

    appendText(details, node.summary, "summary");
    if (node.witness) {
      appendText(
        details,
        `Testigo: ${node.witness.variable} = ${node.witness.value}`,
      );
    }
    if (node.counterexample) {
      appendText(
        details,
        `Contraejemplo: ${node.counterexample.variable} = ${node.counterexample.value}`,
      );
    }
    if (node.checked !== undefined) {
      appendText(
        details,
        `Se revisaron ${node.checked} de ${node.domainSize} elementos del dominio.`,
      );
    }
    if (node.terms?.length) {
      const terms = node.terms
        .map((term) => `${term.term} = ${term.value}`)
        .join(", ");
      appendText(details, `Términos: ${terms}`);
    }
    if (node.env && Object.keys(node.env).length) {
      const environment = Object.entries(node.env)
        .map(([variable, value]) => `${variable} = ${value}`)
        .join(", ");
      appendText(details, `Entorno: ${environment}`);
    }
    if (node.truncated) {
      appendText(details, "El árbol se recortó para mantenerlo legible.");
    }
    if (node.children?.length) {
      const children = document.createElement("div");
      children.className = "tree";
      node.children.forEach((child) => {
        children.append(renderExplanation(child, depth + 1));
      });
      details.append(children);
    }
    return details;
  }

  function appendText(parent, text, className = "") {
    if (!text) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    if (className) paragraph.className = className;
    parent.append(paragraph);
  }

  function renderErrors(errors) {
    const list = document.createElement("ul");
    list.className = "error-list";
    errors.forEach((error) => {
      const item = document.createElement("li");
      item.textContent = `${error.path ? `${error.path}: ` : ""}${error.message}`;
      list.append(item);
    });
    resultHost.append(list);
  }

  async function evaluate() {
    const status = $("#evaluation-status");
    status.textContent = "Evaluando…";
    button.disabled = true;
    resultHost.replaceChildren();

    try {
      const response = await request("/api/evaluate", {
        language: currentLanguage(),
        input: $("#formula-input").value,
        interpretation: currentInterpretation(),
        env: state.env,
      });
      if (response.errors.length) {
        status.textContent = "Corrige los errores para evaluar.";
        renderErrors(response.errors);
        return;
      }

      status.textContent = "";
      const result = response.result;
      const output = document.createElement("div");
      output.className = `result ${result.value ? "truth" : "falsity"}`;
      output.innerHTML = `<div class="result-head"><h3>${result.value ? "Verdadero" : "Falso"}</h3>
        <span class="badge">${escapeHTML(result.formula)}</span></div>`;
      output.append(renderExplanation(result.explanation));
      resultHost.append(output);
    } catch (error) {
      status.textContent = "No se pudo evaluar.";
      appendText(resultHost, error.message, "error-list");
    } finally {
      updateButton();
    }
  }

  button.addEventListener("click", evaluate);
  return { updateButton };
}
