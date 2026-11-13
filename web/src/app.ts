import { $$, $, state } from "./state.js";
import { createLanguageUI } from "./language.js";
import { createInterpretationUI } from "./interpretation.js";
import { createFormulaUI } from "./formula.js";
import { createEvaluationUI } from "./evaluation.js";

// Modules share these callbacks so each section can trigger the validation
// work that depends on it without owning another section's implementation.
const actions = {};
const interpretation = createInterpretationUI(actions);
const formula = createFormulaUI(actions);
const evaluation = createEvaluationUI(actions);

Object.assign(actions, {
  renderTables: interpretation.renderTables,
  validateInterpretation: interpretation.validate,
  analyze: formula.analyze,
  updateEvaluate: evaluation.updateButton,
});

const language = createLanguageUI(actions);
interpretation.renderDomain();

const demoExamples = [
  "universal-verdadero",
  "sin-sucesor",
  "min-existe",
  "densidad-verdadera",
  "densidad-falsa",
  "constante-verdadera",
  "constante-falsa",
  "funcion-sucesor",
];

const selector = $("#example-select") as HTMLSelectElement;
const loadButton = $("#load-example") as HTMLButtonElement;
if (state.mockMode) {
  $("#example-mode").textContent = "Mock activo";
  $("#mock-note").classList.remove("hidden");
} else {
  $("#example-mode").textContent = "API Go";
}
for (const name of demoExamples) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  selector.append(option);
}
selector.addEventListener("change", () => {
  loadButton.disabled = !selector.value;
});
loadButton.addEventListener("click", async () => {
  if (!selector.value) return;
  loadButton.disabled = true;
  $("#example-description").textContent = "Cargando ejemplo…";
  try {
    const response = await fetch(`/examples/${selector.value}.json`);
    if (!response.ok) throw new Error("No se pudo cargar el ejemplo.");
    state.example = await response.json();
    language.load(state.example.language);
    interpretation.load(state.example.interpretation);
    formula.load(state.example.input, state.example.env);
    $("#example-description").textContent = state.example.description;
  } catch (error) {
    $("#example-description").textContent = error.message;
  } finally {
    loadButton.disabled = false;
  }
});

$$(".step-link").forEach((link) => {
  link.addEventListener("click", () => {
    $$(".step-link").forEach((item) => {
      item.classList.toggle("active", item === link);
    });
  });
});

function markResultStale() {
  const result = $("#result .result");
  if (!result || result.classList.contains("stale")) return;
  result.classList.add("stale");
  $("#evaluation-status").textContent =
    "Los datos cambiaron. Vuelve a evaluar para actualizar el resultado.";
}

["#language", "#interpretation", "#formula"].forEach((selector) => {
  $(selector).addEventListener("input", markResultStale, true);
  $(selector).addEventListener("change", markResultStale, true);
  $(selector).addEventListener("click", markResultStale, true);
});
