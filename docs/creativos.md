# Aportes creativos y rúbrica

**Propósito:** Documentar cada aporte creativo implementado en el proyecto con una estructura uniforme de evaluación frente a la rúbrica del curso (20 puntos calificados por el docente: creatividad 5, valor 6, calidad de implementación 6, justificación y defensa 3).

## Resumen frente a la rúbrica de aportes creativos

| Aporte creativo | Creatividad (5) | Valor (6) | Calidad (6) | Defensa (3) | Evidencia principal |
| --- | --- | --- | --- | --- | --- |
| 1. Árbol de explicación paso a paso con hijos decisivos | Destaca ramas decisivas, testigos y contraejemplos | Permite estudiar la semántica de Tarski nodo a nodo | `evaluationState.eval` + `renderExplanation` + `createStepControls` | [`docs/explicacion.md`](explicacion.md) | [`internal/logic/evaluate.go`](../internal/logic/evaluate.go), [`web/src/evaluation.ts`](../web/src/evaluation.ts) |
| 2. Exportación formal a PDF con LaTeX | Genera un documento académico compilado en `pdflatex` | Entrega evidencia imprimible del modelo y árbol completo | `EvaluationTeX` + `compileEvaluationPDF` + contenedor endurecido | [`docs/exportacion-pdf.md`](exportacion-pdf.md) | [`internal/logic/tex.go`](../internal/logic/tex.go), [`export_pdf.go`](../export_pdf.go) |
| 3. Aleatorización reproducible de modelos y fórmulas | Generación por semilla + generador sintáctico de fórmulas | Acelera pruebas y exploración de contraejemplos | `GenerateRandomInterpretation` + `buildRandomFormula` | [`docs/aleatorizacion.md`](aleatorizacion.md) | [`internal/logic/interpretation_generate.go`](../internal/logic/interpretation_generate.go), [`web/src/formula.ts`](../web/src/formula.ts) |
| 4. Igualdad integrada (`=`) y modo educativo | Predicado lógico sin tabla + 6 lecciones + tutorial | Conecta Peano, Gödel e indecidibilidad con la práctica | `Eq` en AST/parser/evaluador + lecciones y tutorial en UI | [`docs/interfaz.md`](interfaz.md) | [`internal/logic/parser.go`](../internal/logic/parser.go), [`web/index.html`](../web/index.html) |
| 5. Despliegue dual Docker + WebAssembly en GitHub Pages | Mismo núcleo Go compilado a binario nativo y `js/wasm` | Demo pública sin servidor + contenedor reproducible con TeX | `cmd/wasm/main.go` + `web/src/worker.ts` + `Dockerfile` | [`docs/despliegue.md`](despliegue.md) | [`cmd/wasm/main.go`](../cmd/wasm/main.go), [`web/src/api.ts`](../web/src/api.ts) |

---

## 1. Árbol de explicación paso a paso con hijos decisivos

- **Qué es:** Visualización jerárquica e interactiva del árbol de evaluación donde los nodos se revelan progresivamente (paso a paso) y se resaltan únicamente las ramas decisivas (`decisive`), el testigo o el contraejemplo.
- **Valor que aporta:** Transforma una respuesta booleana opaca en una demostración didáctica paso a paso de la semántica de Tarski.
- **Cómo se implementó:** En [`internal/logic/evaluate.go`](../internal/logic/evaluate.go), `evaluationState.eval` calcula `Decisive`, `Witness`, `Counterexample`, `Checked` y `DomainSize`. En [`web/src/evaluation.ts`](../web/src/evaluation.ts), `renderExplanation` y `createStepControls` permiten avanzar, retroceder y revelar todo el árbol.
- **Cómo se probó:** `TestEvaluateSharedExamples` y `checkExplanation` en [`internal/logic/evaluate_test.go`](../internal/logic/evaluate_test.go) verifican cada nodo contra los 18 fixtures de `testdata/examples/`.
- **Justificación:** La rúbrica exige no solo Verdadero/Falso sino explicar las razones decisivas; el recorrido paso a paso facilita la defensa y la comprensión en clase.
- **Limitaciones:** Para proteger la memoria, el árbol visual se recorta a `maxExplanationNodes = 2000` nodos (`Truncated = true`), aunque el valor lógico se evalúa completo.
- **Demostración en 1 minuto:** Cargar el ejemplo `sin-sucesor`, evaluar y usar los botones de avance paso a paso para mostrar cómo se detiene en el contraejemplo `x = 2`.

## 2. Exportación formal a PDF con LaTeX

- **Qué es:** Generación automática de un documento LaTeX con lenguaje, dominio, tablas de funciones/relaciones, entorno, resultado y árbol de explicación, compilado a PDF mediante `pdflatex`.
- **Valor que aporta:** Permite descargar un reporte formal listo para entregar o revisar fuera de la aplicación.
- **Cómo se implementó:** `EvaluationTeX` en [`internal/logic/tex.go`](../internal/logic/tex.go) construye el `.tex` en Go puro; `compileEvaluationPDF` en [`export_pdf.go`](../export_pdf.go) ejecuta `pdflatex` con `-no-shell-escape`, `-halt-on-error` y timeout de 30 s. En modo WASM se descarga el `.tex`.
- **Cómo se probó:** Verificado en vivo con `curl` contra `/api/evaluate/export/pdf` y dentro del contenedor endurecido mediante [`scripts/docker-smoke.sh`](../scripts/docker-smoke.sh) comprobando cabecera `%PDF`.
- **Justificación:** Documenta íntegramente el proceso semántico en tipografía matemática estándar.
- **Limitaciones:** Requiere `pdflatex` (disponible en local o en la imagen Docker); identificadores con doble guion bajo no inicial (ej. `x_1_2`) provocan error de doble subíndice en LaTeX.
- **Demostración en 1 minuto:** Evaluar `universal-verdadero` en Docker/local, pulsar **Exportar resolución a PDF** y abrir `resolucion-semantica.pdf`.

