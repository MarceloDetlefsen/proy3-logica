import { $$, $, escapeHTML, state } from "./state.js";
import { createLanguageUI } from "./language.js";
import { createInterpretationUI } from "./interpretation.js";
import { createFormulaUI } from "./formula.js";
import { createEvaluationUI } from "./evaluation.js";
import { createHistoryUI } from "./history/view.js";
import { attachHistoryDemos } from "./history/demos.js";
import { LEARN_LESSONS } from "./learn/lessons.js";
import {
  closeAuxView,
  createInitialNavState,
  formatHash,
  openAuxView,
  parseHash,
  setPhase,
  type NavState,
  type PhaseId,
} from "./navigation.js";

const actions = {};
// Los módulos se crean una vez y se coordinan mediante actions. Así cada fase
// conserva una responsabilidad concreta sin introducir un framework global.
const interpretation = createInterpretationUI(actions);
const formula = createFormulaUI(actions);
const evaluation = createEvaluationUI(actions);
Object.assign(actions, {
  renderTables: interpretation.renderTables,
  validateInterpretation: interpretation.validate,
  analyze: formula.analyze,
  updateEvaluate: evaluation.updateButton,
  resetWorkspace() {
    state.example = null;
    exampleDirty = false;
    state.domain = [];
    state.funcRows = {};
    state.relRows = {};
    state.interpValid = false;
    state.interpErrors = [];
    state.env = {};
    state.analysis = null;
    state.formulaValid = false;
    ($("#domain-input") as HTMLInputElement).value = "";
    $("#generation-status").textContent = "";
    $("#interpretation-status").replaceChildren();
    ($("#formula-input") as HTMLTextAreaElement).value = "";
    $("#formula-highlight").textContent = "";
    $("#formula-status").replaceChildren();
    $("#formula-generation-status").textContent = "";
    $("#free-vars").replaceChildren();
    $("#evaluation-status").textContent = "";
    $("#result").replaceChildren();
    $("#model-search-status").textContent = "";
    $("#model-search-results").replaceChildren();
    $("#example-description").textContent = "";
    interpretation.renderDomain();
    formula.analyze();
    evaluation.updateButton();
    updateSummary();
  }
});
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

