import { escapeHTML } from "../state.js";
import type { HistoryChapter } from "./chapters.js";
import {
  cantorDiagonalStep,
  createGliderGrid,
  createUnaryAdditionMachine,
  decodeGodel,
  encodeGodel,
  GODEL_ALPHABET,
  HISTORY_PRESETS,
  stepLifeGrid,
  stepTuringMachine,
  triangleAngleSum,
  type HistoryPreset
} from "./logic.js";

export interface HistoryHostActions {
  loadPresetInEvaluator: (preset: HistoryPreset, runModelSearch: boolean) => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function renderPresetActions(presetKey: string, actions: HistoryHostActions, includeSearch = false): HTMLElement {
  const preset = HISTORY_PRESETS[presetKey];
  const bar = document.createElement("div");
  bar.className = "history-demo-controls";

  const evalBtn = document.createElement("button");
  evalBtn.type = "button";
  evalBtn.className = "button small primary";
  evalBtn.textContent = "Cargar en el evaluador →";
  evalBtn.addEventListener("click", () => actions.loadPresetInEvaluator(preset, false));
  bar.append(evalBtn);

  if (includeSearch) {
    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "button small";
    searchBtn.textContent = `Probar en buscador (N = ${preset.searchLimit ?? 2}) →`;
    searchBtn.addEventListener("click", () => actions.loadPresetInEvaluator(preset, true));
    bar.append(searchBtn);
  }
  return bar;
}

function renderGeometryDemo(host: HTMLElement, defaultMode: "euclid" | "spherical" | "hyperbolic") {
  let mode: "euclid" | "spherical" | "hyperbolic" = defaultMode;
  let curvature = defaultMode === "euclid" ? 0 : 28;

  host.innerHTML = `
    <div class="history-demo-card">
      <span class="mini-label">ANIMACIÓN INTERACTIVA · GEOMETRÍA Y MODELOS</span>
      <div class="history-demo-controls">
        <button class="button small" data-geo="euclid" type="button">Euclideana (180°)</button>
        <button class="button small" data-geo="spherical" type="button">Esférica (&gt; 180°)</button>
        <button class="button small" data-geo="hyperbolic" type="button">Hiperbólica (&lt; 180°)</button>
      </div>
      <div class="history-demo-stage" id="geo-stage"></div>
    </div>
  `;

  const stage = host.querySelector("#geo-stage") as HTMLElement;
  function draw() {
    const sum = triangleAngleSum(mode, curvature);
    const bend = mode === "spherical" ? -26 : mode === "hyperbolic" ? 26 : 0;
    const label =
      mode === "euclid"
        ? "Plano euclideano: 1 paralela por punto exterior"
        : mode === "spherical"
          ? "Superficie esférica: 0 paralelas (geodésicas se cruzan)"
          : "Plano hiperbólico: infinitas paralelas";

    stage.innerHTML = `
      <svg viewBox="0 0 300 130" width="280" height="122" role="img" aria-label="${escapeHTML(label)}">
        <path d="M 55 105 Q 150 ${105 + bend} 245 105 Q ${200 - bend * 0.6} 62 150 22 Q ${100 + bend * 0.6} 62 55 105 Z"
              fill="rgba(96,165,250,0.16)" stroke="currentColor" stroke-width="2"/>
        <text x="150" y="76" text-anchor="middle" fill="currentColor" font-size="14" font-weight="700">Suma ≈ ${sum}°</text>
      </svg>
      <p class="muted">${escapeHTML(label)}</p>
    `;
    host.querySelectorAll<HTMLButtonElement>("[data-geo]").forEach((b) => {
      b.classList.toggle("primary", b.dataset.geo === mode);
    });
  }

  host.querySelectorAll<HTMLButtonElement>("[data-geo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = (btn.dataset.geo as typeof mode) || "euclid";
      curvature = mode === "euclid" ? 0 : 28;
      draw();
    });
  });
  draw();
}

