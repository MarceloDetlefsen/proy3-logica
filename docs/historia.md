# Sección Historia: de Euclides a Turing

**Propósito:** Documentar el contenido histórico, las animaciones interactivas, la conexión en vivo con el evaluador y el buscador de modelos, la política de recursos locales sin conexión y las pruebas automáticas de la sección **Historia**.

## Arco narrativo (11 capítulos)

1. **01 · Euclides (~300 a. C.):** *Los Elementos*, método axiomático y la duda histórica sobre el quinto postulado.
2. **02 · Geometrías no euclideanas (1820–1829):** Gauss, Lobachevsky y Bolyai muestran modelos geométricos coherentes donde la verdad depende de la interpretación.
3. **03 · Cantor (1874–1891):** Cardinalidad del infinito y argumento diagonal.
4. **04 · Frege (1879–1903):** *Begriffsschrift*, cuantificadores, predicados y alcance formal.
5. **05 · Russell (1901–1913):** La paradoja de Russell y su formulación popular como la paradoja del barbero.
6. **06 · Hilbert (1900–1928):** El programa formalista: completitud, consistencia y decidibilidad (*Entscheidungsproblem*).
7. **07 · Tarski (1933–1936):** Lenguaje objeto frente a metalenguaje y definición recursiva de verdad en un modelo (`M, s ⊨ φ`).
8. **08 · Gödel (1929–1931):** Completitud de la lógica de primer orden (1929) frente a los teoremas de incompletitud aritmética (1931) y la mejora de Rosser (1936).
9. **09 · Turing (1936):** Máquinas de Turing y la indecidibilidad del problema de la parada.
10. **10 · Church (1936):** Cálculo lambda ($\lambda$) y la tesis de Church-Turing.
11. **11 · Legado en la computación (1936–hoy):** Programas almacenados, sistemas simples impredecibles (Juego de la Vida) y por qué este proyecto acota sus dominios y presupuestos.

## Módulos y demos interactivas

- [`web/src/history/chapters.ts`](../web/src/history/chapters.ts): Datos tipados de los 11 capítulos (`HISTORY_CHAPTERS`), retratos locales, *Idea clave*, *Ejemplo concreto*, *Conexión con este proyecto*, fuentes y autoevaluación de 2 preguntas por capítulo.
- [`web/src/history/view.ts`](../web/src/history/view.ts): Línea de tiempo navegable con teclado (`ArrowLeft`/`ArrowRight`), indicador de progreso persistido en `localStorage` y bloque desplegable **Créditos de imágenes y fuentes**.
- [`web/src/history/logic.ts`](../web/src/history/logic.ts): Funciones puras sin DOM:
  - `encodeGodel` / `decodeGodel` usando `BigInt` y factorización en primos sobre un alfabeto explícito de 12 símbolos (`0`, `S`, `+`, `=`, `(`, `)`, `¬`, `∧`, `∀`, `∃`, `x`, `y`).
  - `cantorDiagonalStep`: construcción paso a paso de la secuencia diagonal invertida.
  - `createUnaryAdditionMachine` / `stepTuringMachine`: simulador determinista de suma unaria (`2 + 3 = 5`).
  - `triangleAngleSum`: variación de la suma angular en geometría euclideana, esférica e hiperbólica.
  - `HISTORY_PRESETS`: casos `syllogism`, `barber` e `infinite_order` listos para cargar en el evaluador o en `SearchModels`.
- [`web/src/history/demos.ts`](../web/src/history/demos.ts): Controles `Reproducir / Pausar`, `Paso` y `Reiniciar` (respetando `prefers-reduced-motion`), botones **"Cargar en el evaluador"** / **"Probar en buscador"** y tarjetas de autoevaluación.

## Recursos locales y pruebas

- Todos los retratos se almacenan en [`web/assets/historia/`](../web/assets/historia/CREDITOS.md) (10 retratos de Wikimedia Commons en Dominio Público / CC BY-SA 4.0 optimizados a $\le 480\text{ px}$ y $\le 34\text{ KB}$ cada uno, más `church.svg` propio).
- [`history_assets_test.go`](../history_assets_test.go) comprueba que cada retrato exista en disco, pese $\le 60\text{ KB}$, figure en `CREDITOS.md`, tenga `alt` no vacío y que no existan URLs externas en tiempo de ejecución en `web/`.
- [`scripts/history-logic.test.mjs`](../scripts/history-logic.test.mjs) ejecuta pruebas unitarias con `node:test` y valida `HISTORY_PRESETS` directamente contra `dist/logic.wasm` (`proy3Wasm.evaluate` y `proy3Wasm.searchModels`).
