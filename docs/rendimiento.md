# Rendimiento y benchmarks

**Propósito:** Documentar las mediciones de rendimiento reales del analizador sintáctico, evaluador semántico, construcción del árbol de explicación, generación aleatoria de interpretaciones y generación de código LaTeX (`.tex`), junto con la interpretación de los resultados y los límites observados.

## Entorno de medición

- **Go:** `go version go1.27.1-X:nodwarf5 linux/amd64`
- **CPU:** `11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz` (16 hilos lógicos)
- **Sistema operativo:** `Linux 6.1.189-1-MANJARO`
- **Fecha:** `2026-11-15T01:56:56-06:00`

## Comando exacto

```bash
go test -run=^$ -bench . -benchmem -count 5 ./...
```

Los benchmarks están definidos en [`internal/logic/logic_bench_test.go`](../internal/logic/logic_bench_test.go), [`internal/logic/model_search_bench_test.go`](../internal/logic/model_search_bench_test.go) y [`export_pdf_bench_test.go`](../export_pdf_bench_test.go).

## Resultados medidos (promedio de 5 ejecuciones)

| Benchmark | Escenario | Tiempo promedio | Memoria / op | Asignaciones / op |
| --- | --- | --- | --- | --- |
| `BenchmarkAnalyzeFormulaLength/corta` | Análisis de fórmula corta (`∀x (P(x) → R(x, f(c)))`) | 4 690 ns (4.69 µs) | 3 888 B | 36 |
| `BenchmarkAnalyzeFormulaLength/media` | Análisis de fórmula media (2 cuantificadores, 4 átomos) | 10 373 ns (10.37 µs) | 8 800 B | 78 |
| `BenchmarkAnalyzeFormulaLength/larga` | Análisis de fórmula larga (12 cláusulas encadenadas) | 49 653 ns (49.65 µs) | 40 248 B | 372 |
| `BenchmarkEvaluateQuantifiers/1_cuantificador_D5` | `∀x P(x)` con $\|D\| = 5$ (incluye validación) | 119 286 ns (119.3 µs) | 61 020 B | 2 237 |
| `BenchmarkEvaluateQuantifiers/1_cuantificador_D20` | `∀x P(x)` con $\|D\| = 20$ (incluye validación) | 6 732 261 ns (6.73 ms) | 3 268 410 B | 133 363 |
| `BenchmarkEvaluateQuantifiers/2_cuantificadores_D5` | `∀x ∀y R(x, y)` con $\|D\| = 5$ (25 pares) | 156 738 ns (156.7 µs) | 99 066 B | 2 639 |
| `BenchmarkEvaluateQuantifiers/2_cuantificadores_D15` | `∀x ∀y R(x, y)` con $\|D\| = 15$ (225 pares) | 2 939 921 ns (2.94 ms) | 1 519 035 B | 58 754 |
| `BenchmarkEvaluateQuantifiers/3_cuantificadores_D5` | `∀x ∀y ∀z T(x, y, z)` con $\|D\| = 5$ (125 ternas) | 311 794 ns (311.8 µs) | 322 340 B | 5 159 |
| `BenchmarkEvaluateQuantifiers/3_cuantificadores_D10` | `∀x ∀y ∀z T(x, y, z)` con $\|D\| = 10$ (1 000 ternas) | 2 278 918 ns (2.28 ms) | 2 307 742 B | 37 919 |
| `BenchmarkExplanationConstruction/testigo_temprano_D10` | `∃x P(x)` con $\|D\| = 10$ (corte en el primer testigo) | 819 023 ns (819.0 µs) | 392 235 B | 16 195 |
| `BenchmarkExplanationConstruction/comprobacion_completa_D10` | `∀x ∀y R(x, y)` con $\|D\| = 10$ (100 pares) | 952 186 ns (952.2 µs) | 556 823 B | 17 839 |
| `BenchmarkExplanationConstruction/arbol_recortado_D20` | `∀x ∀y ∀z (P(x) → R(y, z))` con $\|D\| = 20$ (recorte de nodos) | 25 745 820 ns (25.75 ms) | 19 660 294 B | 419 048 |
| `BenchmarkGenerateRandomInterpretation/D3` | Generación aleatoria con $\|D\| = 3$ | 9 939 ns (9.94 µs) | 8 748 B | 53 |
| `BenchmarkGenerateRandomInterpretation/D10` | Generación aleatoria con $\|D\| = 10$ | 18 409 ns (18.41 µs) | 25 159 B | 263 |
| `BenchmarkGenerateRandomInterpretation/D25` | Generación aleatoria con $\|D\| = 25$ | 60 165 ns (60.17 µs) | 109 773 B | 1 360 |
| `BenchmarkEvaluationTeX` | Generación de código LaTeX (`.tex`) sin compilar `pdflatex` | 52 381 ns (52.38 µs) | 59 969 B | 1 008 |
| `BenchmarkSearchModels/satisfacible_y_falsable_N2` | `∀x P(x)` con $N = 2$ (halla modelo en $\|D\|=1$ y contramodelo en $\|D\|=2$) | 13 141 ns (13.14 µs) | 9 743 B | 164 |
| `BenchmarkSearchModels/sin_modelos_barbero_N2` | `∃b ∀x (Afeita(b,x) ↔ ¬Afeita(x,x))` con $N = 2$ (exhaustivo sin modelos) | 319 807 ns (319.81 µs) | 280 373 B | 4 185 |
| `BenchmarkSearchModels/tautologia_abierta_N2` | `P(x) ∨ ¬P(x)` abierta con $N = 2$ (sin contramodelo) | 53 364 ns (53.36 µs) | 42 571 B | 628 |
| `BenchmarkSearchModels/limite_presupuesto_N3` | `∀x ∀y (R(x,y) ∨ ¬R(x,y))` con $f/1, R/2, N = 3$ (alcanza `MaxSearchedInterpretations = 2000`) | 79 527 226 ns (79.53 ms) | 74 701 461 B | 1 144 296 |

