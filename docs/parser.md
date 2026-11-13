# Lexer, parser y análisis de fórmulas

El núcleo lógico está en `internal/logic`. La API recibe texto de lógica de
primer orden y un `Language` con las funciones y predicados declarados.

## Gramática

La gramática usa descenso recursivo y los cuantificadores tienen como alcance
el `unary` inmediatamente siguiente:

```text
formula := iff
iff     := imp ( IFF imp )*
imp     := or ( IMP imp )?
or      := and ( OR and )*
and     := unary ( AND unary )*
unary   := NOT unary | (FORALL|EXISTS) IDENT unary | atom
atom    := LPAREN formula RPAREN | IDENT [ LPAREN term (COMMA term)* RPAREN ]
term    := IDENT [ LPAREN term (COMMA term)* RPAREN ]
```

Ejemplo: `forall x P(x) -> Q(x)` se interpreta como
`(forall x P(x)) -> Q(x)`, no como `forall x (P(x) -> Q(x))`.

## Precedencia y asociatividad

De menor a mayor precedencia:

| Nivel | Operador | Asociatividad |
| --- | --- | --- |
| 1 | `iff` | izquierda |
| 2 | `imp` | derecha |
| 3 | `or` | izquierda |
| 4 | `and` | izquierda |
| 5 | `not`, cuantificadores | prefijo |
| 6 | átomos y paréntesis | — |

Por ejemplo, `P(x) -> Q(x) -> R(x)` es
`P(x) -> (Q(x) -> R(x))`, mientras que `P(x) & Q(x) & R(x)` es
`(P(x) & Q(x)) & R(x)`.

## Aliases aceptados

| Token | Unicode | ASCII |
| --- | --- | --- |
| NOT | `¬` | `~`, `!` |
| AND | `∧` | `&`, `/\\` |
| OR | `∨` | `|`, `\\/` |
| IMP | `→` | `->`, `=>` |
| IFF | `↔` | `<->`, `<=>` |
| FORALL | `∀` | `forall` |
| EXISTS | `∃` | `exists` |

Los nombres de `forall` y `exists` se reconocen sin distinguir mayúsculas.
Los identificadores tienen la forma `[A-Za-z_][A-Za-z0-9_]*`. También se
aceptan paréntesis y comas; los espacios y saltos de línea se ignoran.

## Resolución de símbolos

- En un átomo, el nombre debe ser un predicado declarado y la cantidad de
  argumentos debe coincidir con su aridad.
- Una función usada en posición de átomo produce `WRONG_SYMBOL_KIND`.
- Una función con paréntesis en un término debe estar declarada y tener la
  aridad indicada.
- Una función de aridad `0` sin argumentos es una constante y produce
  `App{Fn: nombre, Args: []}`.
- Una función de aridad mayor que `0` sin paréntesis produce `ARITY_MISMATCH`.
- Un identificador sin declaración y sin paréntesis es una variable.
- Un predicado usado como término produce `WRONG_SYMBOL_KIND`.
- Una variable cuantificada no puede tener el nombre de una función o
  predicado declarado.

Los errores de símbolos y aridades se acumulan. Un error sintáctico detiene el
parseo inmediatamente. Las posiciones son offsets en runes, con `Start`
incluido y `End` exclusivo.

## Códigos de error

| Código | Uso |
| --- | --- |
| `LEX_UNEXPECTED_CHAR` | carácter que no pertenece al lenguaje |
| `LEX_INVALID_TOKEN` | token léxico inválido |
| `PARSE_EXPECTED` | falta el token esperado |
| `PARSE_EMPTY` | entrada sin fórmula |
| `PARSE_UNEXPECTED` | token inesperado |
| `UNDECLARED_SYMBOL` | símbolo requerido pero no declarado |
| `ARITY_MISMATCH` | cantidad de argumentos incorrecta |
| `WRONG_SYMBOL_KIND` | función usada como predicado o viceversa |
| `INVALID_NAME` | nombre que no cumple la forma de identificador |
| `DUPLICATE_SYMBOL` | nombre declarado más de una vez |
| `RESERVED_NAME` | uso de `forall` o `exists` como nombre |
| `INVALID_ARITY` | aridad fuera del rango permitido |

Los mensajes están en español e incluyen columna cuando existe una posición de
entrada. Las columnas son 1-based.

## Uso de la API

```go
lang := logic.Language{
    Funcs: map[string]int{"c": 0, "f": 1},
    Preds: map[string]int{"P": 1},
}

formula, errors := logic.ParseFormula("forall x P(f(x))", lang)
if len(errors) > 0 {
    // formula es nil; mostrar errors al usuario.
}
```

Para obtener en una sola llamada el AST y sus variables libres:

```go
analysis := logic.AnalyzeFormula("P(x)", lang)
// analysis.FreeVars == []string{"x"}
// analysis.Warnings y analysis.Errors siempre son slices no nulos.
```

La respuesta puede serializarse directamente a JSON para la UI:

```go
payload, err := json.Marshal(analysis)
```
