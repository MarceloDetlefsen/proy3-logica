import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { LEARN_LESSONS, LEARN_VERIFIED_EXAMPLES } from "../web/build/src/learn/lessons.js";

test("Aprender cubre las 4 fases, incluye inicio y excluye Peano/Gödel como lecciones", () => {
  const ids = LEARN_LESSONS.map((l) => l.id);
  assert.deepEqual(ids, ["start", "language", "interpretation", "formula", "result", "search_export"]);
  assert.equal(LEARN_LESSONS[0].actionButton.kind, "example");
  assert.ok(LEARN_LESSONS.find((l) => l.id === "search_export")?.historyLink?.hash === "#historia/8");
});

test("todos los ejemplos de Aprender coinciden con el motor WASM", async () => {
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

  for (const [key, ex] of Object.entries(LEARN_VERIFIED_EXAMPLES)) {
    const res = JSON.parse(
      wasm.evaluate(
        JSON.stringify({
          language: ex.language,
          input: ex.input,
          interpretation: ex.interpretation,
          env: ex.env
        })
      )
    );
    if (ex.expectErrors) {
      assert.ok(res.errors.length > 0, `${key}: debía reportar errores`);
      assert.equal(res.result ?? null, null, `${key}: no debe emitir valor de verdad`);
      continue;
    }
    assert.equal(res.errors.length, 0, `${key}: no debía tener errores`);
    assert.equal(res.result.value, ex.expectedValue, `${key}: valor esperado`);
    if (ex.expectedWitness) {
      assert.deepEqual(res.result.explanation.witness, ex.expectedWitness, `${key}: testigo`);
    }
    if (ex.expectedCounterexample) {
      assert.deepEqual(res.result.explanation.counterexample, ex.expectedCounterexample, `${key}: contraejemplo`);
    }
  }

  // Ejemplo del buscador en la lección 5: ∀x P(x) con N = 2
  const searchRes = JSON.parse(
    wasm.searchModels(
      JSON.stringify({
        language: { funcs: {}, preds: { P: 1 } },
        input: "∀x P(x)",
        maxDomainSize: 2
      })
    )
  );
  assert.equal(searchRes.errors.length, 0);
  assert.equal(searchRes.satisfying.interpretation.domain.length, 1);
  assert.equal(searchRes.falsifying.interpretation.domain.length, 2);
});
