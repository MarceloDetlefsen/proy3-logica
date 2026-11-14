import { $$, $, state } from "./state.js";
import { createLanguageUI } from "./language.js";
import { createInterpretationUI } from "./interpretation.js";
import { createFormulaUI } from "./formula.js";
import { createEvaluationUI } from "./evaluation.js";

const actions = {};
const interpretation = createInterpretationUI(actions);
const formula = createFormulaUI(actions);
const evaluation = createEvaluationUI(actions);
Object.assign(actions, { renderTables: interpretation.renderTables, validateInterpretation: interpretation.validate, analyze: formula.analyze, updateEvaluate: evaluation.updateButton });
const language = createLanguageUI(actions);
interpretation.renderDomain();

const themeNames = ["grafito", "medianoche", "obsidiana", "tinta", "papel"];
const appearanceMenu = $("#appearance-menu");
const appearanceButton = $("#open-appearance") as HTMLButtonElement;
let appearanceReturnFocus: HTMLElement | null = null;
function applyTheme(theme: string, persist = true) {
  const selected = themeNames.includes(theme) ? theme : "grafito";
  document.documentElement.dataset.theme = selected;
  $$<HTMLInputElement>("input[name=appearance]").forEach((input) => { input.checked = input.value === selected; });
  if (persist) { try { localStorage.setItem("parcial3-theme-v1", selected); } catch {} }
}
applyTheme(document.documentElement.dataset.theme || "grafito", false);
function closeAppearance() {
  appearanceMenu.classList.add("hidden");
  appearanceButton.setAttribute("aria-expanded", "false");
  appearanceReturnFocus?.focus();
}
appearanceButton.addEventListener("click", () => {
  const opening = appearanceMenu.classList.contains("hidden");
  if (opening) { appearanceReturnFocus = appearanceButton; appearanceMenu.classList.remove("hidden"); appearanceButton.setAttribute("aria-expanded", "true"); (appearanceMenu.querySelector("input:checked") as HTMLInputElement | null)?.focus(); }
  else closeAppearance();
});
appearanceMenu.addEventListener("change", (event) => applyTheme((event.target as HTMLInputElement).value));
document.addEventListener("click", (event) => { if (!appearanceMenu.classList.contains("hidden") && !appearanceMenu.parentElement?.contains(event.target as Node)) closeAppearance(); });

const demoExamples = ["universal-verdadero","sin-sucesor","min-existe","densidad-verdadera","densidad-falsa","constante-verdadera","constante-falsa","funcion-sucesor"];
const exampleMeta = {
  "universal-verdadero":["Universal verdadero","Cuantificadores","Todos los objetos satisfacen P."],
  "sin-sucesor":["Universal falso","Contraejemplo","Encuentra el elemento sin sucesor."],
  "min-existe":["Existencial con testigo","Existenciales","Descubre un mínimo en el orden."],
  "densidad-verdadera":["Testigo en una implicación","Existenciales","Hay algo entre 1 y 3."],
  "densidad-falsa":["Implicación falsa","Contraejemplo","No hay algo entre 1 y 2."],
  "constante-verdadera":["Constante verdadera","Aridad cero","Una constante también es una función."],
  "constante-falsa":["Constante falsa","Aridad cero","La salida de c no pertenece a P."],
  "funcion-sucesor":["Función y relación","Tablas","Una función puede cambiar la verdad."]
};
const examplesPanel = $("#examples-panel");
const grid = $("#examples-grid");
let applyingExample = false;
let exampleDirty = false;
if (state.mockMode) $("#mock-note").classList.remove("hidden");