function renderCantorDemo(host: HTMLElement) {
  const rows = ["01010", "10110", "01101", "11001", "00111"];
  let revealed = prefersReducedMotion() ? rows.length : 1;
  let timer: number | null = null;

  host.innerHTML = `
    <div class="history-demo-card">
      <span class="mini-label">ANIMACIÓN INTERACTIVA · DIAGONAL DE CANTOR</span>
      <div class="history-demo-controls">
        <button class="button small primary" id="cantor-play" type="button">Reproducir / Pausar</button>
        <button class="button small" id="cantor-step" type="button">Paso</button>
        <button class="button small" id="cantor-reset" type="button">Reiniciar</button>
      </div>
      <div class="history-demo-stage" id="cantor-stage"></div>
    </div>
  `;

  const stage = host.querySelector("#cantor-stage") as HTMLElement;
  const playBtn = host.querySelector("#cantor-play") as HTMLButtonElement;

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    playBtn.textContent = "Reproducir";
  }

  function render() {
    const { diagonal, flipped } = cantorDiagonalStep(rows, revealed);
    const matrixHtml = rows
      .map((row, r) => {
        const cells = [...row]
          .map((ch, c) => {
            const cls = r === c && r < revealed ? "history-cell diag" : "history-cell";
            return `<span class="${cls}">${ch}</span>`;
          })
          .join("");
        return `<div class="history-matrix-row"><small>f(${r + 1}) =</small>${cells}</div>`;
      })
      .join("");

    const newRowHtml = flipped
      .map((bit) => `<span class="history-cell flipped">${bit}</span>`)
      .join("");

    stage.innerHTML = `
      <div class="history-matrix">${matrixHtml}</div>
      <p class="muted">Diagonal leída (${revealed}/${rows.length}): <code>${diagonal.join("") || "—"}</code> → Nueva fila invertida:</p>
      <div class="history-matrix-row"><small>nueva =</small>${newRowHtml || "<small>pulsa Paso</small>"}</div>
    `;
  }

  playBtn.addEventListener("click", () => {
    if (timer !== null) {
      stop();
      return;
    }
    if (prefersReducedMotion()) {
      revealed = rows.length;
      render();
      return;
    }
    if (revealed >= rows.length) revealed = 0;
    playBtn.textContent = "Pausar";
    timer = window.setInterval(() => {
      if (revealed >= rows.length) {
        stop();
        return;
      }
      revealed++;
      render();
    }, 650);
  });

  host.querySelector("#cantor-step")?.addEventListener("click", () => {
    stop();
    revealed = revealed < rows.length ? revealed + 1 : rows.length;
    render();
  });
  host.querySelector("#cantor-reset")?.addEventListener("click", () => {
    stop();
    revealed = 0;
    render();
  });

  render();
}

function renderGodelDemo(host: HTMLElement) {
  const alphabetTags = Object.entries(GODEL_ALPHABET)
    .map(([sym, code]) => `<code>${escapeHTML(sym)}→${code}</code>`)
    .join(" ");

  host.innerHTML = `
    <div class="history-demo-card">
      <span class="mini-label">DEMO INTERACTIVA · NUMERACIÓN DE GÖDEL (BigInt)</span>
      <p class="muted">Alfabeto: ${alphabetTags}</p>
      <div class="history-demo-controls">
        <label for="godel-input">Fórmula (máx. 10 símbolos):</label>
        <input class="input" id="godel-input" value="0=0" maxlength="10" />
        <button class="button small primary" id="godel-encode" type="button">Codificar y decodificar</button>
      </div>
      <div class="history-demo-stage" id="godel-stage"></div>
    </div>
  `;

  const input = host.querySelector("#godel-input") as HTMLInputElement;
  const stage = host.querySelector("#godel-stage") as HTMLElement;

  function run() {
    try {
      const enc = encodeGodel(input.value);
      const dec = decodeGodel(enc.number);
      const factorText = enc.factors.map((f) => `${f.prime}^${f.exp}`).join(" · ");
      stage.innerHTML = `
        <p><strong>Factorización prima:</strong> <code>${escapeHTML(factorText)}</code></p>
        <p><strong>Número de Gödel:</strong> <code>${enc.number.toString()}</code></p>
        <p><strong>Decodificado desde el entero:</strong> <code>${escapeHTML(dec.formula)}</code></p>
      `;
    } catch (error) {
      stage.innerHTML = `<p class="generation-status error">${escapeHTML((error as Error).message)}</p>`;
    }
  }

  host.querySelector("#godel-encode")?.addEventListener("click", run);
  run();
}

