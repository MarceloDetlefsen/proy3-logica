# Arquitectura y pipeline

**Propósito:** Describir la arquitectura completa del sistema, el flujo de datos desde la interfaz gráfica hasta el núcleo lógico (tanto en modo servidor HTTP como en modo estático WebAssembly) y las responsabilidades de cada paquete y archivo.

## Diagrama de flujo completo

```text
  Usuario (web/index.html + web/src/*.ts)
                  │
                  ▼
     Capa de transporte (web/src/api.ts)
        ┌─────────┴──────────┐
        │                    │
  [PROY3_BACKEND="http"]  [PROY3_BACKEND="wasm"]
        │                    │
        ▼                    ▼
  Servidor HTTP Go       Web Worker (web/src/worker.ts)
  (main.go, api.go)      carga logic.wasm (cmd/wasm/main.go)
        │                    │
        └─────────┬──────────┘
                  ▼
     Núcleo lógico puro (internal/logic/)
       1. Validación de lenguaje (language.go: ValidateLanguage)
       2. Lexer y Parser (lexer.go: Tokenize, parser.go: ParseFormula)
       3. Análisis de variables libres (analyze.go: AnalyzeFormula)
       4. Validación de interpretación (interpretation_validate.go: ValidateInterpretation)
       5. Validación de entorno + Evaluación Tarski (evaluate.go: EvaluateFormula)
       6. Árbol de explicación y recorte (evaluate.go: evaluationState.eval)
                  │
        ┌─────────┴──────────┐
        │                    │
  [Modo HTTP]          [Modo WASM]
        │                    │
        ▼                    ▼
  export_pdf.go          internal/logic/tex.go
  pdflatex -> PDF        EvaluationTeX -> descarga .tex
```

## Responsabilidades por paquete y archivo

### Paquete `main` (raíz)

- [`main.go`](../main.go): Inicializa el servidor HTTP con `go:embed` (`web` y `testdata/examples`), configura dirección de escucha (`ADDR` / `PORT`, por defecto `:8080`), expone `GET /healthz` y soporta `-healthcheck`.
- [`api.go`](../api.go): Decodifica JSON estricto (`DisallowUnknownFields`) y expone los endpoints `/api/*` delegando en `internal/logic`.
- [`export_pdf.go`](../export_pdf.go): Invoca `pdflatex` en un directorio temporal con timeout de 30 s y flags de seguridad (`-no-shell-escape`, `-halt-on-error`, `-interaction=nonstopmode`).
- [`types.go`](../types.go): Definiciones heredadas sin uso activo (código muerto detectado en auditoría).

### Paquete `internal/logic`

- [`language.go`](../internal/logic/language.go): `ValidateLanguage` valida nombres (`[A-Za-z_][A-Za-z0-9_]*`), palabras reservadas (`forall`, `exists`), unicidad y aridades ($\ge 0$ para funciones, $\ge 1$ para predicados).
- [`lexer.go`](../internal/logic/lexer.go): `Tokenize` convierte texto en tokens con offsets en runes y soporte para símbolos Unicode y aliases ASCII.
- [`ast.go`](../internal/logic/ast.go): Define las interfaces `Term` (`Var`, `App`) y `Formula` (`Pred`, `Eq`, `Not`, `Bin`, `Quant`) y su serialización JSON.
- [`parser.go`](../internal/logic/parser.go): `ParseFormula` implementa un parser por descenso recursivo con alcance fuerte de cuantificadores y verificación de símbolos/aridades.
- [`analyze.go`](../internal/logic/analyze.go): `AnalyzeFormula` y `freeVariables` calculan variables libres preservando orden de aparición.
- [`interpretation_validate.go`](../internal/logic/interpretation_validate.go): `ValidateInterpretation` verifica dominio no vacío, completitud de funciones totales, aridades, pertenencia al dominio y relaciones no vacías.
- [`interpretation_generate.go`](../internal/logic/interpretation_generate.go): `GenerateRandomInterpretation` construye modelos finitos válidos reproducibles mediante `seed`.
- [`evaluate.go`](../internal/logic/evaluate.go): `EvaluateFormula` y `evaluationState.eval` implementan la semántica de Tarski, presupuesto de pasos (`MaxEvaluationSteps = 100000`) y árbol de explicación (`maxExplanationNodes = 2000`).
- [`evaluator_contract.go`](../internal/logic/evaluator_contract.go): Tipos del contrato JSON (`Interpretation`, `Explanation`, `EvaluateRequest`, `EvaluateResponse`) y constantes de límites/códigos de error.
- [`api_pipeline.go`](../internal/logic/api_pipeline.go): Funciones reutilizables (`ExecuteValidateLanguage`, `ExecuteGenerateInterpretation`) compartidas entre `api.go` y `cmd/wasm/main.go`.
- [`tex.go`](../internal/logic/tex.go): `EvaluationTeX` genera el documento LaTeX en Go puro sin depender de `os` ni `os/exec`.
- [`errors.go`](../internal/logic/errors.go): Estructura `LogicError` y constantes de error léxico/sintáctico/semántico.

### Paquete `cmd/wasm`

- [`cmd/wasm/main.go`](../cmd/wasm/main.go): Compilado con `//go:build js && wasm`; registra `globalThis.proy3Wasm` con los métodos `validateLanguage`, `analyze`, `validateInterpretation`, `generateInterpretation`, `evaluate` y `exportEvaluationTeX`.

### Frontend (`web/`)

- [`web/index.html`](../web/index.html), [`web/app.css`](../web/app.css), [`web/theme.css`](../web/theme.css): Estructura de 4 fases, landing, temas Liquid Glass y barra lateral de resumen.
- [`web/types.ts`](../web/types.ts): Contratos TypeScript equivalentes a `internal/logic`.
- [`web/src/api.ts`](../web/src/api.ts): Abstracción `Transport` (`HttpTransport` y `WasmTransport` sobre Web Worker).
- [`web/src/worker.ts`](../web/src/worker.ts): Web Worker que carga `wasm_exec.js` y `logic.wasm`.
- [`web/src/state.ts`](../web/src/state.ts): Estado global, modo `?mock=1` y utilidades DOM.
- [`web/src/language.ts`](../web/src/language.ts), [`web/src/interpretation.ts`](../web/src/interpretation.ts), [`web/src/formula.ts`](../web/src/formula.ts), [`web/src/evaluation.ts`](../web/src/evaluation.ts), [`web/src/app.ts`](../web/src/app.ts): Módulos de UI por fase.
