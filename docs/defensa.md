# Banco de defensa oral y guion de demostración

**Propósito:** Preparar a todos los integrantes del equipo para responder preguntas técnicas del docente sobre cualquier módulo del proyecto y ejecutar una demostración fluida de 3 minutos.

## Guía rápida: "Si te preguntan por X, abre Y"

| Si te preguntan por... | Archivo y función que debes abrir |
| --- | --- |
| Reglas de nombres y aridades del lenguaje | [`internal/logic/language.go`](../internal/logic/language.go) → `ValidateLanguage`, `validateSymbol` |
| Tokens y aliases ASCII/Unicode | [`internal/logic/lexer.go`](../internal/logic/lexer.go) → `Tokenize`, `matchOperator` |
| Precedencia, asociatividad y alcance fuerte | [`internal/logic/parser.go`](../internal/logic/parser.go) → `ParseFormula`, `parseImp`, `parseUnary` |
| Variables libres y entorno | [`internal/logic/analyze.go`](../internal/logic/analyze.go) → `AnalyzeFormula`, `freeVariables` |
| Validación de dominio, funciones y relaciones | [`internal/logic/interpretation_validate.go`](../internal/logic/interpretation_validate.go) → `ValidateInterpretation` |
| Semántica de Tarski, testigos y contraejemplos | [`internal/logic/evaluate.go`](../internal/logic/evaluate.go) → `EvaluateFormula`, `evaluationState.eval`, `evalTerm` |
| Transporte HTTP vs WebAssembly y Web Worker | [`web/src/api.ts`](../web/src/api.ts) y [`web/src/worker.ts`](../web/src/worker.ts) |
| Exportación LaTeX / PDF | [`internal/logic/tex.go`](../internal/logic/tex.go) → `EvaluationTeX`; [`export_pdf.go`](../export_pdf.go) → `compileEvaluationPDF` |
| Aleatorización de interpretaciones | [`internal/logic/interpretation_generate.go`](../internal/logic/interpretation_generate.go) → `GenerateRandomInterpretation` |
| Búsqueda de modelos y contramodelos | [`internal/logic/model_search.go`](../internal/logic/model_search.go) → `SearchModels` |
| Contenedor y seguridad | [`Dockerfile`](../Dockerfile) y [`docker-compose.yml`](../docker-compose.yml) |

---

## Banco de preguntas por módulo (8+ por módulo)

### 1. Lexer y Parser

1. **¿Cómo garantizan el alcance fuerte de cuantificadores?** `parseUnary` ([`internal/logic/parser.go`](../internal/logic/parser.go)) llama recursivamente a `parseUnary()` para el cuerpo del cuantificador, no a `parseIff()`. Así `∀x P(x) → Q(x)` se parsea como `(∀x P(x)) → Q(x)`.
2. **¿Cómo se implementa la asociatividad a la derecha de `→`?** `parseImp` usa `if p.current().Type == IMP` y llama recursivamente a `p.parseImp()`, a diferencia de `parseIff`, `parseOr` y `parseAnd` que usan bucles `for`.
3. **¿Cuál es la precedencia completa?** De menor a mayor: `↔` < `→` < `∨` < `∧` < `¬, ∀, ∃` < átomos (`pred`, `eq`, `(formula)`).
4. **¿Cómo distinguen una constante de una variable?** En `parseTerm` ([`internal/logic/parser.go`](../internal/logic/parser.go)), si el identificador está en `lang.Funcs` con aridad `0` y no tiene paréntesis, produce `App{Fn, Args: []}`; si no está declarado en `lang`, produce `Var{Name}`.
5. **¿Qué pasa si uso un predicado como argumento de una función o una función como átomo?** `parseTerm` y `parseAtom` reportan `WRONG_SYMBOL_KIND` y acumulan el error en `p.errors`.
6. **¿Por qué los offsets están en runes y no en bytes?** `Tokenize` ([`internal/logic/lexer.go`](../internal/logic/lexer.go)) convierte la entrada a `[]rune(input)` para que `Start` y `End` coincidan con índices de caracteres Unicode (p. ej. `∀`, `→`) al seleccionar el error en el `<textarea>` de la UI.
7. **¿Qué ocurre si una variable cuantificada tiene el mismo nombre que un símbolo declarado?** `parseUnary` verifica `lang.Funcs` y `lang.Preds` y reporta `WRONG_SYMBOL_KIND`.
8. **¿Se detiene el parser al primer error?** Ante errores sintácticos (como paréntesis sin cerrar) sí se detiene; ante errores de símbolos y aridades, los acumula en `parser.errors` para mostrarlos todos juntos.