function renderTuringDemo(host: HTMLElement) {
  let machine = createUnaryAdditionMachine(2, 3);
  let timer: number | null = null;

  host.innerHTML = `
    <div class="history-demo-card">
      <span class="mini-label">ANIMACIÓN INTERACTIVA · MÁQUINA DE TURING (SUMA UNARIA 2 + 3)</span>
      <div class="history-demo-controls">
        <button class="button small primary" id="tm-play" type="button">Reproducir / Pausar</button>
        <button class="button small" id="tm-step" type="button">Paso</button>
        <button class="button small" id="tm-reset" type="button">Reiniciar</button>
      </div>
      <div class="history-demo-stage" id="tm-stage"></div>
    </div>
  `;

  const stage = host.querySelector("#tm-stage") as HTMLElement;
  const playBtn = host.querySelector("#tm-play") as HTMLButtonElement;

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    playBtn.textContent = "Reproducir";
  }

  function render() {
    const cells = machine.tape
      .map((sym, idx) => `<span class="${idx === machine.head ? "history-tape-cell head" : "history-tape-cell"}">${escapeHTML(sym)}</span>`)
      .join("");
    const ones = machine.tape.filter((c) => c === "1").length;
    stage.innerHTML = `
      <div class="history-tape">${cells}</div>
      <p class="muted">Estado: <code>${machine.state}</code> · Pasos: <code>${machine.steps}</code> · Cabezal: <code>${machine.head}</code>${machine.state === "HALT" ? ` · Resultado: <strong>${ones}</strong>` : ""}</p>
    `;
  }

  playBtn.addEventListener("click", () => {
    if (timer !== null) {
      stop();
      return;
    }
    if (prefersReducedMotion()) {
      while (machine.state !== "HALT" && machine.steps < 30) machine = stepTuringMachine(machine);
      render();
      return;
    }
    playBtn.textContent = "Pausar";
    timer = window.setInterval(() => {
      if (machine.state === "HALT") {
        stop();
        return;
      }
      machine = stepTuringMachine(machine);
      render();
    }, 450);
  });

  host.querySelector("#tm-step")?.addEventListener("click", () => {
    stop();
    machine = stepTuringMachine(machine);
    render();
  });
  host.querySelector("#tm-reset")?.addEventListener("click", () => {
    stop();
    machine = createUnaryAdditionMachine(2, 3);
    render();
  });

  render();
}

function renderLambdaDemo(host: HTMLElement) {
  const steps = [
    "(λx. x + 1) 4   [expresión inicial]",
    "4 + 1           [β-reducción: sustituir x por 4]",
    "5               [forma normal irreducible]"
  ];
  let idx = 0;
  host.innerHTML = `
    <div class="history-demo-card">
      <span class="mini-label">ANIMACIÓN PASO A PASO · REDUCCIÓN EN CÁLCULO LAMBDA</span>
      <div class="history-demo-controls">
        <button class="button small primary" id="lambda-step" type="button">Siguiente reducción →</button>
        <button class="button small" id="lambda-reset" type="button">Reiniciar</button>
      </div>
      <div class="history-demo-stage"><code id="lambda-expr"></code></div>
    </div>
  `;
  const expr = host.querySelector("#lambda-expr") as HTMLElement;
  const update = () => { expr.textContent = steps[idx]; };
  host.querySelector("#lambda-step")?.addEventListener("click", () => { idx = Math.min(steps.length - 1, idx + 1); update(); });
  host.querySelector("#lambda-reset")?.addEventListener("click", () => { idx = 0; update(); });
  update();
}

function renderQuiz(quizHost: HTMLElement, chapter: HistoryChapter) {
  const card = document.createElement("div");
  card.className = "history-quiz-card";
  card.innerHTML = `<span class="mini-label">AUTOEVALUACIÓN RÁPIDA (2 PREGUNTAS)</span>`;

  chapter.quiz.forEach((q, qIdx) => {
    const qWrap = document.createElement("div");
    qWrap.className = "history-quiz-q";
    const title = document.createElement("strong");
    title.textContent = `${qIdx + 1}. ${q.question}`;
    const opts = document.createElement("div");
    opts.className = "history-quiz-options";
    const feedback = document.createElement("p");
    feedback.className = "history-quiz-feedback";

    q.options.forEach((optText, optIdx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-quiz-opt";
      btn.textContent = optText;
      btn.addEventListener("click", () => {
        opts.querySelectorAll("button").forEach((b, i) => {
          b.classList.remove("correct", "wrong");
          if (i === q.correctIndex) b.classList.add("correct");
          else if (i === optIdx) b.classList.add("wrong");
        });
        feedback.textContent = (optIdx === q.correctIndex ? "Correcto. " : "Revisa la idea clave: ") + q.explanation;
      });
      opts.append(btn);
    });

    qWrap.append(title, opts, feedback);
    card.append(qWrap);
  });

  quizHost.replaceChildren(card);
}