const demoExamples = ["universal-verdadero","sin-sucesor","min-existe","densidad-verdadera","densidad-falsa","constante-verdadera","constante-falsa","funcion-sucesor","demorgan-conectivos","demorgan-cuantificadores","alcance-cuantificador","contrapositiva"];
const exampleMeta = {
  "universal-verdadero":["Universal verdadero","Cuantificadores","Todos los objetos satisfacen P."],
  "sin-sucesor":["Universal falso","Contraejemplo","Encuentra el elemento sin sucesor."],
  "min-existe":["Existencial con testigo","Existenciales","Descubre un mínimo en el orden."],
  "densidad-verdadera":["Testigo en una implicación","Existenciales","Hay algo entre 1 y 3."],
  "densidad-falsa":["Implicación falsa","Contraejemplo","No hay algo entre 1 y 2."],
  "constante-verdadera":["Constante verdadera","Aridad cero","Una constante también es una función."],
  "constante-falsa":["Constante falsa","Aridad cero","La salida de c no pertenece a P."],
  "funcion-sucesor":["Función y relación","Tablas","Una función puede cambiar la verdad."],
  "demorgan-conectivos":["De Morgan (conectivos)","Leyes de De Morgan","Equivalencias ¬(P ∧ Q) ↔ ¬P ∨ ¬Q y ¬(P ∨ Q) ↔ ¬P ∧ ¬Q."],
  "demorgan-cuantificadores":["De Morgan (cuantificadores)","Leyes de De Morgan","Equivalencias ¬∀x P(x) ↔ ∃x ¬P(x) y ¬∃x Q(x) ↔ ∀x ¬Q(x)."],
  "alcance-cuantificador":["Alcance y variable libre","Alcance","∀x P(x) → Q(x) deja x libre en Q(x)."],
  "contrapositiva":["Contrapositiva","Equivalencias","(P(x) → Q(x)) ↔ (¬Q(x) → ¬P(x))."]
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
    const response = await fetch("examples/" + name + ".json");
    if (!response.ok) throw new Error("No se pudo cargar el ejemplo.");
    state.example = await response.json();
    applyingExample = true;
    language.load(state.example.language);
    interpretation.load(state.example.interpretation);
    formula.load(state.example.input, state.example.env);
    applyingExample = false;
    exampleDirty = false;
    $("#example-description").textContent = state.example.description;
    window.scrollTo(0, 0);
    applyNavState(setPhase(navState, "evaluation"), true, "forward", false);
    $("#evaluation-status").textContent =
      "Ejemplo cargado: " + (exampleMeta[name]?.[0] || name) + ".";
    let focusedOnce = false;
    const focusEvaluateWhenReady = (attempts = 40) => {
      evaluation.updateButton();
      const btn = $("#evaluate") as HTMLButtonElement | null;
      if (btn && !btn.disabled && navState.phase === "evaluation" && !navState.auxView) {
        if (!focusedOnce || document.activeElement === document.body || document.activeElement === null) {
          btn.focus();
          focusedOnce = document.activeElement === btn;
        }
        if (focusedOnce && attempts <= 34) return;
      }
      if (attempts > 0) {
        setTimeout(() => focusEvaluateWhenReady(attempts - 1), 80);
      }
    };
    setTimeout(() => focusEvaluateWhenReady(), 80);
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
let landingReturnPhase = "language";
const learningView = $("#learning-view");
const historyView = $("#history-view");
const lessonContent = $("#lesson-content");
const contextHelp = $("#context-help");
const landing = $("#landing");
const evaluatorWorkspace = $("#evaluator-workspace");
let navState: NavState = createInitialNavState("language");
const sidebarEl = $("#evaluator-sidebar") as HTMLElement & { inert: boolean };
const modelRailEl = $("#model-rail") as HTMLElement & { inert: boolean };
const focusHandleLeft = $("#focus-handle-left") as HTMLButtonElement;
const focusHandleRight = $("#focus-handle-right") as HTMLButtonElement;
const focusEdgeLeft = $("#focus-edge-left") as HTMLElement;
const focusEdgeRight = $("#focus-edge-right") as HTMLElement;
let leftPeek = false;
let rightPeek = false;
let leftOpenTimer: number | null = null;
let leftCloseTimer: number | null = null;
let rightOpenTimer: number | null = null;
let rightCloseTimer: number | null = null;

function syncFocusPanelTop() {
  const topbar = document.querySelector(".topbar");
  const bottom = topbar ? Math.ceil(topbar.getBoundingClientRect().bottom) : 84;
  const topPx = Math.max(16, bottom + 10);
  evaluatorWorkspace.style.setProperty("--focus-panel-top", `${topPx}px`);
}

function syncFocusSidebars() {
  // inert saca del orden de tabulación los paneles ocultos en Historia; no basta
  // con esconderlos visualmente para que la navegación sea accesible.
  const focus = navState.focusMode;
  if (focus) syncFocusPanelTop();
  evaluatorWorkspace.classList.toggle("history-focus", focus);
  focusHandleLeft.classList.toggle("hidden", !focus);
  focusHandleRight.classList.add("hidden");
  focusEdgeRight.classList.add("hidden");
  if (!focus) {
    leftPeek = false;
    rightPeek = false;
    evaluatorWorkspace.classList.remove("left-peek-open");
    sidebarEl.classList.remove("is-peek");
    modelRailEl.classList.remove("is-peek");
    sidebarEl.inert = false;
    modelRailEl.inert = false;
    focusHandleLeft.setAttribute("aria-expanded", "false");
    focusHandleRight.setAttribute("aria-expanded", "false");
    const menuBtn = document.getElementById("history-toggle-menu");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    return;
  }
  const leftOpen = leftPeek || sidebarEl.matches(":focus-within");
  rightPeek = false;
  evaluatorWorkspace.classList.toggle("left-peek-open", leftOpen);
  sidebarEl.classList.toggle("is-peek", leftPeek);
  modelRailEl.classList.remove("is-peek");
  sidebarEl.inert = !leftOpen;
  modelRailEl.inert = true;
  focusHandleLeft.setAttribute("aria-expanded", String(leftOpen));
  focusHandleRight.setAttribute("aria-expanded", "false");
  const menuBtn = document.getElementById("history-toggle-menu");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", String(leftOpen));
}

function setPeek(side: "left" | "right", open: boolean) {
  if (side === "left") leftPeek = open;
  else rightPeek = open;
  syncFocusSidebars();
}

function wireEdgePeek(
  side: "left" | "right",
  edge: HTMLElement,
  panel: HTMLElement,
) {
  const clearTimers = () => {
    if (side === "left") {
      if (leftOpenTimer !== null) { clearTimeout(leftOpenTimer); leftOpenTimer = null; }
      if (leftCloseTimer !== null) { clearTimeout(leftCloseTimer); leftCloseTimer = null; }
    } else {
      if (rightOpenTimer !== null) { clearTimeout(rightOpenTimer); rightOpenTimer = null; }
      if (rightCloseTimer !== null) { clearTimeout(rightCloseTimer); rightCloseTimer = null; }
    }
  };
  const scheduleOpen = () => {
    if (!navState.focusMode) return;
    clearTimers();
    const id = window.setTimeout(() => setPeek(side, true), 120);
    if (side === "left") leftOpenTimer = id; else rightOpenTimer = id;
  };
  const scheduleClose = () => {
    if (!navState.focusMode) return;
    clearTimers();
    const id = window.setTimeout(() => setPeek(side, false), 300);
    if (side === "left") leftCloseTimer = id; else rightCloseTimer = id;
  };
  edge.addEventListener("mouseenter", scheduleOpen);
  edge.addEventListener("mouseleave", scheduleClose);
  panel.addEventListener("mouseenter", () => {
    if (navState.focusMode) clearTimers();
  });
  panel.addEventListener("mouseleave", scheduleClose);
  panel.addEventListener("focusout", () => {
    if (navState.focusMode) requestAnimationFrame(syncFocusSidebars);
  });
}

wireEdgePeek("left", focusEdgeLeft, sidebarEl);
wireEdgePeek("right", focusEdgeRight, modelRailEl);

let pointerDownOnHandle = false;
focusHandleLeft.addEventListener("pointerdown", () => { pointerDownOnHandle = true; });
focusHandleRight.addEventListener("pointerdown", () => { pointerDownOnHandle = true; });
window.addEventListener("pointerup", () => { pointerDownOnHandle = false; });
window.addEventListener("resize", () => { if (navState.focusMode) syncFocusPanelTop(); });
window.addEventListener("scroll", () => { if (navState.focusMode) syncFocusPanelTop(); }, { passive: true });

focusHandleLeft.addEventListener("focus", () => {
  if (navState.focusMode && !pointerDownOnHandle) setPeek("left", true);
});
focusHandleRight.addEventListener("focus", () => {
  if (navState.focusMode && !pointerDownOnHandle) setPeek("right", true);
});

focusHandleLeft.addEventListener("click", () => {
  pointerDownOnHandle = false;
  setPeek("left", !leftPeek);
  if (leftPeek) (sidebarEl.querySelector("a, button") as HTMLElement | null)?.focus();
});
focusHandleRight.addEventListener("click", () => {
  pointerDownOnHandle = false;
  setPeek("right", !rightPeek);
});

function applyNavState(next: NavState, updateUrl = true, direction = "forward", focusPhasePanel = true) {
  const prevAux = navState.auxView;
  const prevPhase = navState.phase;
  navState = next;
  activePhase = next.phase;

  const isLearn = next.auxView === "aprender";
  const isExamples = next.auxView === "ejemplos";
  const isHistory = next.auxView === "historia";

  suggestionsPaused = next.auxView !== null;
  if (next.auxView !== null) clearContextHelp();

  learningView.classList.toggle("hidden", !isLearn);
  examplesPanel.classList.toggle("hidden", !isExamples);
  historyView.classList.toggle("hidden", !isHistory);

  const learnBtn = $("#toggle-learn");
  const examplesBtn = $("#toggle-examples");
  const historyBtn = $("#toggle-history");
  learnBtn.classList.toggle("active", isLearn);
  examplesBtn.classList.toggle("active", isExamples);
  historyBtn.classList.toggle("active", isHistory);
  learnBtn.setAttribute("aria-current", isLearn ? "page" : "false");
  examplesBtn.setAttribute("aria-current", isExamples ? "page" : "false");
  historyBtn.setAttribute("aria-current", isHistory ? "page" : "false");

  if (isLearn || isHistory) {
    $(".stage-intro").classList.add("hidden");
    $$(".phase-panel").forEach((p) => p.classList.remove("active", "enter-forward", "enter-back"));
  } else {
    $(".stage-intro").classList.remove("hidden");
    const panel = $("#" + next.phase);
    const shouldAnimatePhase = prevAux !== null || prevPhase !== next.phase || !panel.classList.contains("active");
    if (shouldAnimatePhase) {
      $$(".phase-panel").forEach((item) => item.classList.remove("active", "enter-forward", "enter-back"));
      panel.classList.add(direction === "back" ? "enter-back" : "enter-forward");
      panel.classList.add("active");
    }
    $$(".step-link").forEach((link) => link.classList.toggle("active", (link as HTMLElement).dataset.phase === next.phase));
    const info = phaseInfo[next.phase];
    $("#phase-label").textContent = info[0];
    $("#stage-title").textContent = info[1];
    $("#stage-description").textContent = info[2];
    if (focusPhasePanel && next.auxView === null && shouldAnimatePhase) {
      const token = ++transitionToken;
      requestAnimationFrame(() => {
        if (token !== transitionToken) return;
        panel.focus({ preventScroll: true });
      });
    }
  }

  if (isExamples) {
    examplesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (isHistory) {
    historyUI.open(next.historyChapter ?? undefined);
  }
  syncFocusSidebars();
  updateSummary();

  if (updateUrl) {
    const targetHash = formatHash(navState);
    if (location.hash !== targetHash) {
      history.replaceState(null, "", targetHash);
    }
  }
}

function openPhase(id: string, direction = "forward") {
  if (!phaseInfo[id]) return;
  applyNavState(setPhase(navState, id as PhaseId), true, direction, true);
}
function enterEvaluator(updateUrl = true) {
  landing.classList.add("hidden");
  evaluatorWorkspace.classList.remove("hidden");
  const parsed = location.hash ? parseHash(location.hash, landingReturnPhase as PhaseId) : createInitialNavState(landingReturnPhase as PhaseId);
  applyNavState(parsed, updateUrl, "forward", true);
  try { if (!localStorage.getItem("parcial3-tutorial-v2")) setTimeout(showTutorial, 450); } catch { setTimeout(showTutorial, 450); }
}
function showLanding() {
  landingReturnPhase = navState.phase;
  applyNavState(closeAuxView(navState), false, "back", false);
  closeAppearance();
  evaluatorWorkspace.classList.add("hidden");
  landing.classList.remove("hidden");
  history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: "instant" });
  landing.focus({ preventScroll: true });
}
$("#brand-home").addEventListener("click", (event) => { event.preventDefault(); showLanding(); });
$("#enter-evaluator").addEventListener("click", () => enterEvaluator());
$$(".step-link").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  const next = (link as HTMLElement).dataset.phase || "language";
  openPhase(next, phaseOrder.indexOf(next) >= phaseOrder.indexOf(navState.phase) ? "forward" : "back");
}));
$$<HTMLElement>("[data-next-phase]").forEach((button) => button.addEventListener("click", () => { recordHelpAttempt(navState.phase); openPhase(button.dataset.nextPhase || "language", "forward"); }));
$$("[data-prev-phase]").forEach((button) => button.addEventListener("click", () => {
  const previous = (button as HTMLElement).dataset.prevPhase;
  if (previous) openPhase(previous, "back");
}));
$("#toggle-examples").addEventListener("click", () => {
  if (navState.auxView === "ejemplos") {
    applyNavState(closeAuxView(navState), true, "back", true);
  } else {
    applyNavState(openAuxView(navState, "ejemplos"), true, "forward", false);
  }
});
$("#close-examples").addEventListener("click", () => applyNavState(closeAuxView(navState), true, "back", true));
window.addEventListener("hashchange", () => {
  if (evaluatorWorkspace.classList.contains("hidden") && location.hash) {
    enterEvaluator(false);
    return;
  }
  const parsed = parseHash(location.hash, navState.phase);
  applyNavState(parsed, false, "forward", false);
});

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
// Una edición invalida la evidencia anterior. Se conserva para comparar, pero
// queda stale y no puede exportarse como si todavía describiera los datos.
function markResultStale() { const result = $("#result .result"); if (!result || result.classList.contains("stale")) return; result.classList.add("stale"); const exportButton = $("#export-pdf") as HTMLButtonElement | null; if (exportButton) exportButton.disabled = true; $("#evaluation-status").textContent = "Los datos cambiaron. Vuelve a evaluar para actualizar el resultado."; }
updateSummary();
const progressTimer = setInterval(updateProgress, 450);