## Interpretación y límites observados

1. **Análisis sintáctico lineal:** `AnalyzeFormula` escala de forma prácticamente lineal con el tamaño de la fórmula (4.69 µs para fórmula corta frente a 49.65 µs para 12 cláusulas encadenadas), por lo que el análisis interactivo en tiempo real resulta imperceptible para el usuario.
2. **Costo de validación en `EvaluateFormula`:** `EvaluateFormula` revalida lenguaje, fórmula e interpretación completa en cada llamada (`ValidateInterpretation`). Por ello `1_cuantificador_D20` (donde la interpretación incluye tablas de `R` de $20^2 = 400$ y `f` de 20 entradas) tarda 6.73 ms frente a 2.28 ms de `3_cuantificadores_D10` (donde la tabla de `T` tiene $10^3 = 1000$ tuplas pero `D` es menor en otras validaciones).
3. **Crecimiento exponencial en cuantificadores anidados:** Con $k$ cuantificadores anidados sobre un dominio de tamaño $|D|$, el peor caso (universal verdadero o existencial falso) recorre $|D|^k$ combinaciones. En el caso `arbol_recortado_D20` (3 cuantificadores sobre $|D|=20$, hasta $8000$ hojas potenciales), la evaluación tarda ~25.75 ms y recorta el árbol de explicación al alcanzar `maxExplanationNodes = 2000` (`internal/logic/evaluate.go`), mientras el resultado semántico se sigue calculando completo dentro del presupuesto `MaxEvaluationSteps = 100000`.
4. **Límites duros en código:**
   - `MaxDomainSize = 100` (`internal/logic/evaluator_contract.go`)
   - `MaxTableEntries = 10000` (`internal/logic/evaluator_contract.go`)
   - `MaxEvaluationSteps = 100000` (`internal/logic/evaluate.go`)
   - `maxExplanationNodes = 2000` (`internal/logic/evaluate.go`)
5. **Generación de `.tex` vs compilación PDF:** Construir el texto `.tex` toma apenas ~52.38 µs en Go puro (`evaluationTeX` en [`export_pdf.go`](../export_pdf.go)). El cuello de botella de la exportación a PDF es la invocación externa de `pdflatex`, acotada por un timeout de 30 s en `compileEvaluationPDF`.
6. **Búsqueda de modelos (`SearchModels`):** Cuando la fórmula tiene modelo y contramodelo en dominios pequeños (`∀x P(x)`, $N=2$), la búsqueda corta temprano en ~13.14 µs. Si explora todo el espacio hasta $N=2$ sin modelos (`sin_modelos_barbero_N2`), tarda ~319.81 µs; cuando el espacio combinatorio de funciones y relaciones alcanza el tope `MaxSearchedInterpretations = 2000` (`limite_presupuesto_N3`), tarda ~79.53 ms y ~71.2 MiB asignados en total.
