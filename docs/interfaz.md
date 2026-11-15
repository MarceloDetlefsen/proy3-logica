# Interfaz gráfica y capa de transporte

**Propósito:** Documentar la arquitectura del frontend en TypeScript vanilla (`web/src/`), el manejo de estado, el flujo de eventos, la capa de transporte HTTP/WASM y las medidas de accesibilidad.

## Módulos de `web/`

- [`web/index.html`](../web/index.html): Maquetación semántica en 4 fases (`#language`, `#interpretation`, `#formula`, `#evaluation`), portada (`#landing`), panel de ejemplos (`#examples-panel`), vista de aprendizaje (`#learning-view`), tutorial modal (`#tutorial`) y barra de resumen (`model-rail`).
- [`web/types.ts`](../web/types.ts): Interfaces TypeScript espejadas de `internal/logic/evaluator_contract.go`.
- [`web/src/state.ts`](../web/src/state.ts): Estado centralizado (`state`), `debounce`, `escapeHTML`, `currentLanguage`, `currentInterpretation` y soporte de `?mock=1`.
- [`web/src/api.ts`](../web/src/api.ts): Capa de transporte con interfaz común `Transport`:
  - `HttpTransport`: realiza `fetch` relativo (`api/...`) al servidor Go.
  - `WasmTransport`: ejecuta llamadas JSON en [`web/src/worker.ts`](../web/src/worker.ts) correlacionadas por `id`, con cancelación (`AbortSignal`) y timeout de 10 s (reinicia el worker si se excede).
  - Selección mediante `window.PROY3_BACKEND` definido en [`web/config.js`](../web/config.js) (`"http"` por defecto; `"wasm"` en el build estático de Pages).
- [`web/src/language.ts`](../web/src/language.ts): Alta/baja de funciones y predicados; validación con debounce.
- [`web/src/interpretation.ts`](../web/src/interpretation.ts): Chips del dominio, tablas de funciones totales y relaciones, y botón de generación aleatoria.
- [`web/src/formula.ts`](../web/src/formula.ts): Editor de fórmula con resaltado de rango de error, barra de inserción en cursor (`¬`, `∧`, `∨`, `→`, `↔`, `∀`, `∃`, `=`, `(`, `)`), selectores de entorno para variables libres y generador de fórmulas aleatorias.
- [`web/src/evaluation.ts`](../web/src/evaluation.ts): Lista de requisitos bloqueantes, ejecución de `/api/evaluate`, renderizado del árbol de explicación paso a paso, búsqueda acotada de modelos y contramodelos en el bloque `#model-search` (ubicado dentro de la fase `#evaluation` debajo de `#result`, con límite `#model-search-limit` y estado `#model-search-status`) mediante `/api/models/search`, y botón de exportación (PDF en modo HTTP, `.tex` en modo WASM).
- [`web/src/app.ts`](../web/src/app.ts): Navegación entre fases, temas Liquid Glass (`grafito`, `medianoche`, `obsidiana`, `tinta`, `papel`), cargador de ejemplos (`examples/*.json`), lecciones y tutorial.

## Errores y accesibilidad

- Cada panel incluye regiones `aria-live="polite"` (`#language-status`, `#interpretation-status`, `#formula-status`, `#evaluation-status`, `#model-search-status`, `#result`) para anunciar errores y resultados.
- Los errores de análisis con `start`/`end` en runes permiten seleccionar exactamente el fragmento erróneo dentro de `#formula-input`.
- Los menús de apariencia y el modal de tutorial gestionan foco y retorno de foco (`aria-expanded`, `role="dialog"`, `aria-modal="true"`).
