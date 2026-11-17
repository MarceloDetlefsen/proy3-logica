export type AuxView = "aprender" | "ejemplos" | "historia" | null;
export type PhaseId = "language" | "interpretation" | "formula" | "evaluation";

export interface NavState {
  phase: PhaseId;
  auxView: AuxView;
  historyChapter: string | null;
  focusMode: boolean;
}

// Un único auxView hace mutuamente excluyentes Aprender, Ejemplos e Historia;
// cambiar de vista conserva los datos de las cuatro fases del evaluador.

const VALID_PHASES: readonly PhaseId[] = [
  "language",
  "interpretation",
  "formula",
  "evaluation",
];

export function createInitialNavState(phase: PhaseId = "language"): NavState {
  return {
    phase,
    auxView: null,
    historyChapter: null,
    focusMode: false,
  };
}

export function openAuxView(
  current: NavState,
  view: Exclude<AuxView, null>,
  chapter?: string | null,
): NavState {
  return {
    phase: current.phase,
    auxView: view,
    historyChapter:
      view === "historia"
        ? (chapter ?? current.historyChapter)
        : current.historyChapter,
    focusMode: view === "historia",
  };
}

export function closeAuxView(current: NavState): NavState {
  return {
    ...current,
    auxView: null,
    focusMode: false,
  };
}

export function setPhase(current: NavState, phase: PhaseId): NavState {
  return {
    ...current,
    phase,
    auxView: null,
    focusMode: false,
  };
}

export function parseHash(
  rawHash: string,
  fallbackPhase: PhaseId = "language",
): NavState {
  // Los fragmentos son relativos para funcionar bajo el subdirectorio que
  // GitHub Pages asigna al repositorio y conservar Atrás/Adelante del navegador.
  const clean = (rawHash || "").replace(/^#/, "").trim();
  if (!clean || clean.startsWith("/")) {
    return createInitialNavState(fallbackPhase);
  }
  if (clean === "aprender") {
    return openAuxView(createInitialNavState(fallbackPhase), "aprender");
  }
  if (clean === "ejemplos") {
    return openAuxView(createInitialNavState(fallbackPhase), "ejemplos");
  }
  if (clean === "historia" || clean.startsWith("historia/")) {
    const rest = clean.slice("historia".length).replace(/^\//, "").trim();
    const chapter = rest && /^[a-z0-9-]+$/i.test(rest) ? rest : null;
    return openAuxView(createInitialNavState(fallbackPhase), "historia", chapter);
  }
  if ((VALID_PHASES as readonly string[]).includes(clean)) {
    return createInitialNavState(clean as PhaseId);
  }
  return createInitialNavState(fallbackPhase);
}

export function formatHash(state: NavState): string {
  if (state.auxView === "aprender") return "#aprender";
  if (state.auxView === "ejemplos") return "#ejemplos";
  if (state.auxView === "historia") {
    return state.historyChapter
      ? `#historia/${state.historyChapter}`
      : "#historia";
  }
  return `#${state.phase}`;
}
