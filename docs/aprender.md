# Sección Aprender: guía de uso del programa

**Propósito:** Documentar la estructura pedagógica de la vista **Aprender** (`#learning-view`), el mapa entre cada lección y las fases reales de la interfaz, cómo agregar nuevas lecciones y cómo se verifica automáticamente que todas las cifras y ejemplos coincidan con el motor Go/WASM.

## Estructura de las lecciones

Las 6 lecciones están definidas en [`web/src/learn/lessons.ts`](../web/src/learn/lessons.ts) (`LEARN_LESSONS`) y siguen el flujo real del evaluador, sin mezclar el contenido histórico de Peano o Gödel (que vive en [`docs/historia.md`](historia.md)):

| ID de lección | Título | Fase / módulo de la UI | Acción directa |
| --- | --- | --- | --- |
| `start` | Tu primera evaluación en 5 pasos | Flujo completo (`#examples-panel` → `#evaluation`) | Carga `universal-verdadero` (`Hacerlo con un ejemplo`) |
| `language` | 1. Símbolos funcionales, constantes y predicados | Fase 01 (`#language`, [`web/src/language.ts`](../web/src/language.ts)) | Abre `#language` |
| `interpretation` | 2. Dominio finito, funciones totales y relaciones no vacías | Fase 02 (`#interpretation`, [`web/src/interpretation.ts`](../web/src/interpretation.ts)) | Abre `#interpretation` |
| `formula` | 3. Conectivos, alcance fuerte, igualdad y variables libres | Fase 03 (`#formula`, [`web/src/formula.ts`](../web/src/formula.ts)) | Abre `#formula` |
| `result` | 4. Verdadero, Falso, testigos, contraejemplos y errores | Fase 04 (`#evaluation`, [`web/src/evaluation.ts`](../web/src/evaluation.ts)) | Abre `#evaluation` |
| `search_export` | 5. Buscador de modelos, Ejemplos y exportación a PDF / `.tex` | Fase 04 (`#model-search`, `#export-pdf`) | Abre `#evaluation` + enlace a `#historia/8` |

Cada lección sigue un formato breve:
1. **Idea en 2–3 frases** con la notación del curso.
2. **Ejemplo mínimo** ejecutable y verificable.
3. **Dónde se hace en la aplicación**, con un botón que lleva directamente a la fase correspondiente o carga un ejemplo real.

## Cómo agregar una lección

1. Añadir un objeto `LearnLesson` en `LEARN_LESSONS` dentro de [`web/src/learn/lessons.ts`](../web/src/learn/lessons.ts).
2. Añadir el botón `<button class="lesson-link" data-lesson="<id>">...</button>` dentro de `<nav class="lesson-nav">` en [`web/index.html`](../web/index.html).
3. Si el ejemplo de la lección muestra una evaluación concreta, agregar su caso en `LEARN_VERIFIED_EXAMPLES` para que sea ejecutado contra `logic.wasm`.

## Verificación automática

- [`learn_constants_test.go`](../learn_constants_test.go): Verifica que los límites numéricos citados en `lessons.ts` (`MaxDomainSize = 100`, `MaxTableEntries = 10000`, `MaxEvaluationSteps = 100000`, `MaxSearchedInterpretations = 2000`, `MaxSearchedEvaluations = 5000`, `maxSearchTableEntries = 128`) coincidan con las constantes reales de `internal/logic/` y que no exista contenido de Peano en Aprender.
- [`scripts/learn.test.mjs`](../scripts/learn.test.mjs): Ejecuta con `node:test` todos los casos de `LEARN_VERIFIED_EXAMPLES` y el ejemplo de `SearchModels` (`∀x P(x)`, `N = 2`) directamente sobre `dist/logic.wasm`.
