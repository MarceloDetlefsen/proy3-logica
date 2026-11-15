import {
  $,
  state,
  escapeHTML,
  request,
  currentLanguage,
  currentInterpretation,
} from "./state.js";
import { getTransport, isWasmMode } from "./api.js";
import type { ModelSearchExample, ModelSearchResponse } from "../types.js";

export function createEvaluationUI(actions) {
  const resultHost = $("#result");
  const button = $("#evaluate") as HTMLButtonElement;
  let evaluationSteps: HTMLDetailsElement[] = [];
  const searchButton = $("#search-models") as HTMLButtonElement;
  const searchHost = $("#model-search-results");
  const searchStatus = $("#model-search-status");
  const ruleLabels = {
    pred: "Predicado",
    eq: "Igualdad",
    not: "Negación",
    and: "Conjunción",
    or: "Disyunción",
    imp: "Implicación",
    iff: "Bicondicional",
    forall: "Universal",
    exists: "Existencial",
    mock: "Explicación",
  };

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
    details.open = false;
    details.dataset.evaluationStep = String(evaluationSteps.length);
    evaluationSteps.push(details);
    const heading = document.createElement("summary");
    heading.innerHTML = `<strong>${escapeHTML(node.formula)}</strong>
      <span class="badge">${node.holds ? "verdadero" : "falso"}</span>
      <span class="muted">${ruleLabels[node.rule] || "Explicación"}</span>`;
    details.append(heading);

    appendText(details, node.summary, "summary");
    if (node.witness) {
      appendBinding(details, "Testigo", node.witness);
    }
    if (node.counterexample) {
      appendBinding(details, "Contraejemplo", node.counterexample);
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
      node.children.forEach((child, index) => {
        const childDetails = renderExplanation(child, depth + 1);
        if (node.decisive?.includes(index)) {
          childDetails.classList.add("decisive-branch");
        }
        children.append(childDetails);
      });
      details.append(children);
    }
    return details;
  }

  function appendBinding(parent, label, binding) {
    const item = document.createElement("p");
    item.className = "decisive-binding";
    item.textContent = `${label} decisivo: ${binding.variable} = ${binding.value}`;
    parent.append(item);
  }

  function createStepControls() {
    const controls = document.createElement("nav");
    controls.className = "evaluation-steps";
    controls.setAttribute("aria-label", "Recorrido paso a paso del árbol");

    const previous = document.createElement("button");
    previous.className = "button small";
    previous.type = "button";
    previous.textContent = "← Retroceder";

    const status = document.createElement("span");
    status.className = "evaluation-step-status";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    const next = document.createElement("button");
    next.className = "button small primary";
    next.type = "button";
    next.textContent = "Revelar siguiente nodo →";

    controls.append(previous, status, next);
    let activeIndex = 0;

    function showStep(index) {
      activeIndex = Math.max(0, Math.min(index, evaluationSteps.length - 1));
      const active = evaluationSteps[activeIndex];
      evaluationSteps.forEach((step, stepIndex) => {
        step.classList.toggle("step-current", stepIndex === activeIndex);
        step.classList.toggle("step-visited", stepIndex < activeIndex);
        step.hidden = stepIndex > activeIndex;
        step.open = stepIndex <= activeIndex;
      });

      const formula = $("summary strong", active).textContent || "subfórmula";
      const explanation = $(".summary", active)?.textContent || "";
      status.textContent = `Paso ${activeIndex + 1} de ${evaluationSteps.length}: ${formula}. ${explanation}`;
      previous.disabled = activeIndex === 0;
      next.disabled = activeIndex === evaluationSteps.length - 1;
      if (active.isConnected) active.scrollIntoView({ block: "nearest" });
    }

    previous.addEventListener("click", () => showStep(activeIndex - 1));
    next.addEventListener("click", () => showStep(activeIndex + 1));
    showStep(0);
    return controls;
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

  function renderWarnings(warnings) {
    if (!warnings.length) return;
    const list = document.createElement("ul");
    list.className = "warning-list";
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = `${warning.path ? `${warning.path}: ` : ""}${warning.message}`;
      list.append(item);
    });
    resultHost.append(list);
  }

  function renderSearchExample(label: string, example: ModelSearchExample) {
    const card = document.createElement("details");
    card.className = "model-search-result";
    const heading = document.createElement("summary");
    heading.textContent = label;
    card.append(heading);
    const { interpretation, env } = example;
    const lines = ["Dominio: {" + interpretation.domain.join(", ") + "}"];
    for (const [name, entries] of Object.entries(interpretation.funcs)) {
      for (const entry of entries) lines.push(`${name}(${entry.args.join(", ")}) = ${entry.value}`);
    }
    for (const [name, tuples] of Object.entries(interpretation.rels)) {
      lines.push(`${name} = {${tuples.map((tuple) => `(${tuple.join(", ")})`).join(", ")}}`);
    }
    if (Object.keys(env).length) lines.push("Asignación: " + Object.entries(env).map(([variable, value]) => `${variable} = ${value}`).join(", "));
    const pre = document.createElement("pre");
    pre.textContent = lines.join("\n");
    card.append(pre);
    searchHost.append(card);
  }

  async function searchModels() {
    searchButton.disabled = true;
    searchHost.replaceChildren();
    searchStatus.textContent = "Enumerando modelos finitos…";
    try {
      const input = Number(($<HTMLInputElement>("#model-search-limit")).value);
      const response = await request("/api/models/search", {
        language: currentLanguage(),
        input: ($<HTMLTextAreaElement>("#formula-input")).value,
        maxDomainSize: input,
      }) as ModelSearchResponse;
      if (response.errors?.length) {
        searchStatus.textContent = response.errors.map((error) => error.message).join(" ");
        return;
      }
      if (response.satisfying) renderSearchExample("Modelo: la fórmula resulta verdadera", response.satisfying);
      if (response.falsifying) renderSearchExample("Contramodelo: la fórmula resulta falsa", response.falsifying);
      if (response.satisfying && response.falsifying) {
        searchStatus.textContent = `Se encontraron un modelo y un contramodelo tras revisar ${response.checked} interpretaciones y evaluar ${response.evaluated} asignaciones (N = ${response.maxDomainSize}).`;
      } else if (response.complete) {
        searchStatus.textContent = response.satisfying || response.falsifying
          ? `Búsqueda exhaustiva hasta N = ${response.maxDomainSize}; se revisaron ${response.checked} interpretaciones (${response.evaluated} asignaciones) y se encontró ${response.satisfying ? "un modelo" : "un contramodelo"}.`
          : `La búsqueda exhaustiva no encontró modelo ni contramodelo hasta N = ${response.maxDomainSize}.`;
      } else {
        searchStatus.textContent = `Búsqueda parcial: se revisaron ${response.checked} interpretaciones y ${response.evaluated} asignaciones hasta N = ${response.maxDomainSize}. ${response.satisfying ? "Se encontró un modelo. " : ""}${response.falsifying ? "Se encontró un contramodelo. " : ""}El límite de búsqueda impidió una conclusión exhaustiva.`;
      }
    } catch (error) {
      searchStatus.textContent = error.message || "No se pudo completar la búsqueda.";
    } finally {
      searchButton.disabled = false;
    }
  }

  async function evaluate() {
    const status = $("#evaluation-status");
    status.textContent = "Evaluando…";
    button.disabled = true;
    resultHost.replaceChildren();

    try {
      const response = await request("/api/evaluate", {
        language: currentLanguage(),
        input: ($("#formula-input") as HTMLTextAreaElement).value,
        interpretation: currentInterpretation(),
        env: state.env,
      });
      renderWarnings(response.warnings);
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
      const exportControls = document.createElement("div");
      exportControls.className = "pdf-export-controls";
      const wasmMode = isWasmMode();
      const exportButton = document.createElement("button");
      exportButton.type = "button";
      exportButton.id = "export-pdf";
      exportButton.className = "button small";
      exportButton.textContent = wasmMode ? "Descargar resolución (.tex)" : "Exportar resolución a PDF";
      const exportStatus = document.createElement("span");
      exportStatus.className = "muted";
      exportStatus.setAttribute("aria-live", "polite");
      if (wasmMode) {
        exportStatus.innerHTML = 'El PDF requiere el servidor: usa la <a href="https://github.com/MarceloDetlefsen/proy3-logica#compilaci%C3%B3n-y-ejecuci%C3%B3n" target="_blank" rel="noopener noreferrer">imagen Docker</a>.';
      }
      exportButton.addEventListener("click", async () => {
        if (output.classList.contains("stale")) {
          exportStatus.textContent = "El resultado está desactualizado. Vuelve a evaluar antes de exportar.";
          return;
        }
        exportButton.disabled = true;
        exportStatus.textContent = wasmMode ? "Generando archivo LaTeX (.tex)…" : "Preparando el PDF con LaTeX…";
        try {
          const exported = await getTransport().exportDocument({
            language: currentLanguage(),
            input: ($("#formula-input") as HTMLTextAreaElement).value,
            interpretation: currentInterpretation(),
            env: state.env,
          });
          const fileURL = URL.createObjectURL(exported.blob);
          const link = document.createElement("a");
          link.href = fileURL;
          link.download = exported.filename;
          link.click();
          URL.revokeObjectURL(fileURL);
          exportStatus.textContent = exported.kind === "tex" ? "Archivo .tex descargado." : "PDF descargado.";
        } catch (error) {
          exportStatus.textContent = error.message;
        } finally {
          exportButton.disabled = output.classList.contains("stale");
        }
      });
      exportControls.append(exportButton, exportStatus);
      output.append(exportControls);
      evaluationSteps = [];
      const explanationTree = renderExplanation(result.explanation);
      output.append(createStepControls(), explanationTree);
      resultHost.append(output);
    } catch (error) {
      status.textContent = "No se pudo evaluar.";
      appendText(resultHost, error.message, "error-list");
    } finally {
      updateButton();
    }
  }

  button.addEventListener("click", evaluate);
  searchButton.addEventListener("click", searchModels);
  return { updateButton };
}