### 2. Evaluación semántica (Tarski)

1. **¿Dónde se evalúan los átomos y términos?** En `evaluationState.eval` (`case Pred`, `case Eq`) y `evalTerm` ([`internal/logic/evaluate.go`](../internal/logic/evaluate.go)), consultando las tablas preindexadas `s.relations` y `s.functions`.
2. **¿Qué pasa si la fórmula tiene errores de sintaxis o la interpretación es inválida?** `EvaluateFormula` valida primero lenguaje, fórmula, interpretación y entorno; si `len(response.Errors) > 0`, retorna inmediatamente con `Result: nil` (nunca emite valor de verdad).
3. **¿Cómo manejan las variables libres?** `freeVariables` ([`internal/logic/analyze.go`](../internal/logic/analyze.go)) las recolecta en orden; `EvaluateFormula` exige cada una en `request.Env` (`ENV_MISSING`) y que su valor pertenezca a `D` (`ENV_NOT_IN_DOMAIN`). Variables sobrantes generan `WarningExtraEnv`.
4. **¿Qué ocurre si una variable ligada vuelve a ligarse en un cuantificador anidado (shadowing)?** `eval` clona el entorno (`cloneEnv`) y sobrescribe `next[f.V] = value`, aplicando alcance léxico correcto.
5. **¿Cómo funciona la igualdad `=`?** `case Eq` evalúa ambos términos con `evalTerm` y compara sus valores en `D` (`left == right`), sin requerir declaración previa ni tabla.
6. **¿Por qué no se permiten relaciones vacías ni funciones incompletas?** `ValidateInterpretation` ([`internal/logic/interpretation_validate.go`](../internal/logic/interpretation_validate.go)) exige `len(tuples) > 0` (`REL_EMPTY`) y verifica que el número de tuplas válidas únicas en `funcs` sea exactamente $|D|^n$ (`FUNC_INCOMPLETE`).
7. **¿Cómo evitan que una fórmula con muchos cuantificadores cuelgue el servidor?** Cada llamada a `eval` y `evalTerm` consume un paso de `MaxEvaluationSteps = 100000` (`tick()`); si se agota, retorna `EVAL_LIMIT`.
8. **¿Por qué usan `tupleKey` para las tablas?** Indexar las tuplas como clave de cadena en un `map` permite búsquedas $O(1)$ durante la evaluación de términos y predicados.

### 3. Árbol de explicación

1. **¿Cómo se construye un testigo?** En `case Quant` con `Forall == false` (`Exists`), al primer $d \in D$ con `result == true` se guarda `Witness = {V, d}`, `Decisive = [childIndex]` y se ejecuta `break`.
2. **¿Cómo se construye un contraejemplo?** En `case Quant` con `Forall == true` (`Forall`), al primer $d \in D$ con `result == false` se guarda `Counterexample = {V, d}`, `Decisive = [childIndex]` y se ejecuta `break`.
3. **¿Qué muestra un universal verdadero o un existencial falso?** Recorre todo el dominio (`Checked == DomainSize`), incluye todos los hijos en `Children` y omite `Witness`/`Counterexample`.
4. **¿Por qué `and`, `or` e `imp` a veces solo tienen 1 hijo?** Por evaluación en cortocircuito (`needRight = false`): si `A` en `A ∧ B` es falso, `B` no es necesario para decidir la verdad y `Decisive = [0]`.
5. **¿Qué pasa con `iff` (`↔`)?** Siempre evalúa ambos lados y marca `Decisive = [0, 1]`.
6. **¿Qué indica `env` en cada nodo del árbol?** `freeEnv(formula, env)` guarda únicamente las variables libres de esa subfórmula para no saturar la vista con variables irrelevantes.
7. **¿Qué significa `truncated: true`?** Que el árbol visual superó `maxExplanationNodes = 2000` nodos; se dejaron de anexar hijos visuales, pero la evaluación booleana continuó completa.
8. **¿Cómo se muestran los términos evaluados?** En `Pred` y `Eq`, `node.Terms` registra `{term, value}` para cada término evaluado.