function hasUserWork() {
  return state.funcs.some((s) => s.name.trim()) || state.preds.some((s) => s.name.trim()) || state.domain.length > 0 || Boolean(($("#formula-input") as HTMLTextAreaElement).value.trim());
}
async function loadExample(name: string) {
  if (hasUserWork() && (!state.example || exampleDirty) && !window.confirm("Este ejemplo reemplazará los datos que editaste. ¿Quieres continuar?")) return;
  const card = $("[data-example='" + name + "']") as HTMLButtonElement | null;
  if (card) card.disabled = true;
  $("#example-description").textContent = "Cargando " + (exampleMeta[name]?.[0] || "ejemplo") + "…";
  try {
    const response = await fetch("/examples/" + name + ".json");
    if (!response.ok) throw new Error("No se pudo cargar el ejemplo.");
    state.example = await response.json();
    applyingExample = true;
    language.load(state.example.language);
    interpretation.load(state.example.interpretation);
    formula.load(state.example.input, state.example.env);
    applyingExample = false;
    exampleDirty = false;
    $("#example-description").textContent = state.example.description;
    examplesPanel.classList.add("hidden");
    window.scrollTo(0, 0);
    openPhase("evaluation", "forward");
  } catch (error) {
    $("#example-description").textContent = error.message;
  } finally {
    if (card) card.disabled = false;
  }
}
for (const name of demoExamples) {
  const card = document.createElement("button");
  card.type = "button"; card.className = "example-card"; card.dataset.example = name;
  card.innerHTML = "<strong>" + exampleMeta[name][0] + "</strong><small>" + exampleMeta[name][1] + "</small><p>" + exampleMeta[name][2] + "</p><span class=\"example-action\">Cargar ejemplo →</span>";
  card.addEventListener("click", () => loadExample(name));
  grid.append(card);
}

