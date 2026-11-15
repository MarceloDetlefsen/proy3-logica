import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const distDir = path.resolve("dist");
const examplesDir = path.resolve("testdata/examples");

// Cargar wasm_exec.js de Go (expone globalThis.Go).
require(path.join(distDir, "wasm_exec.js"));

const wasmBytes = fs.readFileSync(path.join(distDir, "logic.wasm"));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
void go.run(instance);

const deadline = Date.now() + 5000;
while (!globalThis.proy3Wasm) {
  if (Date.now() > deadline) {
    throw new Error("proy3Wasm no se registró a tiempo.");
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
}

const wasm = globalThis.proy3Wasm;

function loadExample(name) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, `${name}.json`), "utf8"));
}

function evalPayload(example) {
  return JSON.stringify({
    language: example.language,
    input: example.input,
    interpretation: example.interpretation,
    env: example.env,
  });
}

// 1. Universal verdadero
{
  const ex = loadExample("universal-verdadero");
  const res = JSON.parse(wasm.evaluate(evalPayload(ex)));
  assert.equal(res.errors.length, 0);
  assert.equal(res.result.value, true);
  assert.equal(res.result.explanation.rule, "forall");
  assert.equal(res.result.explanation.checked, ex.interpretation.domain.length);
}

// 2. Universal falso con contraejemplo
{
  const ex = loadExample("sin-sucesor");
  const res = JSON.parse(wasm.evaluate(evalPayload(ex)));
  assert.equal(res.errors.length, 0);
  assert.equal(res.result.value, false);
  assert.ok(res.result.explanation.counterexample, "se esperaba contraejemplo");
}

// 3. Existencial verdadero con testigo
{
  const ex = loadExample("min-existe");
  const res = JSON.parse(wasm.evaluate(evalPayload(ex)));
  assert.equal(res.errors.length, 0);
  assert.equal(res.result.value, true);
  assert.ok(res.result.explanation.witness, "se esperaba testigo");
}

// 4. Caso inválido (dominio vacío)
{
  const ex = loadExample("invalido-dominio-vacio");
  const res = JSON.parse(wasm.evaluate(evalPayload(ex)));
  assert.ok(res.errors.length > 0, "se esperaban errores de validación");
  assert.equal(res.result, undefined);
  assert.ok(res.errors.some((e) => e.code === "DOMAIN_EMPTY"));
}

// 5. Exportación .tex en WASM
{
  const ex = loadExample("universal-verdadero");
  const res = JSON.parse(wasm.exportEvaluationTeX(evalPayload(ex)));
  assert.ok(typeof res.tex === "string" && res.tex.includes("\\documentclass[11pt]{article}"));
}

console.log("wasm-smoke: todos los casos verificados correctamente.");
process.exit(0);