### 4. Interfaz gráfica

1. **¿Por qué usan TypeScript vanilla sin frameworks?** Minimiza dependencias (`typescript` únicamente en devDependencies), genera JS ES2022 directo en `web/build/` y se embebe en el binario Go con `go:embed`.
2. **¿Cómo funciona la inserción de símbolos con botones y teclado?** `insertAtCursor` en [`web/src/formula.ts`](../web/src/formula.ts) usa `textarea.setRangeText(symbol, start, end, "end")` y dispara el evento `input` para reanalizar.
3. **¿Cómo evitan condiciones de carrera al escribir rápido?** `debounce` en [`web/src/state.ts`](../web/src/state.ts) más cancelación / control de secuencia en los módulos de UI aseguran que la respuesta más reciente prevalezca.
4. **¿Cómo sabe el usuario dónde está un error de sintaxis?** Al hacer clic o activar el error, la UI selecciona el rango `[start, end]` en el `<textarea>` usando los offsets en runes devueltos por el backend.
5. **¿Cómo cambian los selectores de entorno?** Cada vez que `/api/analyze` devuelve `freeVars`, `formula.ts` regenera los selectores de `state.env` manteniendo valores aún válidos en el dominio.
6. **¿Qué pasa si se edita el modelo después de evaluar?** `evaluation.ts` marca el resultado anterior como `stale` (desactualizado) y bloquea la exportación hasta re-evaluar.
7. **¿Qué es `?mock=1`?** Un modo de demostración en `web/src/state.ts` que responde con los datos precalculados de los fixtures sin requerir backend.
8. **¿Qué medidas de accesibilidad existen?** Regiones `aria-live="polite"`, navegación por teclado en fases y tutorial, etiquetas `aria-label` en botones de símbolos y gestión de foco al abrir/cerrar diálogos.
9. **¿Cómo garantizan que Aprender, Ejemplos e Historia no se superpongan?** [`web/src/navigation.ts`](../web/src/navigation.ts) centraliza una sola variable `auxView` (`"aprender" | "ejemplos" | "historia" | null`); abrir cualquiera de ellas cierra automáticamente las demás sin perder el estado del evaluador.
10. **¿Cómo funciona el enrutamiento por hash en GitHub Pages sin romper rutas relativas?** `parseHash` y `formatHash` usan exclusivamente fragmentos `#aprender`, `#ejemplos`, `#historia` y `#historia/<n>`, sin `/` iniciales ni *query strings*, por lo que funcionan bajo `/proy3-logica/` y con el botón Atrás del navegador.
11. **¿Cómo es accesible el modo enfoque de Historia por teclado y en pantallas táctiles?** Mientras las barras laterales están ocultas tienen el atributo `inert` para que `Tab` no entre en ellas; pueden abrirse como paneles flotantes mediante los tiradores visibles (`#focus-handle-left`, `#focus-handle-right` con `aria-expanded` y `aria-controls`), el botón `Menú` de la cabecera o acercando el cursor a la zona de borde de `24 px` (`120 ms` al abrir / `300 ms` al cerrar).
12. **¿Cómo garantizan que la guía Aprender sea fiel al comportamiento real del motor?** [`learn_constants_test.go`](../learn_constants_test.go) verifica en Go que todos los límites citados coincidan con `internal/logic/`, y [`scripts/learn.test.mjs`](../scripts/learn.test.mjs) ejecuta cada ejemplo de [`web/src/learn/lessons.ts`](../web/src/learn/lessons.ts) directamente contra `dist/logic.wasm`.

### 5. Extras (PDF, Aleatorización, Igualdad)