function renderGliderVisual(host: HTMLElement) {
  const size = 8;
  let grid = createGliderGrid(size);
  let generation = 0;
  let timer: number | null = null;
  const reduced = prefersReducedMotion();

  const figure = document.createElement("figure");
  figure.className = "history-portrait glider-figure";
  figure.innerHTML = `
    <div class="glider-canvas-wrap">
      <svg class="glider-svg" viewBox="0 0 160 160" role="img" aria-label="Animación de un planeador (glider) en el Juego de la Vida de Conway"></svg>
    </div>
    <div class="glider-controls">
      <button class="button small primary" id="glider-play" type="button">${reduced ? "Animar" : "Reproducir"}</button>
      <button class="button small" id="glider-step" type="button">Paso</button>
      <button class="button small" id="glider-reset" type="button">Reiniciar</button>
    </div>
    <figcaption>
      <strong>Ilustración propia: planeador (glider) del Juego de la Vida</strong>
      <span id="glider-gen">Generación 0</span>
    </figcaption>
  `;

  const svg = figure.querySelector(".glider-svg") as SVGSVGElement;
  const playBtn = figure.querySelector("#glider-play") as HTMLButtonElement;
  const genLabel = figure.querySelector("#glider-gen") as HTMLElement;

  function draw() {
    const cell = 20;
    const rects: string[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const alive = grid[r][c];
        rects.push(
          `<rect x="${c * cell + 1}" y="${r * cell + 1}" width="${cell - 2}" height="${cell - 2}" rx="3" class="${alive ? "glider-cell alive" : "glider-cell"}" />`,
        );
      }
    }
    svg.innerHTML = rects.join("");
    genLabel.textContent = `Generación ${generation}`;
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    playBtn.textContent = "Reproducir";
  }

  playBtn.addEventListener("click", () => {
    if (timer !== null) {
      stop();
      return;
    }
    if (prefersReducedMotion()) {
      grid = stepLifeGrid(grid);
      generation++;
      draw();
      return;
    }
    playBtn.textContent = "Pausar";
    timer = window.setInterval(() => {
      if (!document.body.contains(figure)) {
        stop();
        return;
      }
      grid = stepLifeGrid(grid);
      generation++;
      draw();
    }, 320);
  });

  figure.querySelector("#glider-step")?.addEventListener("click", () => {
    stop();
    grid = stepLifeGrid(grid);
    generation++;
    draw();
  });

  figure.querySelector("#glider-reset")?.addEventListener("click", () => {
    stop();
    grid = createGliderGrid(size);
    generation = 0;
    draw();
  });

  draw();
  host.replaceChildren(figure);
}

export function attachHistoryDemos(
  chapter: HistoryChapter,
  slots: { demoHost: HTMLElement; quizHost: HTMLElement; portraitHost?: HTMLElement },
  actions: HistoryHostActions
) {
  const { demoHost, quizHost, portraitHost } = slots;
  demoHost.replaceChildren();
  if (chapter.visualKind === "glider" && portraitHost) {
    renderGliderVisual(portraitHost);
  }

  switch (chapter.demoKind) {
    case "euclid":
      renderGeometryDemo(demoHost, "euclid");
      break;
    case "noneuclid":
      renderGeometryDemo(demoHost, "hyperbolic");
      break;
    case "cantor":
      renderCantorDemo(demoHost);
      break;
    case "syllogism":
    case "tarski": {
      const card = document.createElement("div");
      card.className = "history-demo-card";
      card.innerHTML = `<span class="mini-label">PRUEBA EN VIVO CON EL EVALUADOR</span><p class="muted">Carga el silogismo <code>(∀x (H(x) → M(x)) ∧ H(s)) → M(s)</code> con Sócrates y Platón en el dominio.</p>`;
      card.append(renderPresetActions("syllogism", actions, false));
      demoHost.append(card);
      break;
    }
    case "russell": {
      const card = document.createElement("div");
      card.className = "history-demo-card";
      card.innerHTML = `<span class="mini-label">PRUEBA EN VIVO · PARADOJA DEL BARBERO</span><p class="muted">Carga <code>∃b ∀x (Afeita(b,x) ↔ ¬Afeita(x,x))</code> y comprueba con el buscador que no tiene modelos en dominios finitos.</p>`;
      card.append(renderPresetActions("barber", actions, true));
      demoHost.append(card);
      break;
    }
    case "hilbert":
    case "legacy": {
      const card = document.createElement("div");
      card.className = "history-demo-card";
      card.innerHTML = `<span class="mini-label">PRUEBA EN VIVO · FÓRMULA QUE EXIGE INFINITO</span><p class="muted">Un orden estricto sin elemento máximo es satisfacible en los naturales ℕ, pero no tiene ningún modelo finito.</p>`;
      card.append(renderPresetActions("infinite_order", actions, true));
      demoHost.append(card);
      break;
    }
    case "godel":
      renderGodelDemo(demoHost);
      break;
    case "turing":
      renderTuringDemo(demoHost);
      break;
    case "church":
      renderLambdaDemo(demoHost);
      break;
  }

  renderQuiz(quizHost, chapter);
}
