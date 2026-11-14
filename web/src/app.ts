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
  const selected = themeNames.includes(theme) ? theme : "medianoche";
  document.documentElement.dataset.theme = selected;
  $$<HTMLInputElement>("input[name=appearance]").forEach((input) => { input.checked = input.value === selected; });
  if (persist) { try { localStorage.setItem("parcial3-theme-v1", selected); } catch {} }
}
applyTheme(document.documentElement.dataset.theme || "medianoche", false);
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
let learningReturnPhase = "language";
const learningView = $("#learning-view");
const lessonContent = $("#lesson-content");
const contextHelp = $("#context-help");
function openPhase(id: string, direction = "forward") {
  if (!phaseInfo[id] || id === activePhase && document.querySelector(".phase-panel.active")) return;
  const token = ++transitionToken;
  activePhase = id;
  learningView.classList.add("hidden");
  $("#examples-panel").classList.add("hidden");
  $(".stage-intro").classList.remove("hidden");
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
$$<HTMLElement>("[data-next-phase]").forEach((button) => button.addEventListener("click", () => { recordHelpAttempt(activePhase); openPhase(button.dataset.nextPhase || "language", "forward"); }));
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
  if (!contextHelp.classList.contains("hidden") && !issueForPhase(activePhase)) clearContextHelp();
}
function markExampleDirty() { if (state.example && !applyingExample) exampleDirty = true; }
["#language","#interpretation","#formula"].forEach((id) => {
  ["input", "change", "click"].forEach((eventName) => $(id).addEventListener(eventName, markExampleDirty, true));
  $(id).addEventListener("input", () => { markResultStale(); updateSummary(); }, true);
});
function markResultStale() { const result = $("#result .result"); if (!result || result.classList.contains("stale")) return; result.classList.add("stale"); $("#evaluation-status").textContent = "Los datos cambiaron. Vuelve a evaluar para actualizar el resultado."; }
updateSummary();
const progressTimer = setInterval(updateProgress, 450);

