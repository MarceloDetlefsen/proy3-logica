import { escapeHTML } from "../state.js";
import { HISTORY_CHAPTERS, type HistoryChapter } from "./chapters.js";

const VISITED_KEY = "parcial3-history-visited-v1";

export type HistoryRenderHook = (
  chapter: HistoryChapter,
  slots: { demoHost: HTMLElement; quizHost: HTMLElement; portraitHost: HTMLElement }
) => void;

export interface HistoryController {
  open: (chapterId?: string) => void;
  getActiveId: () => string;
  setRenderHook: (hook: HistoryRenderHook) => void;
}

function loadVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (!raw) return new Set([HISTORY_CHAPTERS[0].id]);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set([HISTORY_CHAPTERS[0].id]);
  } catch {
    return new Set([HISTORY_CHAPTERS[0].id]);
  }
}

function saveVisited(visited: Set<string>) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
  } catch {
    // Ignorar en entornos sin localStorage.
  }
}

export function createHistoryUI(
  onBack: () => void,
  onChapterChange?: (chapterId: string, number1Based: number) => void,
  onToggleMenu?: () => void,
): HistoryController {
  // Retratos, créditos y contenido son locales: Historia funciona sin red y se
  // publica junto al mismo build estático de GitHub Pages.
  const root = document.getElementById("history-view");
  if (!root) {
    return {
      open: () => {},
      getActiveId: () => HISTORY_CHAPTERS[0].id,
      setRenderHook: () => {}
    };
  }

  let activeIndex = 0;
  const visited = loadVisited();
  let renderHook: HistoryRenderHook | null = null;

  root.innerHTML = `
    <div class="history-header">
      <button class="button history-header-back" id="history-back-to-work" type="button">← Volver al evaluador</button>
      <div class="history-header-center">
        <div class="history-header-meta">
          <span class="phase-label">HISTORIA · DE EUCLIDES A TURING</span>
          <span class="progress-pill" id="history-progress" aria-live="polite"></span>
        </div>
        <h2 id="history-title">¿Cómo descubrimos los límites de la lógica?</h2>
      </div>
      <button class="button history-header-menu" id="history-toggle-menu" type="button" aria-expanded="false" aria-controls="evaluator-sidebar">Menú</button>
    </div>
    <nav class="history-timeline" id="history-timeline" aria-label="Línea de tiempo histórica"></nav>
    <article class="history-stage" id="history-stage" tabindex="-1" aria-live="polite"></article>
    <details class="history-credits" id="history-credits">
      <summary>Créditos de imágenes y fuentes (11 retratos locales)</summary>
      <div class="history-credits-grid" id="history-credits-grid"></div>
    </details>
  `;

  const timeline = root.querySelector("#history-timeline") as HTMLElement;
  const stage = root.querySelector("#history-stage") as HTMLElement;
  const progress = root.querySelector("#history-progress") as HTMLElement;
  const creditsGrid = root.querySelector("#history-credits-grid") as HTMLElement;

  root.querySelector("#history-back-to-work")?.addEventListener("click", onBack);
  root.querySelector("#history-toggle-menu")?.addEventListener("click", () => onToggleMenu?.());

  const uniqueCredits = new Map<string, { src: string; caption: string; credit: string }>();
  for (const ch of HISTORY_CHAPTERS) {
    for (const p of ch.portraits) {
      if (!uniqueCredits.has(p.src)) {
        uniqueCredits.set(p.src, { src: p.src, caption: p.caption, credit: p.credit });
      }
    }
  }
  creditsGrid.innerHTML = [...uniqueCredits.values()]
    .map(
      (item) => `
      <div class="history-credit-item">
        <strong>${escapeHTML(item.caption)}</strong>
        <small>${escapeHTML(item.credit)}</small>
        <code>${escapeHTML(item.src)}</code>
      </div>`
    )
    .join("");

  function renderTimeline() {
    timeline.replaceChildren();
    HISTORY_CHAPTERS.forEach((chapter, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-step";
      btn.dataset.chapter = chapter.id;
      btn.setAttribute("aria-current", idx === activeIndex ? "step" : "false");
      if (idx === activeIndex) btn.classList.add("active");
      if (visited.has(chapter.id)) btn.classList.add("visited");
      btn.innerHTML = `<span class="history-step-num">${escapeHTML(chapter.number)}</span><span class="history-step-meta"><small>${escapeHTML(chapter.year)}</small><strong>${escapeHTML(chapter.title)}</strong></span>`;
      btn.addEventListener("click", () => selectChapter(idx, true));
      btn.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          const next = Math.min(HISTORY_CHAPTERS.length - 1, idx + 1);
          selectChapter(next, true);
          (timeline.children[next] as HTMLElement | undefined)?.focus();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          const prev = Math.max(0, idx - 1);
          selectChapter(prev, true);
          (timeline.children[prev] as HTMLElement | undefined)?.focus();
        }
      });
      timeline.append(btn);
    });
  }

  function selectChapter(idx: number, focusStage = false) {
    activeIndex = Math.max(0, Math.min(HISTORY_CHAPTERS.length - 1, idx));
    const chapter = HISTORY_CHAPTERS[activeIndex];
    visited.add(chapter.id);
    saveVisited(visited);
    const readLabel = visited.size === 1 ? "1 leído" : `${visited.size} leídos`;
    progress.textContent = `Capítulo ${chapter.number} / ${HISTORY_CHAPTERS.length} · ${readLabel}`;

    renderTimeline();

    const activeBtn = timeline.querySelector(".history-step.active") as HTMLElement | null;
    activeBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

    const renderPortrait = (p: (typeof chapter.portraits)[number]) => `
        <figure class="history-portrait">
          <img src="${escapeHTML(p.src)}" alt="${escapeHTML(p.alt)}" />
          <figcaption>
            <strong>${escapeHTML(p.caption)}</strong>
            <span>${escapeHTML(p.credit)}</span>
          </figcaption>
        </figure>`;

    const narrativeHtml = chapter.narrative.map((p) => `<p>${escapeHTML(p)}</p>`).join("");
    const sourcesHtml = chapter.sources.map((s) => `<li>${escapeHTML(s)}</li>`).join("");
    const hasTwoPortraits = chapter.portraits.length === 2;
    const copyHtml = `
        <div class="history-copy">
          <span class="phase-label">CAPÍTULO ${escapeHTML(chapter.number)} · ${escapeHTML(chapter.year)}</span>
          <h3>${escapeHTML(chapter.title)}</h3>
          <p class="history-subtitle">${escapeHTML(chapter.subtitle)}</p>
          <div class="history-narrative">${narrativeHtml}</div>
        </div>`;

    const chapterTopHtml = hasTwoPortraits
      ? `<div class="history-chapter-top has-two-portraits">
           <div class="history-portraits history-portraits-left">${renderPortrait(chapter.portraits[0])}</div>
           ${copyHtml}
           <div class="history-portraits history-portraits-right">${renderPortrait(chapter.portraits[1])}</div>
         </div>`
      : `<div class="history-chapter-top">
           <div class="history-portraits">${chapter.portraits.map(renderPortrait).join("")}</div>
           ${copyHtml}
         </div>`;

    stage.innerHTML = `
      ${chapterTopHtml}
      <div class="history-callouts">
        <div class="history-box">
          <span class="mini-label">IDEA CLAVE</span>
          <p>${escapeHTML(chapter.keyIdea)}</p>
        </div>
        <div class="history-box">
          <span class="mini-label">EJEMPLO CONCRETO</span>
          <p>${escapeHTML(chapter.example)}</p>
        </div>
        <div class="history-box">
          <span class="mini-label">CONEXIÓN CON ESTE PROYECTO</span>
          <p>${escapeHTML(chapter.projectConnection)}</p>
        </div>
      </div>
      <div class="history-demo-slot" id="history-demo-slot"></div>
      <div class="history-quiz-slot" id="history-quiz-slot"></div>
      <div class="history-sources">
        <span class="mini-label">FUENTES HISTÓRICAS</span>
        <ul>${sourcesHtml}</ul>
      </div>
      <div class="history-chapter-nav">
        <button class="button" id="history-prev-chapter" type="button" ${activeIndex === 0 ? "disabled" : ""}>← Capítulo anterior</button>
        <button class="button primary" id="history-next-chapter" type="button" ${activeIndex === HISTORY_CHAPTERS.length - 1 ? "disabled" : ""}>Siguiente capítulo →</button>
      </div>
    `;

    stage.querySelector("#history-prev-chapter")?.addEventListener("click", () => selectChapter(activeIndex - 1, true));
    stage.querySelector("#history-next-chapter")?.addEventListener("click", () => selectChapter(activeIndex + 1, true));

    const portraitHost = stage.querySelector(".history-portraits") as HTMLElement;
    const demoHost = stage.querySelector("#history-demo-slot") as HTMLElement;
    const quizHost = stage.querySelector("#history-quiz-slot") as HTMLElement;
    if (renderHook) {
      renderHook(chapter, { demoHost, quizHost, portraitHost });
    }

    if (focusStage) {
      stage.focus({ preventScroll: true });
    }
    onChapterChange?.(chapter.id, activeIndex + 1);
  }

  selectChapter(0, false);

  return {
    open(chapterId?: string) {
      if (chapterId) {
        const numeric = Number(chapterId);
        const idx =
          Number.isInteger(numeric) && numeric >= 1 && numeric <= HISTORY_CHAPTERS.length
            ? numeric - 1
            : HISTORY_CHAPTERS.findIndex((c) => c.id === chapterId);
        if (idx >= 0) selectChapter(idx, false);
        else selectChapter(activeIndex, false);
      } else {
        selectChapter(activeIndex, false);
      }
      stage.focus({ preventScroll: true });
    },
    getActiveId() {
      return HISTORY_CHAPTERS[activeIndex].id;
    },
    setRenderHook(hook: HistoryRenderHook) {
      renderHook = hook;
      selectChapter(activeIndex, false);
    }
  };
}
