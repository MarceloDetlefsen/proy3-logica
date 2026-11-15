# Estado del proyecto (Auditoría)

**Propósito:** Registrar el estado real del repositorio `proy3-logica` tras la auditoría de Fase 1, incluyendo el mapeo de requisitos del enunciado hacia código y pruebas, y los hallazgos detectados.

- **Fecha de auditoría:** 2026-11-15
- **Commit auditado en `main`:** `c627652` (*Merge pull request #12 from MarceloDetlefsen/feat/export*)
- **Versión de Go (`go.mod`):** `go 1.27` (entorno: `go1.27.1-X:nodwarf5 linux/amd64`)
- **Frontend:** TypeScript vanilla (`typescript ^5.0.0` en `package.json`, `tsc -p web/tsconfig.json`)

## Mapa requisitos del enunciado -> código -> prueba

| # | Requisito del enunciado | Implementación verificada | Pruebas existentes | Estado |
| --- | --- | --- | --- | --- |
| 1 | Lenguaje configurable (funciones y predicados con aridad) | `ValidateLanguage` en [`internal/logic/language.go`](../internal/logic/language.go); UI en [`web/src/language.ts`](../web/src/language.ts) | `TestValidateLanguage` en [`internal/logic/language_test.go`](../internal/logic/language_test.go); `TestLanguageValidateAPI` en [`api_test.go`](../api_test.go) | Cumple |
| 2 | Interpretación: dominio finito no vacío, funciones totales $D^n \to D$, relaciones $P^I \subseteq D^n$ no vacías | `ValidateInterpretation` en [`internal/logic/interpretation_validate.go`](../internal/logic/interpretation_validate.go); UI en [`web/src/interpretation.ts`](../web/src/interpretation.ts) | `TestValidateInterpretation*` en [`internal/logic/interpretation_validate_test.go`](../internal/logic/interpretation_validate_test.go); `TestInterpretationAndEvaluationErrorCodes` en [`internal/logic/evaluate_test.go`](../internal/logic/evaluate_test.go) | Cumple |
| 3 | Sintaxis con todos los conectivos lógicos ($\neg, \land, \lor, \to, \leftrightarrow, \forall, \exists, =$) y aliases ASCII | `Tokenize` en [`internal/logic/lexer.go`](../internal/logic/lexer.go); `ParseFormula` en [`internal/logic/parser.go`](../internal/logic/parser.go) | `TestTokenize*` en [`internal/logic/lexer_test.go`](../internal/logic/lexer_test.go); `TestParseFormula*` en [`internal/logic/parser_test.go`](../internal/logic/parser_test.go) | Cumple |
| 4 | Fórmulas abiertas/cerradas, variables libres y entorno | `AnalyzeFormula` y `freeVariables` en [`internal/logic/analyze.go`](../internal/logic/analyze.go); validación de entorno en `EvaluateFormula` ([`internal/logic/evaluate.go`](../internal/logic/evaluate.go)) | `TestAnalyzeFormulaIntegration` en [`internal/logic/analyze_test.go`](../internal/logic/analyze_test.go); `TestEvaluateSharedExamples` en [`internal/logic/evaluate_test.go`](../internal/logic/evaluate_test.go) | Cumple |
| 5 | Interfaz gráfica para lenguaje, interpretación, fórmulas, entornos, botones de símbolos y teclado | [`web/index.html`](../web/index.html), [`web/src/app.ts`](../web/src/app.ts), [`web/src/formula.ts`](../web/src/formula.ts) (`insertAtCursor`), [`web/src/language.ts`](../web/src/language.ts), [`web/src/interpretation.ts`](../web/src/interpretation.ts) | Verificación manual en [`docs/ui-checklist.md`](ui-checklist.md) | Cumple |
| 6 | Resultado Verdadero/Falso y explicación decisiva (testigo, contraejemplo, comprobación completa) | `evaluationState.eval` en [`internal/logic/evaluate.go`](../internal/logic/evaluate.go); renderizado en [`web/src/evaluation.ts`](../web/src/evaluation.ts) | `TestEvaluateSharedExamples` y `checkExplanation` en [`internal/logic/evaluate_test.go`](../internal/logic/evaluate_test.go) | Cumple |
| 7 | Validación integral sin emitir valor de verdad ante errores | `EvaluateFormula` en [`internal/logic/evaluate.go`](../internal/logic/evaluate.go) retorna `Result: nil` si `len(Errors) > 0` | `TestEvaluateSharedExamples` (7 fixtures `invalido-*.json` en `testdata/examples/`) y `TestInterpretationAndEvaluationErrorCodes` | Cumple |

## Hallazgos de la auditoría

1. **Riesgo de fallo LaTeX por doble subíndice (`export_pdf.go` / `internal/logic/tex.go`):** En `texMath`, un identificador válido con más de un guion bajo no inicial (por ejemplo `x_1_2`) se divide por `_` y genera `x_{1}_{2}`, lo que provoca un error de compilación `Double subscript` en `pdflatex`.
2. **Rutas absolutas incompatibles con `openin_any = p` (`export_pdf.go`):** Originalmente `export_pdf.go` pasaba la ruta absoluta `texPath` (`/tmp/proy3-latex-.../resolucion.tex`) a `pdflatex`. Con `openin_any = p` en TeX Live, `pdflatex` rechaza abrir rutas absolutas; se ajustó a `-output-directory . resolucion.tex` aprovechando `command.Dir = directory`.
3. **Código muerto en raíz (`types.go`):** [`types.go`](../types.go) define `Interp`, `Env` y `Explanation`, que no son referenciados en ningún archivo de `main` ni de `internal/logic` (reemplazados por [`internal/logic/evaluator_contract.go`](../internal/logic/evaluator_contract.go)).
4. **Función auxiliar sin uso (`writeTextList`):** Originalmente en `export_pdf.go` línea 278 (movida solo la plantilla pura a `internal/logic/tex.go`? Nota: `writeTextList` no se invocaba en `export_pdf.go`).
5. **Inconsistencia menor en `README.md` original:** Indicaba que `web/build/` no se versiona (cierto en `.gitignore`), pero no mencionaba que `go run .` falla al compilar si no se ejecutó antes `npm run build:web` cuando `web/build/` no existe.
6. **Dependencia de `web/src/state.ts` para transporte:** El código original realizaba `fetch` directamente en `web/src/state.ts`, `web/src/app.ts` y `web/src/evaluation.ts` usando rutas absolutas (`/api/...`, `/examples/...`), incompatible con despliegue bajo subruta (`/proy3-logica/`). Se refactorizó a `web/src/api.ts` y rutas relativas.
