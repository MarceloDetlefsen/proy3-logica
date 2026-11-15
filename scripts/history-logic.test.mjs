import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import {
  cantorDiagonalStep,
  createUnaryAdditionMachine,
  decodeGodel,
  encodeGodel,
  HISTORY_PRESETS,
  stepTuringMachine,
  triangleAngleSum
} from "../web/build/src/history/logic.js";

test("encodeGodel y decodeGodel preservan la fórmula con BigInt", () => {
  for (const formula of ["0=0", "S(0)=0", "∀x(x=x)"]) {
    const enc = encodeGodel(formula);
    assert.ok(enc.number > 1n);
    const dec = decodeGodel(enc.number);
    assert.equal(dec.formula, formula);
  }
  assert.throws(() => encodeGodel(""));
  assert.throws(() => encodeGodel("0=0+S(0)=0+0"));
  assert.throws(() => encodeGodel("abc"));
  assert.throws(() => decodeGodel(1n));
});

test("cantorDiagonalStep difiere de cada fila k en la posición k", () => {
  const rows = ["0101", "1011", "0110", "1100"];
  const { flipped } = cantorDiagonalStep(rows, rows.length);
  assert.equal(flipped.length, rows.length);
  for (let k = 0; k < rows.length; k++) {
    assert.notEqual(flipped[k], rows[k][k]);
  }
});

test("stepTuringMachine suma 2 + 3 en unario y se detiene", () => {
  let state = createUnaryAdditionMachine(2, 3);
  while (state.state !== "HALT" && state.steps < 50) {
    state = stepTuringMachine(state);
  }
  assert.equal(state.state, "HALT");
  assert.equal(state.tape.filter((c) => c === "1").length, 5);
});

test("triangleAngleSum refleja las tres geometrías", () => {
  assert.equal(triangleAngleSum("euclid", 25), 180);
  assert.ok(triangleAngleSum("spherical", 25) > 180);
  assert.ok(triangleAngleSum("hyperbolic", 25) < 180);
});

test("presets de Historia se evalúan y buscan correctamente en WASM", async () => {
  const require = createRequire(import.meta.url);
  const distDir = path.resolve("dist");
  require(path.join(distDir, "wasm_exec.js"));

  const wasmBytes = fs.readFileSync(path.join(distDir, "logic.wasm"));
  const go = new globalThis.Go();
  const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
  void go.run(instance);

  const deadline = Date.now() + 5000;
  while (!globalThis.proy3Wasm) {
    if (Date.now() > deadline) throw new Error("proy3Wasm no se registró a tiempo.");
    await new Promise((r) => setTimeout(r, 10));
  }
  const wasm = globalThis.proy3Wasm;

  const syllogism = HISTORY_PRESETS.syllogism;
  const evalRes = JSON.parse(
    wasm.evaluate(
      JSON.stringify({
        language: syllogism.language,
        input: syllogism.input,
        interpretation: syllogism.interpretation,
        env: syllogism.env
      })
    )
  );
  assert.equal(evalRes.errors.length, 0);
  assert.equal(evalRes.result.value, true);

  const barber = HISTORY_PRESETS.barber;
  const barberRes = JSON.parse(
    wasm.searchModels(
      JSON.stringify({
        language: barber.language,
        input: barber.input,
        maxDomainSize: barber.searchLimit ?? 2
      })
    )
  );
  assert.equal(barberRes.errors.length, 0);
  assert.equal(barberRes.satisfying ?? null, null);
  assert.ok(barberRes.falsifying);

  const order = HISTORY_PRESETS.infinite_order;
  const orderRes = JSON.parse(
    wasm.searchModels(
      JSON.stringify({
        language: order.language,
        input: order.input,
        maxDomainSize: order.searchLimit ?? 2
      })
    )
  );
  assert.equal(orderRes.errors.length, 0);
  assert.equal(orderRes.satisfying ?? null, null);
  assert.ok(orderRes.falsifying);
});
