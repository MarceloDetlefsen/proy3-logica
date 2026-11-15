#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"

required_files=(
  "$DIST_DIR/index.html"
  "$DIST_DIR/logic.wasm"
  "$DIST_DIR/wasm_exec.js"
  "$DIST_DIR/config.js"
  "$DIST_DIR/.nojekyll"
  "$DIST_DIR/build/src/app.js"
  "$DIST_DIR/build/src/worker.js"
  "$DIST_DIR/examples/universal-verdadero.json"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Error: falta el archivo requerido $file" >&2
    exit 1
  fi
done

# Verificar que no existan rutas absolutas con "/" en los archivos publicados.
if grep -rnE '(src|href|fetch)\s*\(?\s*["'\'']/|url\(["'\'']?/' "$DIST_DIR/index.html" "$DIST_DIR/app.css" "$DIST_DIR/theme.css" "$DIST_DIR/build" ; then
  echo "Error: se encontraron referencias absolutas con '/' en $DIST_DIR." >&2
  exit 1
fi

echo "check-pages: dist/ verificado sin rutas absolutas ni archivos faltantes."
