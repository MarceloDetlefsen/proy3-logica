#!/usr/bin/env bash
set -euo pipefail

CONTAINER_CLI="${CONTAINER_CLI:-$(command -v docker || command -v podman || true)}"
if [ -z "$CONTAINER_CLI" ]; then
  echo "Error: se requiere docker o podman." >&2
  exit 1
fi

IMAGE_TAG="proy3-logica-smoke:$$"
CONTAINER_NAME="proy3-smoke-$$"

TMP_PDF=$(mktemp)
cleanup() {
  rm -f "$TMP_PDF"
  "$CONTAINER_CLI" rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  "$CONTAINER_CLI" rmi -f "$IMAGE_TAG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')

echo "Construyendo imagen $IMAGE_TAG con $CONTAINER_CLI..."
"$CONTAINER_CLI" build -t "$IMAGE_TAG" .

echo "Iniciando contenedor $CONTAINER_NAME en puerto $PORT..."
"$CONTAINER_CLI" run -d --name "$CONTAINER_NAME" \
  -p "${PORT}:8080" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  "$IMAGE_TAG" >/dev/null

echo "Esperando /healthz..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: el contenedor no respondió en /healthz." >&2
    "$CONTAINER_CLI" logs "$CONTAINER_NAME" >&2 || true
    exit 1
  fi
  sleep 1
done

PAYLOAD=$(python3 -c 'import json; d=json.load(open("testdata/examples/universal-verdadero.json")); print(json.dumps({k:d[k] for k in ("language","input","interpretation","env")}))')

echo "Probando POST /api/evaluate..."
EVAL_RES=$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/evaluate" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

python3 -c '
import json, sys
res = json.loads(sys.argv[1])
errs = res.get("errors", [])
assert errs == [], f"errores inesperados: {errs}"
val = res.get("result", {}).get("value")
assert val is True, f"valor esperado True, obtenido {val}"
' "$EVAL_RES"

echo "Probando POST /api/evaluate/export/pdf..."
curl -fsS -X POST "http://127.0.0.1:${PORT}/api/evaluate/export/pdf" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -o "$TMP_PDF"
PDF_HEADER=$(head -c 4 "$TMP_PDF")

if [ "$PDF_HEADER" != "%PDF" ]; then
  echo "Error: la respuesta PDF no comienza con %PDF (recibido: $PDF_HEADER)." >&2
  exit 1
fi

echo "Smoke test de Docker completado con éxito (evaluación=true, PDF=%PDF)."
