# Decisiones de diseño

**Propósito:** Documentar las decisiones técnicas y formales del proyecto junto con su justificación y las alternativas descartadas.

## 1. Alcance fuerte de cuantificadores

- **Decisión:** Los cuantificadores (`∀x`, `∃x`) ligan únicamente la subfórmula `unary` inmediata (`∀x P(x) → Q(x)` equivale a `(∀x P(x)) → Q(x)`).
- **Justificación:** Es la convención estándar en lógica matemática formal, evita ambigüedades al combinar cuantificadores con implicaciones y hace explícito cuándo se requiere agrupar con paréntesis: `∀x (P(x) → Q(x))`.
- **Alternativa descartada:** Alcance débil (extender el cuantificador hasta el cierre de paréntesis o fin de fórmula), porque induce errores silenciosos de alcance en implicaciones sin paréntesis.

## 2. Precedencia de operadores y `→` asociativa a la derecha

- **Decisión:** De menor a mayor precedencia: `↔` (izquierda) < `→` (derecha) < `∨` (izquierda) < `∧` (izquierda) < `¬, ∀, ∃` (prefijo) < átomos/paréntesis.
- **Justificación:** La asociatividad a la derecha de `→` hace que `P → Q → R` signifique `P → (Q → R)` (equivalente a `(P ∧ Q) → R`), coincidiendo con la notación lógica habitual.
- **Alternativa descartada:** `→` asociativa a la izquierda, que produciría `(P → Q) → R`.

## 3. Constantes como funciones de aridad 0

- **Decisión:** No existe un tipo separado de "constante" en el lenguaje; una constante se declara en `funcs` con `arity: 0` y en la interpretación lleva `args: []`.
- **Justificación:** En lógica de primer orden, una constante es un símbolo funcional 0-ario. Simplifica tanto la gramática (`App{Fn, Args: []}`) como el contrato JSON.
- **Alternativa descartada:** Lista separada `consts` en `Language` e `Interpretation`, que duplicaría validación y UI.

## 4. Predicados de aridad $\ge 1$

- **Decisión:** `ValidateLanguage` exige `arity >= 1` para todo predicado (`INVALID_ARITY` en caso contrario).
- **Justificación:** El proyecto modela lógica de primer orden con relaciones $P^I \subseteq D^n$ sobre un dominio $D$; las letras proposicionales 0-arias quedan fuera del modelo de relaciones sobre tuplas.
- **Alternativa descartada:** Permitir predicados 0-arios con tupla vacía `[[]]`.

## 5. Variables como identificadores no declarados

- **Decisión:** Todo identificador válido `[A-Za-z_][A-Za-z0-9_]*` que no esté declarado como función ni predicado en `Language` y aparezca sin paréntesis en posición de término se interpreta como variable (`Var`).
- **Justificación:** El usuario no tiene que predeclarar un conjunto fijo de variables; puede usar `x`, `y`, `z`, `elem_1`, etc. libremente. A cambio, una variable cuantificada no puede colisionar con un símbolo declarado (`WRONG_SYMBOL_KIND`).
- **Alternativa descartada:** Restringir variables a un prefijo o lista fija.

## 6. Funciones totales y relaciones no vacías

- **Decisión:** Toda función $n$-aria debe definir exactamente $|D|^n$ entradas sin duplicados (`FUNC_INCOMPLETE`, `FUNC_DUPLICATE`), y toda relación debe contener al menos una tupla (`REL_EMPTY`).
- **Justificación:** Cumple directamente el requisito 2 del enunciado (*"No se admiten funciones ni relaciones vacías"* y función total $f^I: D^n \to D$).
- **Alternativa descartada:** Funciones parciales o relaciones vacías por defecto.

## 7. Límites de tamaño y presupuesto de evaluación

- **Decisión:** `MaxDomainSize = 100`, `MaxTableEntries = 10000`, `MaxEvaluationSteps = 100000`, `maxExplanationNodes = 2000`.
- **Justificación:** Con cuantificadores anidados el costo es $O(|D|^k)$. Estos límites previenen bloqueos de memoria/CPU tanto en el servidor como en el navegador (WASM), separando además el recorte visual del árbol (`maxExplanationNodes`) de la exactitud del valor booleano.
- **Alternativa descartada:** Evaluación sin cotas, vulnerable a agotamiento de memoria.

## 8. Offsets en runes

- **Decisión:** `LogicError.Start` y `LogicError.End` se calculan en índices de `rune` (caracteres Unicode), no en bytes UTF-8.
- **Justificación:** La fórmula puede contener símbolos multibyte como `∀`, `∃`, `→`, `¬`. JavaScript/DOM indexa cadenas en unidades UTF-16 (coincidentes con runes para BMP), permitiendo que la UI seleccione exactamente el rango del error en el `<textarea>`.

## 9. Errores de validación con HTTP `200`

- **Decisión:** Los errores léxicos, sintácticos y de validación semántica se devuelven dentro de `errors` con HTTP `200 OK` en `/api/language/validate`, `/api/analyze`, `/api/interpretation/validate` y `/api/evaluate`. Solo JSON mal formado (`400`) o fallos de exportación (`422` / `503`) usan códigos HTTP de error.
- **Justificación:** Facilita el consumo uniforme en la UI y permite que el mismo contrato funcione sin cambios sobre WebAssembly (donde no hay códigos de estado HTTP).

## 10. WebAssembly en Web Worker y PDF solo en servidor

- **Decisión:** En GitHub Pages, `logic.wasm` corre dentro de un `Worker` dedicado con timeout de 10 s; la exportación descarga el `.tex` y explica que el PDF requiere el servidor Docker.
- **Justificación:** Evita congelar el hilo principal de la UI durante evaluaciones pesadas y permite abortar/reiniciar el worker si se excede el tiempo. `pdflatex` requiere binarios nativos del sistema operativo imposibles de ejecutar en un sitio estático de GitHub Pages.