let suggestionsPaused = false;
let suggestionsDisabled = false;
const helpAttempts = new Map<string, number>();
const helpDismissed = new Set<string>();
const helpSuggestedAt = new Map<string, number>();
type HelpIssue = { key: string; phase: string; lesson: string; title: string; detail: string };
function issueForPhase(phase: string): HelpIssue | null {
  if (phase === "interpretation" && !state.domain.length) return { key: "interpretation:DOMAIN_EMPTY", phase, lesson: "interpretation", title: "El dominio todavía está vacío", detail: "Agrega al menos un elemento antes de construir las tablas." };
  if (phase === "language" && state.languageErrors.length) { const e = state.languageErrors[0]; return { key: `language:${e.code}:${e.path || "root"}`, phase, lesson: "language", title: "Revisa el símbolo o su aridad", detail: e.message }; }
  if (phase === "interpretation" && state.interpErrors.length) { const e = state.interpErrors[0]; return { key: `interpretation:${e.code}:${e.path || "root"}`, phase, lesson: "interpretation", title: "Revisa la interpretación", detail: e.message }; }
  if ((phase === "formula" || phase === "evaluation") && state.analysis?.errors?.length) { const e = state.analysis.errors[0]; return { key: `formula:${e.code}:${e.start}`, phase: "formula", lesson: "formula", title: "Revisa la construcción de la fórmula", detail: e.message }; }
  if ((phase === "formula" || phase === "evaluation") && !(($("#formula-input") as HTMLTextAreaElement).value.trim())) return { key: "formula:EMPTY", phase: "formula", lesson: "formula", title: "Falta una fórmula", detail: "Escribe una fórmula antes de continuar hacia la evaluación." };
  if ((phase === "formula" || phase === "evaluation") && state.analysis?.freeVars?.some((v) => !state.domain.includes(state.env[v]))) { const v = state.analysis.freeVars.find((x) => !state.domain.includes(state.env[x])) || "la variable"; return { key: `formula:ENV_MISSING:${v}`, phase: "formula", lesson: "formula", title: "Falta una asignación para una variable libre", detail: `Asigna ${v} a un elemento del dominio.` }; }
  return null;
}
function clearContextHelp() { contextHelp.replaceChildren(); contextHelp.classList.add("hidden"); }
function showContextHelp(issue: HelpIssue) { const card = document.createElement("div"); card.className = "context-help-card"; const label = document.createElement("span"); label.className = "mini-label"; label.textContent = "AYUDA CONTEXTUAL"; const title = document.createElement("strong"); title.textContent = issue.title; const detail = document.createElement("p"); detail.textContent = issue.detail; const actions = document.createElement("div"); const open = document.createElement("button"); open.className = "button small primary"; open.textContent = "Ver explicación"; const dismiss = document.createElement("button"); dismiss.className = "button small"; dismiss.textContent = "Ahora no"; const disable = document.createElement("button"); disable.className = "text-button"; disable.textContent = "Desactivar sugerencias automáticas"; actions.append(open, dismiss); card.append(label, title, detail, actions, disable); contextHelp.replaceChildren(card); contextHelp.classList.remove("hidden"); open.addEventListener("click", () => openLearning(issue.lesson, issue.phase)); dismiss.addEventListener("click", () => { helpDismissed.add(issue.key); clearContextHelp(); }); disable.addEventListener("click", () => { suggestionsDisabled = true; clearContextHelp(); }); }
function recordHelpAttempt(phase: string) { if (suggestionsDisabled || suggestionsPaused) return; const issue = issueForPhase(phase); if (!issue) return; const count = (helpAttempts.get(issue.key) || 0) + 1; helpAttempts.set(issue.key, count); const last = helpSuggestedAt.get(issue.key) || 0; if (count >= 3 && !helpDismissed.has(issue.key) && Date.now() - last >= 120000) { helpSuggestedAt.set(issue.key, Date.now()); showContextHelp(issue); } }
function renderLesson(id: string) {
  const lesson = LEARN_LESSONS.find((item) => item.id === id) || LEARN_LESSONS[0];
  const paragraphsHtml = lesson.paragraphs.map((p) => `<p>${escapeHTML(p)}</p>`).join("");
  const actionHtml =
    lesson.actionButton.kind === "example"
      ? `<button class="button small primary" data-learning-example="${escapeHTML(lesson.actionButton.exampleId)}">${escapeHTML(lesson.actionButton.label)}</button>`
      : `<button class="button small primary" data-go-phase="${escapeHTML(lesson.actionButton.phase)}">${escapeHTML(lesson.actionButton.label)}</button>`;
  const historyHtml = lesson.historyLink
    ? `<p><a href="${escapeHTML(lesson.historyLink.hash)}" data-history-hash="${escapeHTML(lesson.historyLink.hash)}">${escapeHTML(lesson.historyLink.label)}</a></p>`
    : "";

  lessonContent.innerHTML = `
    <span class="phase-label">${escapeHTML(lesson.kicker)}</span>
    <h2>${escapeHTML(lesson.title)}</h2>
    <p class="lesson-lead">${escapeHTML(lesson.lead)}</p>
    ${paragraphsHtml}
    <div class="lesson-visual">
      <div><strong>${escapeHTML(lesson.exampleLabel)}</strong><code>${escapeHTML(lesson.exampleCode)}</code><small>${escapeHTML(lesson.exampleSummary)}</small></div>
    </div>
    <div class="lesson-connection">
      <strong>Dónde se hace en la aplicación</strong>
      <span>${escapeHTML(lesson.whereText)}</span>
      ${actionHtml}
    </div>
    ${historyHtml}
  `;

  $$(".lesson-link").forEach((b) => b.classList.toggle("active", (b as HTMLElement).dataset.lesson === lesson.id));
  requestAnimationFrame(() => {
    const active = $(".lesson-link.active") as HTMLElement | null;
    const nav = $(".lesson-nav") as HTMLElement;
    if (active) {
      const navBox = nav.getBoundingClientRect();
      const activeBox = active.getBoundingClientRect();
      nav.scrollLeft += activeBox.left - navBox.left - (nav.clientWidth - active.clientWidth) / 2;
    }
  });
  lessonContent.querySelectorAll<HTMLElement>("[data-learning-example]").forEach((b) =>
    b.addEventListener("click", () => loadExample(b.dataset.learningExample || "")),
  );
  lessonContent.querySelectorAll<HTMLElement>("[data-go-phase]").forEach((b) =>
    b.addEventListener("click", () => openPhase(b.dataset.goPhase || "language", "forward")),
  );
  lessonContent.querySelectorAll<HTMLElement>("[data-history-hash]").forEach((a) =>
    a.addEventListener("click", (event) => {
      event.preventDefault();
      const parsed = parseHash(a.dataset.historyHash || "#historia/8", navState.phase);
      applyNavState(parsed, true, "forward", false);
    }),
  );
}
function openLearning(id = "start", returnPhase: string = navState.phase) {
  learningReturnPhase = returnPhase;
  applyNavState(openAuxView(navState, "aprender"), true, "forward", false);
  renderLesson(id);
  lessonContent.focus({ preventScroll: true });
}
function closeLearning() {
  applyNavState(setPhase(navState, learningReturnPhase as PhaseId), true, "back", true);
}
const historyUI = createHistoryUI(
  () => {
    applyNavState(setPhase(navState, learningReturnPhase as PhaseId), true, "back", true);
  },
  (_chapterId, number1Based) => {
    if (navState.auxView === "historia") {
      navState = { ...navState, historyChapter: String(number1Based) };
      const targetHash = formatHash(navState);
      if (location.hash !== targetHash) history.pushState(null, "", targetHash);
    }
  },
  () => {
    setPeek("left", !leftPeek);
    if (leftPeek) (sidebarEl.querySelector("a, button") as HTMLElement | null)?.focus();
  },
);
historyUI.setRenderHook((chapter, slots) => {
  attachHistoryDemos(chapter, slots, {
    loadPresetInEvaluator(preset, runModelSearch) {
      if (hasUserWork() && (!state.example || exampleDirty) && !window.confirm("Este ejemplo de Historia reemplazará los datos que editaste. ¿Quieres continuar?")) return;
      applyingExample = true;
      language.load(preset.language);
      interpretation.load(preset.interpretation);
      formula.load(preset.input, preset.env);
      applyingExample = false;
      exampleDirty = false;
      window.scrollTo(0, 0);
      applyNavState(setPhase(navState, "evaluation"), true, "forward", true);
      if (runModelSearch) {
        const limitInput = $("#model-search-limit") as HTMLInputElement | null;
        if (limitInput) limitInput.value = String(preset.searchLimit ?? 2);
        setTimeout(() => ($("#search-models") as HTMLButtonElement | null)?.click(), 80);
      }
    }
  });
});
function openHistory(chapterId?: string, returnPhase: string = navState.phase || "language") {
  learningReturnPhase = returnPhase;
  applyNavState(openAuxView(navState, "historia", chapterId ?? null), true, "forward", false);
}
$("#toggle-history").addEventListener("click", () => {
  if (navState.auxView === "historia") closeLearning();
  else openHistory();
});
$("#toggle-learn").addEventListener("click", () => {
  if (navState.auxView === "aprender") closeLearning();
  else openLearning();
});
$("#back-to-work").addEventListener("click", closeLearning); $$(".lesson-link").forEach((b) => b.addEventListener("click", () => renderLesson((b as HTMLElement).dataset.lesson || "start"))); renderLesson("start");

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
document.addEventListener("pointerdown", (event) => {
  if (!navState.focusMode) return;
  const target = event.target as Node | null;
  if (!target) return;
  const menuBtn = document.getElementById("history-toggle-menu");
  const insideLeft =
    sidebarEl.contains(target) ||
    focusHandleLeft.contains(target) ||
    (menuBtn ? menuBtn.contains(target) : false);
  const insideRight = modelRailEl.contains(target) || focusHandleRight.contains(target);
  if ((leftPeek && !insideLeft) || (rightPeek && !insideRight)) {
    if (!insideLeft) leftPeek = false;
    if (!insideRight) rightPeek = false;
    if (!insideLeft && sidebarEl.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    if (!insideRight && modelRailEl.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    syncFocusSidebars();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!appearanceMenu.classList.contains("hidden")) { event.preventDefault(); closeAppearance(); return; }
  if (!tutorial.classList.contains("hidden")) { event.preventDefault(); closeTutorial(); return; }
  if (navState.focusMode && (leftPeek || rightPeek || sidebarEl.matches(":focus-within") || modelRailEl.matches(":focus-within"))) {
    event.preventDefault();
    leftPeek = false;
    rightPeek = false;
    if (sidebarEl.contains(document.activeElement) || modelRailEl.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    syncFocusSidebars();
  }
});
if (location.hash) enterEvaluator(false);
