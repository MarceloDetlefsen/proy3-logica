#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST_DIR="$ROOT_DIR/dist"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/build" "$DIST_DIR/examples"

echo "Compilando frontend TypeScript..."
npm run build:web

echo "Compilando núcleo lógico a WebAssembly..."
GOOS=js GOARCH=wasm go build -trimpath -ldflags "-s -w" -o "$DIST_DIR/logic.wasm" ./cmd/wasm

GOROOT_DIR="$(go env GOROOT)"
if [ -f "$GOROOT_DIR/lib/wasm/wasm_exec.js" ]; then
  cp "$GOROOT_DIR/lib/wasm/wasm_exec.js" "$DIST_DIR/wasm_exec.js"
elif [ -f "$GOROOT_DIR/misc/wasm/wasm_exec.js" ]; then
  cp "$GOROOT_DIR/misc/wasm/wasm_exec.js" "$DIST_DIR/wasm_exec.js"
else
  echo "Error: no se encontró wasm_exec.js en GOROOT ($GOROOT_DIR)." >&2
  exit 1
fi

cp web/index.html web/app.css web/theme.css web/favicon.svg web/liquid-waves.svg "$DIST_DIR/"
cp -R web/build/* "$DIST_DIR/build/"
cp testdata/examples/*.json "$DIST_DIR/examples/"

printf 'window.PROY3_BACKEND = "wasm";\n' > "$DIST_DIR/config.js"
touch "$DIST_DIR/.nojekyll"

echo "Sitio estático generado en $DIST_DIR"
