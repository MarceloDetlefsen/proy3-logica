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
- [`web/src/app.ts`](../web/src/app.ts): Navegación entre fases, temas Liquid Glass (`grafito`, `medianoche`, `obsidiana`, `tinta`, `papel`), cargador de ejemplos (`examples/*.json`), lecciones, sección **Historia** (`#toggle-history`, `#history-view`), modo enfoque y tutorial.
- [`web/src/navigation.ts`](../web/src/navigation.ts): Máquina de estados pura para vistas auxiliares mutuamente excluyentes (`AuxView = "aprender" | "ejemplos" | "historia" | null`), transiciones (`openAuxView`, `closeAuxView`, `setPhase`) y enrutamiento por hash (`parseHash`, `formatHash`), probada en [`scripts/navigation.test.mjs`](../scripts/navigation.test.mjs).
- [`web/src/history/`](../web/src/history/view.ts) y [`web/history.css`](../web/history.css): Línea de tiempo de 11 capítulos (`chapters.ts`, `view.ts`), animaciones interactivas (`logic.ts`, `demos.ts`) que respetan `prefers-reduced-motion`, autoevaluaciones y carga directa de presets en el evaluador.

## Navegación, vistas auxiliares y modo enfoque de Historia

- **Exclusión mutua:** `auxView` en [`web/src/navigation.ts`](../web/src/navigation.ts) admite una sola vista auxiliar activa a la vez (`"aprender"`, `"ejemplos"` o `"historia"`). Abrir una cierra las demás sin reiniciar el lenguaje, la interpretación ni la fórmula. Al cargar un ejemplo desde **Ejemplos**, el panel se cierra, la vista pasa a **Evaluación** con el aviso `"Ejemplo cargado: <nombre>."` y el foco se traslada al botón **Evaluar fórmula**.
- **Enrutamiento por hash:** Se soportan `#language`, `#interpretation`, `#formula`, `#evaluation`, `#aprender`, `#ejemplos`, `#historia` y `#historia/<n>` (por ejemplo `#historia/9`). Un hash desconocido vuelve al evaluador sin errores.
- **Menú lateral:** Ordenado como **Aprender**, **Ejemplos** y, tras el divisor **Extra**, **Historia** con color de acento propio (`--history-accent`) y atributo `aria-current="page"` cuando está activa.
- **Modo enfoque (solo en Historia):** Al activar `focusMode`, ambas barras laterales se ocultan con transición de ancho/opacidad/desplazamiento (`history-focus` en [`web/history.css`](../web/history.css)) y quedan marcadas con `inert` para que `Tab` no entre en ellas mientras están cerradas. Reaparecen como paneles flotantes superpuestos al acercar el cursor a una zona de `24 px` en cada borde (retardo de `120 ms` al abrir y `300 ms` al cerrar), al recibir foco (`:focus-within`), o mediante los tiradores visibles `#focus-handle-left` / `#focus-handle-right` (`aria-expanded`, `aria-controls`) y el botón `#history-toggle-menu` en la barra superior de Historia. Con `prefers-reduced-motion: reduce`, los cambios son instantáneos.

## Errores y accesibilidad

- Cada panel incluye regiones `aria-live="polite"` (`#language-status`, `#interpretation-status`, `#formula-status`, `#evaluation-status`, `#model-search-status`, `#result`) para anunciar errores y resultados.
- Los errores de análisis con `start`/`end` en runes permiten seleccionar exactamente el fragmento erróneo dentro de `#formula-input`.
- Los menús de apariencia y el modal de tutorial gestionan foco y retorno de foco (`aria-expanded`, `role="dialog"`, `aria-modal="true"`).