1. **¿Cómo evitan inyección de LaTeX en el PDF?** Primero `EvaluateFormula` valida símbolos/elementos; luego `texEscape` en [`internal/logic/tex.go`](../internal/logic/tex.go) escapa los 10 caracteres especiales de LaTeX (`\ { } # $ % & _ ^ ~`), y `compileEvaluationPDF` pasa `-no-shell-escape` y `-halt-on-error`.
2. **¿Qué pasa si un identificador tiene varios guiones bajos como `x_1_2`?** Es un hallazgo documentado: `texMath` produce `x_{1}_{2}`, causando error de doble subíndice en `pdflatex`.
3. **¿Cómo garantizan que una interpretación aleatoria sea reproducible?** Se pasa o genera una `seed` entera de 53 bits devuelta en la respuesta, usada con `math/rand.New(rand.NewSource(seed))`.
4. **¿Cómo garantizan que una relación aleatoria no sea vacía?** Si al elegir cada tupla con probabilidad $0.5$ ninguna resulta seleccionada, se inserta al menos una tupla aleatoria (`interpretation_generate.go`).
5. **¿Qué pasa si $|D|^n > 10\,000$ al generar una relación?** Para evitar tablas gigantes, muestrea aleatoriamente entre 1 y `maxGeneratedRelationTuples = 1000` tuplas únicas.
6. **¿Dónde se generan las fórmulas aleatorias?** En `buildRandomFormula` dentro de [`web/src/formula.ts`](../web/src/formula.ts), validadas luego contra `/api/analyze`.
7. **¿Qué ocurre si falta `pdflatex` en el servidor?** `exportEvaluationPDFHandler` devuelve `503 Service Unavailable` con un mensaje claro en español.
8. **¿Por qué la exportación a PDF vuelve a evaluar el cuerpo en el servidor?** Para garantizar integridad: no confía en un resultado precalculado enviado por el cliente.

### 6. Despliegue (Docker y GitHub Pages / WASM)

1. **¿Por qué GitHub Pages necesita WebAssembly?** GitHub Pages solo sirve archivos estáticos; no puede ejecutar un servidor Go ni `pdflatex`. Compilar `internal/logic` a `logic.wasm` permite ejecutar exactamente el mismo núcleo Go en el navegador.
2. **¿Por qué ejecutan WASM dentro de un Web Worker?** Para no bloquear el hilo principal de la UI y poder cancelar/terminar evaluaciones que excedan el timeout de 10 s (`web/src/api.ts`).
3. **¿Cómo cambia la UI entre servidor y Pages sin duplicar código?** `web/config.js` define `window.PROY3_BACKEND` (`"http"` en servidor, `"wasm"` en `dist/`), y `web/src/api.ts` selecciona `HttpTransport` o `WasmTransport`.
4. **¿Por qué todas las rutas del frontend son relativas?** GitHub Pages sirve el sitio bajo `/proy3-logica/`; rutas con `/` inicial apuntarían a la raíz del dominio y darían 404.
5. **¿Qué hace la exportación en GitHub Pages?** Llama a `exportEvaluationTeX` en WASM para descargar `resolucion-semantica.tex` e informa que compilar a PDF requiere el servidor Docker.
6. **¿Qué endurecimiento tiene el contenedor Docker?** Usuario no root `10001:10001`, `read_only: true`, `/tmp` en `tmpfs` (`noexec,nosuid`), `cap_drop: [ALL]`, `no-new-privileges`, y TeX Live configurado con `openin_any=p`, `openout_any=p`, `shell_escape=f`.
7. **¿Cómo funciona el `HEALTHCHECK` sin `curl`?** El propio binario Go acepta `-healthcheck`, consulta `http://127.0.0.1:<PORT>/healthz` y retorna código 0 o 1.
8. **¿Qué verifican los workflows de CI/CD?** `ci.yml` valida formato, `vet` nativo y WASM, `go test -race`, smoke test WASM en Node, enlaces de docs y smoke test completo de Docker con PDF real.

### 7. Búsqueda de modelos y contramodelos

