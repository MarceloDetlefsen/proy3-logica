#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Verificando paquetes Go para WebAssembly (GOOS=js GOARCH=wasm)..."
GOOS=js GOARCH=wasm go vet ./internal/... ./cmd/wasm

./scripts/build-pages.sh
./scripts/check-pages.sh
node scripts/wasm-smoke.mjs
node --test scripts/navigation.test.mjs
node --test scripts/history-logic.test.mjs
node --test scripts/learn.test.mjs