const phaseInfo = {
  language: ["FASE 01 / LENGUAJE","Lenguaje","Declara funciones, constantes y predicados que podrás usar en la fórmula."],
  interpretation: ["FASE 02 / INTERPRETACIÓN","Interpretación","Construye el dominio y asigna significado a cada símbolo."],
  formula: ["FASE 03 / FÓRMULA","Fórmula","Escribe una fórmula y comprueba que su sintaxis y símbolos sean válidos."],
  evaluation: ["FASE 04 / EVALUACIÓN","Evaluación","Consulta el motor y revisa el valor de verdad con su evidencia."]
};
const phaseOrder = ["language", "interpretation", "formula", "evaluation"];
let activePhase = "language";
let transitionToken = 0;
function openPhase(id: string, direction = "forward") {
  if (!phaseInfo[id] || id === activePhase && document.querySelector(".phase-panel.active")) return;
  const token = ++transitionToken;
  activePhase = id;
  const panel = $("#" + id);
  $$(".phase-panel").forEach((item) => item.classList.remove("active", "enter-forward", "enter-back"));
  panel.classList.add(direction === "back" ? "enter-back" : "enter-forward");
  panel.classList.add("active");
  $$(".step-link").forEach((link) => link.classList.toggle("active", (link as HTMLElement).dataset.phase === id));
  const info = phaseInfo[id];
  $("#phase-label").textContent = info[0]; $("#stage-title").textContent = info[1]; $("#stage-description").textContent = info[2];
  history.replaceState(null, "", "#" + id);
  updateSummary();
  requestAnimationFrame(() => {
    if (token !== transitionToken) return;
    panel.focus({ preventScroll: true });
  });
}
$$(".step-link").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  const next = (link as HTMLElement).dataset.phase || "language";
  openPhase(next, phaseOrder.indexOf(next) >= phaseOrder.indexOf(activePhase) ? "forward" : "back");
}));
$$("[data-next-phase]").forEach((button) => button.addEventListener("click", () => openPhase((button as HTMLElement).dataset.nextPhase || "language", "forward")));
$$("[data-prev-phase]").forEach((button) => button.addEventListener("click", () => {
  const previous = (button as HTMLElement).dataset.prevPhase;
  if (previous) openPhase(previous, "back");
}));
$("#toggle-examples").addEventListener("click", () => {
  examplesPanel.classList.toggle("hidden");
  if (!examplesPanel.classList.contains("hidden")) examplesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#close-examples").addEventListener("click", () => examplesPanel.classList.add("hidden"));

function updateSummary() {
  const domain = $("#summary-domain"); domain.replaceChildren();
  if (!state.domain.length) {
    domain.innerHTML = '<span class="empty-summary">Sin elementos</span>';
  } else state.domain.forEach((value) => { const chip = document.createElement("span"); chip.textContent = value; domain.append(chip); });
  const lang = $("#summary-language"); lang.replaceChildren();
  const symbols = [...state.funcs.filter((s) => s.name.trim()).map((s) => [s.name.trim(), s.arity === 0 ? "constante" : "función · aridad " + s.arity]), ...state.preds.filter((s) => s.name.trim()).map((s) => [s.name.trim(), "predicado · aridad " + s.arity])];
  if (!symbols.length) lang.innerHTML = '<span class="empty-summary">Sin símbolos declarados</span>';
  else symbols.forEach(([name, detail]) => { const row = document.createElement("div"); const label = document.createElement("span"); label.textContent = name; const value = document.createElement("b"); value.textContent = detail; row.append(label, value); lang.append(row); });
  $("#summary-formula").textContent = ($("#formula-input") as HTMLTextAreaElement).value.trim() || "Sin fórmula";
  updateProgress();
}
function requirements() {
  const items = [];
  if (!state.domain.length) items.push(["Dominio pendiente", "Agrega al menos un elemento.", "interpretation"]);
  if (state.domain.length && !state.interpValid) items.push(["Tabla incompleta o inválida", "Revisa las tablas y sus valores.", "interpretation"]);
  if (!($("#formula-input") as HTMLTextAreaElement).value.trim()) items.push(["Fórmula ausente", "Escribe una fórmula lógica.", "formula"]);
  else if (!state.formulaValid) items.push(["Fórmula inválida", "Corrige el error marcado en el editor.", "formula"]);
  const freeVars = state.analysis?.freeVars || [];
  const missingEnv = freeVars.find((variable) => !state.domain.includes(state.env[variable]));
  if (missingEnv) items.push(["Asignación pendiente: " + missingEnv, "Elige un elemento del dominio para esa variable.", "formula"]);
  return items;
}
function updateProgress() {
  const complete = [state.langValid, state.interpValid, state.formulaValid, Boolean($("#result .result"))];
  const names = ["language", "interpretation", "formula", "evaluation"];
  $$(".step-link").forEach((link) => { const index = names.indexOf((link as HTMLElement).dataset.phase || ""); link.classList.toggle("completed", index >= 0 && complete[index]); });
  $("#progress-pill").textContent = complete.filter(Boolean).length + " / 4 válidas";
  names.forEach((name, index) => { const node = $("#" + name + "-state"); if (node) node.textContent = complete[index] ? "Válida" : "Pendiente"; });
  const req = requirements();
  const host = $("#evaluation-requirements"); host.replaceChildren();
  if (!req.length) {
  const currentResult = $("#result .result");
  const ok = document.createElement("p"); ok.className = "requirements-ok";
  ok.textContent = currentResult?.classList.contains("stale") ? "Los datos cambiaron. Vuelve a evaluar." : currentResult ? "Resultado vigente." : "Las entradas son válidas. Puedes evaluar.";
  host.append(ok);
  } else req.forEach(([title, detail, phase]) => {
    const row = document.createElement("div"); row.className = "requirement";
    const copy = document.createElement("span"); copy.innerHTML = "<strong>" + title + "</strong><small>" + detail + "</small>";
    const go = document.createElement("button"); go.className = "button small"; go.textContent = "Resolver"; go.addEventListener("click", () => openPhase(phase, "back"));
    row.append(copy, go); host.append(row);
  });
  const stale = $("#result .result")?.classList.contains("stale");
  $("#summary-status").textContent = stale ? "Resultado desactualizado" : complete[3] ? "Resultado disponible" : req.length ? req[0][0] : "Listo para evaluar";
  $("#summary-hint").textContent = stale ? "Vuelve a evaluar para actualizarlo." : complete[3] ? "Abre el árbol para seguir la evidencia." : req.length ? req[0][1] : "El motor puede consultar esta interpretación.";
}
function markExampleDirty() { if (state.example && !applyingExample) exampleDirty = true; }
["#language","#interpretation","#formula"].forEach((id) => {
  ["input", "change", "click"].forEach((eventName) => $(id).addEventListener(eventName, markExampleDirty, true));
  $(id).addEventListener("input", () => { markResultStale(); updateSummary(); }, true);
});
function markResultStale() { const result = $("#result .result"); if (!result || result.classList.contains("stale")) return; result.classList.add("stale"); $("#evaluation-status").textContent = "Los datos cambiaron. Vuelve a evaluar para actualizar el resultado."; }
updateSummary();
const progressTimer = setInterval(updateProgress, 450);

const tutorialSteps = [
  ["Cómo se conectan las piezas","Este es un ejemplo aislado: el modelo real no cambia mientras recorres el tutorial."],
  ["Lenguaje: P recibe un elemento","P es un predicado de aridad 1: recibe un elemento del dominio. Todavía no sabemos qué elementos cumplen P."],
  ["Interpretación: P se cumple para 2 y 3","El dominio tiene 1, 2 y 3. La interpretación hace verdaderas P(2) y P(3), pero no P(1)."],
  ["Fórmula: ∃x P(x)","La fórmula pregunta si existe al menos un elemento que cumple P. Se construye con el cuantificador y el predicado."],
  ["Evaluación: detenerse en el testigo","P(1) es falso. P(2) es verdadero: ya encontramos el testigo x = 2 y no hace falta revisar 3."],
  ["Explicación: resultado y testigo","El resultado es verdadero porque x = 2 hace verdadera a P(x). El árbol conserva esa justificación."]
];
let tutorialIndex = 0;
let tutorialReturnFocus: HTMLElement | null = null;
const tutorial = $("#tutorial");
const tutorialScene = $("#tutorial-scene");
function renderTutorial() {
  const step = tutorialSteps[tutorialIndex];
  $("#tutorial-title").textContent = step[0]; $("#tutorial-copy").textContent = step[1];
  $("#tutorial-step-label").textContent = "TUTORIAL " + String(tutorialIndex + 1).padStart(2, "0") + " / 06";
  $("#tutorial-progress-bar").style.width = ((tutorialIndex + 1) / tutorialSteps.length) * 100 + "%";
  ($("#tutorial-back") as HTMLButtonElement).disabled = tutorialIndex === 0;
  ($("#tutorial-next") as HTMLButtonElement).textContent = tutorialIndex === tutorialSteps.length - 1 ? "Terminar" : "Siguiente →";
  tutorialScene.className = "tutorial-scene";
  requestAnimationFrame(() => { tutorialScene.className = "tutorial-scene scene-step-" + tutorialIndex; });
}
function showTutorial() {
  tutorialReturnFocus = document.activeElement as HTMLElement;
  tutorialIndex = 0; tutorial.classList.remove("hidden"); renderTutorial(); ($("#tutorial-next") as HTMLButtonElement).focus();
}
function closeTutorial(completed = false) {
  tutorial.classList.add("hidden");
  try { localStorage.setItem("parcial3-tutorial-v2", completed ? "done" : "skipped"); } catch {}
  tutorialReturnFocus?.focus();
}
$("#open-tutorial").addEventListener("click", showTutorial); $("#close-tutorial").addEventListener("click", () => closeTutorial()); $("#skip-tutorial").addEventListener("click", () => closeTutorial());
$("#tutorial-back").addEventListener("click", () => { tutorialIndex = Math.max(0, tutorialIndex - 1); renderTutorial(); });
$("#tutorial-next").addEventListener("click", () => { if (tutorialIndex === tutorialSteps.length - 1) closeTutorial(true); else { tutorialIndex++; renderTutorial(); } });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!appearanceMenu.classList.contains("hidden")) { event.preventDefault(); closeAppearance(); return; }
  if (!tutorial.classList.contains("hidden")) { event.preventDefault(); closeTutorial(); }
});
try { if (!localStorage.getItem("parcial3-tutorial-v2")) setTimeout(showTutorial, 450); } catch {}
if (location.hash && phaseInfo[location.hash.slice(1)]) { activePhase = ""; openPhase(location.hash.slice(1)); }