1. **¿Qué hace `SearchModels` y en qué orden busca?** Enumera tamaños de dominio `size = 1` hasta `maxDomainSize` (`1..100`) en [`internal/logic/model_search.go`](../internal/logic/model_search.go), priorizando los dominios más pequeños primero para hallar ejemplos mínimos.
2. **¿Cómo enumera todas las funciones y relaciones válidas?** `enumerateFunctions` genera todas las asignaciones $D^n \to D$ por producto cartesiano; `enumerateRelations` recorre máscaras no nulas ($1 \dots 2^{|D|^n}-1$) garantizando que ninguna relación sea vacía.
3. **¿Cómo maneja fórmulas abiertas con variables libres?** `enumerateEnvs` prueba todas las asignaciones posibles en $D^{|\text{libres}|}$, incrementando `evaluated` en cada combinación `(interpretación, entorno)`.
4. **¿Cuándo se detiene temprano?** En cuanto encuentra tanto `Satisfying != nil` como `Falsifying != nil`, o al alcanzar `MaxSearchedInterpretations = 2000` o `MaxSearchedEvaluations = 5000`.
5. **¿Qué significa `limitReached: true` vs `complete: false`?** Que se alcanzó alguna cota (`2000` interpretaciones, `5000` evaluaciones o `maxSearchTableEntries = 128` entradas en una tabla), por lo que la búsqueda no pudo agotar todo el espacio hasta `N`.
6. **¿Aplican ruptura de simetrías (isomorfismos)?** No. Todas las interpretaciones etiquetadas sobre `d0..d(n-1)` se enumeran en orden lexicográfico, lo cual simplifica el código a costa de visitar estructuras isomorfas.
7. **¿Si no encuentra contramodelo hasta `N = 3`, demuestra que la fórmula es válida?** No. Solo prueba que no tiene contramodelo en dominios de tamaño $\le 3$ dentro del presupuesto; una fórmula puede ser falsa únicamente en dominios mayores o infinitos.
8. **¿Funciona igual en GitHub Pages (WASM) que en el servidor Go?** Sí: `cmd/wasm/main.go` expone `searchModels`, el Web Worker lo ejecuta fuera del hilo principal y `WasmTransport` aplica el timeout de 10 s.

### 8. Sección Historia

1. **¿Cómo garantizan que la sección Historia funcione sin internet ni dependencias externas?** Todos los retratos están optimizados localmente en [`web/assets/historia/`](../web/assets/historia/CREDITOS.md) y [`history_assets_test.go`](../history_assets_test.go) falla si detecta enlaces externos en tiempo de ejecución o imágenes faltantes.
2. **¿Cómo verificaron las fechas e información histórica?** Con fuentes académicas de referencia (*Stanford Encyclopedia of Philosophy* y *MacTutor History of Mathematics*), distinguiendo explícitamente entre el Teorema de Completitud (1929/1930) y los Teoremas de Incompletitud (1931), así como la mejora de Rosser (1936).
3. **¿La codificación de Gödel es real o simulada?** Es matemática real con `BigInt` en [`web/src/history/logic.ts`](../web/src/history/logic.ts): `encodeGodel` multiplica potencias de primos consecutivos y `decodeGodel` reconstruye la fórmula exacta mediante factorización.
4. **¿Cómo se conecta Historia con el motor lógico del proyecto?** Los botones de los capítulos de Frege/Tarski, Russell e Hilbert/Legado cargan fórmulas y estructuras reales en el evaluador y ejecutan `/api/evaluate` o `/api/models/search`.
5. **¿Qué ocurre si el usuario activa `prefers-reduced-motion`?** [`web/src/history/demos.ts`](../web/src/history/demos.ts) desactiva los intervalos automáticos y permite avanzar paso a paso manualmente.
6. **¿Cómo se prueban las demos de Historia en CI?** [`scripts/history-logic.test.mjs`](../scripts/history-logic.test.mjs) corre dentro de [`scripts/verify-pages.sh`](../scripts/verify-pages.sh) usando `node:test` y ejecutando los presets sobre `dist/logic.wasm`.

---

## Guion de demostración de 3 minutos

1. **Minuto 0:00 – 0:45 (Lenguaje e Interpretación):** Abrir la app (en Docker o Pages). Declarar una función `s/1` y un predicado `P/1` (o cargar `sin-sucesor`). Mostrar validación en vivo al dejar una tabla incompleta o intentar una relación vacía.
2. **Minuto 0:45 – 1:45 (Fórmula, alcance y entorno):** Escribir `∀x ∃y Lt(x, y)` usando tanto teclado como botones de símbolos; mostrar el aviso de alcance fuerte y probar una fórmula abierta como `Lt(x, y)` para ver aparecer los selectores de entorno.
3. **Minuto 1:45 – 2:30 (Evaluación y árbol paso a paso):** Evaluar, mostrar el contraejemplo/testigo y recorrer el árbol paso a paso destacando las ramas decisivas.
4. **Minuto 2:30 – 3:00 (Aleatorización y PDF/WASM):** Generar una interpretación y fórmula aleatorias; exportar la resolución a PDF (en Docker) o `.tex` (en Pages) y mencionar la suite de pruebas y benchmarks.
