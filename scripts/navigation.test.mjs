import test from "node:test";
import assert from "node:assert/strict";

import {
  closeAuxView,
  createInitialNavState,
  formatHash,
  openAuxView,
  parseHash,
  setPhase,
} from "../web/build/src/navigation.js";

test("abrir una vista auxiliar cierra las demás y preserva la fase", () => {
  let state = createInitialNavState("formula");
  assert.equal(state.auxView, null);
  assert.equal(state.focusMode, false);

  state = openAuxView(state, "ejemplos");
  assert.equal(state.auxView, "ejemplos");
  assert.equal(state.phase, "formula");
  assert.equal(state.focusMode, false);

  state = openAuxView(state, "aprender");
  assert.equal(state.auxView, "aprender");
  assert.equal(state.phase, "formula");
  assert.equal(state.focusMode, false);

  state = openAuxView(state, "historia", "9");
  assert.equal(state.auxView, "historia");
  assert.equal(state.historyChapter, "9");
  assert.equal(state.phase, "formula");
  assert.equal(state.focusMode, true);

  state = openAuxView(state, "aprender");
  assert.equal(state.auxView, "aprender");
  assert.equal(state.focusMode, false);

  state = closeAuxView(state);
  assert.equal(state.auxView, null);
  assert.equal(state.phase, "formula");
  assert.equal(state.focusMode, false);
});

test("setPhase cierra la vista auxiliar y desactiva modo enfoque", () => {
  let state = openAuxView(createInitialNavState("language"), "historia", "4");
  assert.equal(state.focusMode, true);

  state = setPhase(state, "evaluation");
  assert.equal(state.phase, "evaluation");
  assert.equal(state.auxView, null);
  assert.equal(state.focusMode, false);
});

test("parseHash y formatHash funcionan en ambos sentidos y toleran hashes inválidos", () => {
  assert.deepEqual(parseHash("#aprender"), {
    phase: "language",
    auxView: "aprender",
    historyChapter: null,
    focusMode: false,
  });
  assert.equal(formatHash(parseHash("#aprender")), "#aprender");

  assert.deepEqual(parseHash("#ejemplos"), {
    phase: "language",
    auxView: "ejemplos",
    historyChapter: null,
    focusMode: false,
  });
  assert.equal(formatHash(parseHash("#ejemplos")), "#ejemplos");

  const h9 = parseHash("#historia/9");
  assert.equal(h9.auxView, "historia");
  assert.equal(h9.historyChapter, "9");
  assert.equal(h9.focusMode, true);
  assert.equal(formatHash(h9), "#historia/9");

  assert.deepEqual(parseHash("#evaluation"), {
    phase: "evaluation",
    auxView: null,
    historyChapter: null,
    focusMode: false,
  });
  assert.equal(formatHash(parseHash("#evaluation")), "#evaluation");

  // Hash desconocido o con "/" inicial vuelve al evaluador sin error
  assert.deepEqual(parseHash("#desconocido", "interpretation"), {
    phase: "interpretation",
    auxView: null,
    historyChapter: null,
    focusMode: false,
  });
  assert.deepEqual(parseHash("#/ruta/absoluta", "language"), {
    phase: "language",
    auxView: null,
    historyChapter: null,
    focusMode: false,
  });
});
