# Referencia de API HTTP

**Propósito:** Documentar todos los endpoints HTTP expuestos por el servidor Go, con ejemplos `curl` reales, formato de petición, respuesta y manejo de errores.

> [!NOTE]
> En el despliegue estático de GitHub Pages (`PROY3_BACKEND = "wasm"`), las peticiones JSON equivalentes se ejecutan localmente en el Web Worker (`logic.wasm`), excepto `/api/evaluate/export/pdf` que se reemplaza por generación local del `.tex`.

## `GET /healthz`

Verifica que el servidor esté activo.

```bash
curl -s http://localhost:8080/healthz
```

Respuesta `200 OK`:

```json
{"status":"ok"}
```

## `POST /api/language/validate`

Valida declaraciones de funciones (aridad $\ge 0$) y predicados (aridad $\ge 1$). Los errores de validación se devuelven con HTTP `200` dentro de `errors`.

```bash
curl -s -X POST http://localhost:8080/api/language/validate \
  -H "Content-Type: application/json" \
  -d '{"funcs":[{"name":"c","arity":0}],"preds":[{"name":"P","arity":1}]}'
```

Respuesta `200 OK`:

```json
{"language":{"funcs":{"c":0},"preds":{"P":1}},"errors":[]}
```

## `POST /api/analyze`

Analiza léxica y sintácticamente una fórmula respecto a un lenguaje y extrae sus variables libres.

```bash
curl -s -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"input":"forall x P(x)","language":{"funcs":{"c":0},"preds":{"P":1}}}'
```

Respuesta `200 OK`:

```json
{"formula":{"k":"quant","q":"forall","v":"x","f":{"k":"pred","name":"P","args":[{"k":"var","name":"x"}]}},"freeVars":[],"warnings":[],"errors":[]}
```

## `POST /api/interpretation/validate`

Valida dominio, completitud de funciones totales, aridades, pertenencia al dominio y relaciones no vacías.

```bash
curl -s -X POST http://localhost:8080/api/interpretation/validate \
  -H "Content-Type: application/json" \
  -d '{"language":{"funcs":{"f":1},"preds":{"P":1}},"interpretation":{"domain":["0","1"],"funcs":{"f":[{"args":["0"],"value":"1"},{"args":["1"],"value":"0"}]},"rels":{"P":[["0"]]}}}'
```

Respuesta `200 OK`:

```json
{"errors":[],"warnings":[]}
```

## `POST /api/interpretation/generate`

Genera una interpretación aleatoria válida y reproducible para el lenguaje dado. `domainSize` (1–100, por defecto 3) y `seed` son opcionales.

```bash
curl -s -X POST http://localhost:8080/api/interpretation/generate \
  -H "Content-Type: application/json" \
  -d '{"language":{"funcs":{"c":0,"f":1},"preds":{"P":1}},"domainSize":2,"seed":42}'
```

## `POST /api/evaluate`

Valida lenguaje, fórmula, interpretación y entorno, y evalúa la fórmula con semántica de Tarski.

```bash
curl -s -X POST http://localhost:8080/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"language":{"funcs":{},"preds":{"P":1}},"input":"∀x P(x)","interpretation":{"domain":["a","b"],"funcs":{},"rels":{"P":[["a"],["b"]]}},"env":{}}'
```

## `POST /api/evaluate/export/pdf`

Recibe el mismo cuerpo que `/api/evaluate`, revalida y evalúa, genera el `.tex` y lo compila con `pdflatex`.

- **`200 OK`:** Devuelve `application/pdf` (`resolucion-semantica.pdf`).
- **`422 Unprocessable Entity`:** El cuerpo tiene errores lógicos/de validación; devuelve el `EvaluateResponse` en JSON.
- **`503 Service Unavailable`:** `pdflatex` no está disponible en el servidor.
- **`400 Bad Request`:** JSON mal formado o cuerpo superior a 2 MiB.
- **`405 Method Not Allowed`:** Método HTTP distinto de `POST`.