const lessonData: Record<string, string> = {
  symbols: `<span class="phase-label">FUNDAMENTOS · 01</span><h2>De los símbolos a una fórmula</h2><p class="lesson-lead">El lenguaje nombra objetos y propiedades para que una fórmula pueda preguntar algo sobre ellos.</p><div class="lesson-visual symbol-lesson-visual"><div><strong>término</strong><code>f(a)</code><small>denota un objeto</small></div><div class="lesson-arrow">→</div><div><strong>fórmula</strong><code>P(f(a))</code><small>puede ser verdadera o falsa</small></div></div><p>Una variable representa un elemento; una constante es una función de aridad 0; una función produce un elemento y un predicado recibe una cantidad fija de elementos. Esa cantidad es su aridad.</p><p>La fórmula se evalúa bajo una interpretación y, si tiene variables libres, bajo un entorno. El editor valida que los símbolos y sus aridades coincidan.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>Declara símbolos en Lenguaje y usa nombres compatibles en Fórmula.</span><button class="button small" data-learning-example="universal-verdadero">Probar ejemplo compatible</button></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`,
  quantifiers: `<span class="phase-label">FUNDAMENTOS · 02</span><h2>Interpretaciones y cuantificadores</h2><p class="lesson-lead">Una interpretación fija el dominio y decide qué salidas de funciones y qué relaciones son verdaderas.</p><div class="lesson-visual quantifier-visual"><div class="domain-strip"><span>1</span><span class="false-mark">2</span><span class="true-mark">3</span></div><div class="comparison-grid"><div><strong>∃x P(x)</strong><b class="true-text">Verdadero</b><small>Testigo: 2 (también 3)</small></div><div><strong>∀x P(x)</strong><b class="false-text">Falso</b><small>Contraejemplo: 1</small></div></div></div><p>Para una relación unaria, P se cumple para 2 y 3. El parser da a <code>∀x P(x) → Q(x)</code> el alcance <code>(∀x P(x)) → Q(x)</code>; para cuantificar toda la implicación usa <code>∀x (P(x) → Q(x))</code>.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>Interpretación construye los datos; Evaluación muestra el testigo o contraejemplo real.</span></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`,
  meaning: `<span class="phase-label">FUNDAMENTOS · 03</span><h2>Evaluar, demostrar y ser válido</h2><p class="lesson-lead">Son relaciones distintas entre una fórmula, una interpretación y un sistema de axiomas.</p><div class="lesson-visual meaning-visual"><div><code>M, s ⊨ φ</code><small>verdad concreta</small></div><div><code>Γ ⊨ φ</code><small>consecuencia semántica</small></div><div><code>Γ ⊢ φ</code><small>derivación formal</small></div><div><code>⊨ φ</code><small>validez universal</small></div></div><p>Corrección —también llamada validez en este contexto— conecta derivaciones correctas con consecuencias semánticas. Completitud afirma, bajo sus hipótesis, que una consecuencia semántica tiene una derivación formal.</p><p>El árbol de esta aplicación justifica una evaluación concreta sobre el modelo finito que construiste. No es una demostración formal de validez universal.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>Lee el árbol junto con la interpretación y la asignación del resultado.</span></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`,
  peano: `<span class="phase-label">CONEXIONES · 04</span><h2>Peano: lenguaje y axiomas</h2><p class="lesson-lead">Peano usa un lenguaje para hablar de 0, sucesor, suma, multiplicación e inducción como esquema de axiomas.</p><div class="lesson-visual peano-visual"><div><code>0</code><small>cero</small></div><div><code>S(0)</code><small>un sucesor</small></div><div><code>S(S(0))</code><small>dos sucesores</small></div></div><p><code>S(0) + S(0) = S(S(0))</code> es una ilustración de la lección, no una prueba generada ni verificada por el evaluador.</p><p>El programa trabaja con dominios finitos y no representa toda la aritmética de los naturales. No presentes una estructura finita como modelo de todos los axiomas de Peano.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>La igualdad y la aritmética quedan fuera del contrato; las fórmulas ejecutables usan la sintaxis admitida.</span></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`,
  undecidability: `<span class="phase-label">CONEXIONES · 05</span><h2>Por qué el evaluador tiene un alcance concreto</h2><p class="lesson-lead">Evaluar un modelo finito es acotado. Decidir la validez general de primer orden sobre todas las interpretaciones es otro problema.</p><div class="lesson-visual pcp-visual"><div><code>ab / a</code><code>a / ba</code></div><strong>aba = aba</strong><small>coincidencia ilustrativa de PCP</small></div><p>El problema de parada, las máquinas de Turing y PCP ayudan a explicar por qué no existe un procedimiento general para todos los casos de validez. Esta pantalla no implementa un solucionador de PCP ni un simulador completo de Turing.</p><p>Agotar un límite de recursos no significa “falso” ni demuestra por sí solo indecidibilidad.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>El motor consulta el modelo finito y comunica sus límites.</span></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`,
  godel: `<span class="phase-label">CONEXIONES · 06</span><h2>Gödel: verdad y demostrabilidad</h2><p class="lesson-lead">La aritmética puede codificar expresiones y pruebas con números para hablar de la demostrabilidad dentro de un sistema.</p><div class="lesson-visual godel-visual"><div><strong>codificar</strong><span>expresiones → números</span></div><div><strong>verificar</strong><span>comprobar una prueba</span></div><div><strong>diagonalizar</strong><span>autorreferencia controlada</span></div></div><p>La incompletitud requiere hipótesis como consistencia en la formulación pertinente, axiomatización efectiva y suficiente expresividad aritmética. La verdad aritmética se entiende en la interpretación estándar de los naturales.</p><p>No contradice la completitud de la lógica de primer orden. Este evaluador finito no decide una oración de Gödel ni verifica el teorema.</p><div class="lesson-connection"><strong>En la aplicación</strong><span>El resultado responde por la interpretación concreta, no por la verdad aritmética estándar.</span></div><p class="lesson-source">Fuente: presentación adjunta — pendiente de verificación; diapositiva no disponible en este entorno.</p><button class="button lesson-back-inline">Volver al evaluador</button>`
};
let suggestionsPaused = false;
let suggestionsDisabled = false;
const helpAttempts = new Map<string, number>();
const helpDismissed = new Set<string>();
const helpSuggestedAt = new Map<string, number>();
type HelpIssue = { key: string; phase: string; lesson: string; title: string; detail: string };
function issueForPhase(phase: string): HelpIssue | null {
  if (phase === "interpretation" && !state.domain.length) return { key: "interpretation:DOMAIN_EMPTY", phase, lesson: "quantifiers", title: "El dominio todavía está vacío", detail: "Agrega al menos un elemento antes de construir las tablas." };
  if (phase === "language" && state.languageErrors.length) { const e = state.languageErrors[0]; return { key: `language:${e.code}:${e.path || "root"}`, phase, lesson: "symbols", title: "Revisa el símbolo o su aridad", detail: e.message }; }
  if (phase === "interpretation" && state.interpErrors.length) { const e = state.interpErrors[0]; return { key: `interpretation:${e.code}:${e.path || "root"}`, phase, lesson: "quantifiers", title: "Revisa la interpretación", detail: e.message }; }
  if ((phase === "formula" || phase === "evaluation") && state.analysis?.errors?.length) { const e = state.analysis.errors[0]; return { key: `formula:${e.code}:${e.start}`, phase: "formula", lesson: "symbols", title: "Revisa la construcción de la fórmula", detail: e.message }; }
  if ((phase === "formula" || phase === "evaluation") && !(($("#formula-input") as HTMLTextAreaElement).value.trim())) return { key: "formula:EMPTY", phase: "formula", lesson: "symbols", title: "Falta una fórmula", detail: "Escribe una fórmula antes de continuar hacia la evaluación." };
  if ((phase === "formula" || phase === "evaluation") && state.analysis?.freeVars?.some((v) => !state.domain.includes(state.env[v]))) { const v = state.analysis.freeVars.find((x) => !state.domain.includes(state.env[x])) || "la variable"; return { key: `formula:ENV_MISSING:${v}`, phase: "formula", lesson: "quantifiers", title: "Falta una asignación para una variable libre", detail: `Asigna ${v} a un elemento del dominio.` }; }
  return null;
}
function clearContextHelp() { contextHelp.replaceChildren(); contextHelp.classList.add("hidden"); }
function showContextHelp(issue: HelpIssue) { const card = document.createElement("div"); card.className = "context-help-card"; const label = document.createElement("span"); label.className = "mini-label"; label.textContent = "AYUDA CONTEXTUAL"; const title = document.createElement("strong"); title.textContent = issue.title; const detail = document.createElement("p"); detail.textContent = issue.detail; const actions = document.createElement("div"); const open = document.createElement("button"); open.className = "button small primary"; open.textContent = "Ver explicación"; const dismiss = document.createElement("button"); dismiss.className = "button small"; dismiss.textContent = "Ahora no"; const disable = document.createElement("button"); disable.className = "text-button"; disable.textContent = "Desactivar sugerencias automáticas"; actions.append(open, dismiss); card.append(label, title, detail, actions, disable); contextHelp.replaceChildren(card); contextHelp.classList.remove("hidden"); open.addEventListener("click", () => openLearning(issue.lesson, issue.phase)); dismiss.addEventListener("click", () => { helpDismissed.add(issue.key); clearContextHelp(); }); disable.addEventListener("click", () => { suggestionsDisabled = true; clearContextHelp(); }); }
function recordHelpAttempt(phase: string) { if (suggestionsDisabled || suggestionsPaused) return; const issue = issueForPhase(phase); if (!issue) return; const count = (helpAttempts.get(issue.key) || 0) + 1; helpAttempts.set(issue.key, count); const last = helpSuggestedAt.get(issue.key) || 0; if (count >= 3 && !helpDismissed.has(issue.key) && Date.now() - last >= 120000) { helpSuggestedAt.set(issue.key, Date.now()); showContextHelp(issue); } }
function renderLesson(id: string) { lessonContent.innerHTML = lessonData[id] || lessonData.symbols; lessonContent.querySelectorAll(".lesson-source,.lesson-back-inline").forEach((node) => node.remove()); $$(".lesson-link").forEach((b) => b.classList.toggle("active", (b as HTMLElement).dataset.lesson === id)); requestAnimationFrame(() => { const active = $(".lesson-link.active") as HTMLElement | null; const nav = $(".lesson-nav") as HTMLElement; if (active) nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2); }); lessonContent.querySelectorAll("[data-learning-example]").forEach((b) => b.addEventListener("click", () => loadExample((b as HTMLElement).dataset.learningExample || ""))); }
function openLearning(id = "symbols", returnPhase = activePhase) { learningReturnPhase = returnPhase; suggestionsPaused = true; clearContextHelp(); $$(".phase-panel").forEach((p) => p.classList.remove("active")); examplesPanel.classList.add("hidden"); $(".stage-intro").classList.add("hidden"); learningView.classList.remove("hidden"); $("#toggle-learn").classList.add("active"); renderLesson(id); lessonContent.focus({ preventScroll: true }); }
function closeLearning() { suggestionsPaused = false; learningView.classList.add("hidden"); $(".stage-intro").classList.remove("hidden"); $("#toggle-learn").classList.remove("active"); const phase = learningReturnPhase; activePhase = ""; openPhase(phase, "back"); }
$("#toggle-learn").addEventListener("click", () => openLearning()); $("#back-to-work").addEventListener("click", closeLearning); $$(".lesson-link").forEach((b) => b.addEventListener("click", () => renderLesson((b as HTMLElement).dataset.lesson || "symbols"))); renderLesson("symbols");

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
  suggestionsPaused = true;
  tutorialReturnFocus = document.activeElement as HTMLElement;
  tutorialIndex = 0; tutorial.classList.remove("hidden"); renderTutorial(); ($("#tutorial-next") as HTMLButtonElement).focus();
}
function closeTutorial(completed = false) {
  tutorial.classList.add("hidden");
  suggestionsPaused = false;
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