## 3. Aleatorización reproducible de modelos y fórmulas

- **Qué es:** Generación automática de interpretaciones finitas válidas (controladas por `domainSize` y `seed`) y de fórmulas aleatorias bien formadas.
- **Valor que aporta:** Evita llenar manualmente tablas grandes durante pruebas y demostraciones, garantizando modelos válidos.
- **Cómo se implementó:** `GenerateRandomInterpretation` en [`internal/logic/interpretation_generate.go`](../internal/logic/interpretation_generate.go) y `ExecuteGenerateInterpretation` en [`internal/logic/api_pipeline.go`](../internal/logic/api_pipeline.go) para modelos; `generateRandomFormula` y `buildRandomFormula` en [`web/src/formula.ts`](../web/src/formula.ts) para fórmulas.
- **Cómo se probó:** `TestGenerateRandomInterpretationIsValidAndReproducible`, `TestGenerateRandomInterpretationReportsLimitsAndInvalidLanguage` y `TestGenerateRandomInterpretationCanGenerateUnaryTableAtLimit` en [`internal/logic/interpretation_generate_test.go`](../internal/logic/interpretation_generate_test.go), más `TestGenerateInterpretationAPI` en [`api_test.go`](../api_test.go).
- **Justificación:** Acelera la experimentación con modelos finitos de hasta 100 elementos sin violar las restricciones de totalidad ni no vaciedad.
- **Limitaciones:** Funciones con $|D|^n > 10\,000$ se rechazan por `LIMIT_EXCEEDED`.
- **Demostración en 1 minuto:** Declarar `f/1` y `P/1`, generar una interpretación de tamaño 4 con un clic, luego pulsar **Generar fórmula aleatoria** y evaluar.

## 4. Igualdad integrada (`=`), temas y modo educativo

- **Qué es:** Soporte nativo del predicado lógico `=` sin tabla de interpretación, junto con 6 lecciones conceptuales, tutorial interactivo de 6 pasos y 5 temas visuales (*Liquid Glass*).
- **Valor que aporta:** Permite expresar propiedades algebraicas y aritméticas (p. ej. `f(x) = x`) directamente y contextualiza el evaluador con teoría del curso.
- **Cómo se implementó:** `Eq` en [`internal/logic/ast.go`](../internal/logic/ast.go), `parseAtom` en [`internal/logic/parser.go`](../internal/logic/parser.go), `eval` en [`internal/logic/evaluate.go`](../internal/logic/evaluate.go); interfaz de lecciones y temas en [`web/index.html`](../web/index.html), [`web/theme.css`](../web/theme.css) y [`web/src/app.ts`](../web/src/app.ts).
- **Cómo se probó:** Pruebas unitarias en `internal/logic/parser_test.go` y `internal/logic/evaluate_test.go`; verificación manual de UI en [`docs/ui-checklist.md`](ui-checklist.md).
- **Justificación:** Enriquece la expresividad del lenguaje de primer orden y la usabilidad para estudiantes.
- **Limitaciones:** Los temas y lecciones están en contenido estático integrado en `web/`.
- **Demostración en 1 minuto:** Evaluar `x = y` sin declarar predicados y abrir la vista **Aprender** y el selector **Apariencia**.

## 5. Despliegue dual: Docker con LaTeX + WebAssembly en GitHub Pages

- **Qué es:** Un mismo núcleo lógico Go se ejecuta tanto en un servidor HTTP dockerizado con `pdflatex` como compilado a WebAssembly dentro de un Web Worker en GitHub Pages.
- **Valor que aporta:** Cualquier evaluador o usuario puede probar la aplicación al instante en la web sin instalar nada, o levantar el servidor completo con PDF mediante Docker.
- **Cómo se implementó:** [`cmd/wasm/main.go`](../cmd/wasm/main.go), [`web/src/worker.ts`](../web/src/worker.ts), [`web/src/api.ts`](../web/src/api.ts), [`Dockerfile`](../Dockerfile), [`scripts/build-pages.sh`](../scripts/build-pages.sh) y workflows en [`.github/workflows/`](../.github/workflows/ci.yml).
- **Cómo se probó:** `node scripts/wasm-smoke.mjs`, `./scripts/check-pages.sh` y `./scripts/docker-smoke.sh` ejecutados localmente con éxito.
- **Justificación:** Elimina fricción de instalación para la calificación y garantiza portabilidad reproducible.
- **Limitaciones:** En GitHub Pages la exportación genera `.tex` en lugar de `.pdf`, y el worker tiene un timeout de 10 s por operación.
- **Demostración en 1 minuto:** Mostrar la demo estática en el navegador descargando `.tex` y compararla con `docker compose up` descargando el `.pdf`.
