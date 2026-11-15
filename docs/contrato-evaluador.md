# Contrato del evaluador semántico

Este documento define el JSON que comparten el núcleo Go, la UI TypeScript y
el evaluador semántico. Los tipos Go viven en
`internal/logic/evaluator_contract.go` y sus equivalentes TypeScript en
`web/types.ts`.

El backend implementa la validación de interpretaciones y la evaluación
semántica descritas aquí.

## Tipos base

### `LogicError`

```json
{
  "code": "REL_ARITY",
  "message": "La tupla tiene una aridad incorrecta.",
  "start": 0,
  "end": 0,
  "path": "rels.Less[2]"
}
```

`start` y `end` son offsets en runes, con `end` exclusivo. `path` es opcional y
permite ubicar el error en la UI. Ejemplos: `domain`, `funcs.f`, `rels.P[2]` y
`env.x`.

### `Interpretation`

```json
{
  "domain": ["0", "1"],
  "funcs": {
    "f": [
      {"args": ["0"], "value": "1"},
      {"args": ["1"], "value": "0"}
    ]
  },
  "rels": {"P": [["0"]]}
}
```

- `domain` contiene elementos no vacíos formados solo por letras, dígitos y
  `_`.
- `funcs` contiene una lista de `FuncEntry` por función declarada. Cada entrada
  representa una tupla de `D^n`; una constante tiene `args: []`.
- `rels` contiene las tuplas verdaderas de cada relación.
- Las listas se serializan como `[]`, nunca como `null`.

`Env` es un objeto `Record<string,string>` que asigna variables libres a
elementos del dominio.

## Explicaciones

Una `Explanation` representa la evaluación de una subfórmula:

```json
{
  "holds": true,
  "rule": "exists",
  "formula": "∃x P(x)",
  "summary": "Se encontró un testigo.",
  "env": {},
  "witness": {"variable": "x", "value": "1"},
  "checked": 1,
  "domainSize": 3,
  "decisive": [0],
  "children": []
}
```

`rule` puede ser `pred`, `eq`, `not`, `and`, `or`, `imp`, `iff`, `forall` o
`exists`. `eq` identifica una igualdad lógica y `terms` muestra los valores
denotados por sus dos términos. `formula` es la subfórmula impresa con `FormulaString` y `summary`
es una explicación de una línea en español. `env` contiene únicamente las
variables libres de esa subfórmula.

El nodo de igualdad del AST usa `k: "eq"` con términos `left` y `right`, por
ejemplo `{"k":"eq","left":{"k":"var","name":"x"},"right":{"k":"app","fn":"c","args":[]}}`.

Los campos opcionales son:

- `terms`: valor de cada término, únicamente para `pred`.
- `witness`: elemento que hace verdadero un existencial.
- `counterexample`: elemento que hace falso un universal.
- `checked` y `domainSize`: elementos revisados y tamaño del dominio.
- `decisive`: índices de children que determinan el resultado.
- `truncated`: indica que el árbol se recortó por tamaño.

`children` siempre se serializa como una lista, aunque esté vacía.

## Peticiones y respuestas

### Validar una interpretación

`InterpretationValidateRequest`:

```json
{
  "language": {
    "funcs": {"f": 1},
    "preds": {"P": 1}
  },
  "interpretation": {
    "domain": ["0", "1"],
    "funcs": {"f": [{"args": ["0"], "value": "1"}]},
    "rels": {"P": [["0"]]}
  }
}
```

`InterpretationValidateResponse` contiene `errors` y `warnings`, siempre como
listas. Los warnings tienen `kind` `duplicate_tuple` o `extra_env` y pueden
incluir `path`.

La implementación actual valida además el dominio, las tablas de funciones y
las relaciones. El dominio admite hasta 100 elementos y cada tabla hasta
10 000 entradas. Las funciones deben cubrir exactamente el producto `D^n`;
cuando faltan filas, `FUNC_INCOMPLETE` informa la cantidad y hasta cinco
tuplas faltantes de ejemplo. Las rutas usan índices desde cero, por ejemplo
`domain[1]`, `funcs.f[2].args[0]` y `rels.P[1][0]`.

El endpoint `POST /api/interpretation/generate` recibe un lenguaje y, de forma
opcional, `domainSize` (por defecto 3, máximo 100) y `seed`. Genera funciones
totales, constantes con una única entrada sin argumentos y relaciones no
vacías. Devuelve la semilla usada para que la misma interpretación pueda
reproducirse. Las tablas de función que excedan 10 000 filas devuelven
`LIMIT_EXCEEDED` en lugar de una interpretación parcial.

### Evaluar una fórmula

`EvaluateRequest` contiene el lenguaje, el texto de entrada, la interpretación
y el entorno inicial:

```json
{
  "language": {"funcs": {}, "preds": {"P": 1}},
  "input": "P(x)",
  "interpretation": {
    "domain": ["0"],
    "funcs": {},
    "rels": {"P": [["0"]]}
  },
  "env": {"x": "0"}
}
```

Una respuesta exitosa incluye:

```json
{
  "errors": [],
  "warnings": [],
  "result": {
    "value": true,
    "formula": "P(x)",
    "freeVars": ["x"],
    "explanation": {"holds": true, "rule": "pred", "children": []}
  }
}
```

Regla estricta: si `errors` no está vacío, `result` no existe. Una entrada
incorrecta nunca recibe un valor de verdad. `freeVars` también es una lista no
nula cuando existe `result`.

### Buscar modelos y contramodelos

`POST /api/models/search` recibe `language`, `input` y `maxDomainSize` (`N`).
Enumera dominios de tamaño 1 hasta N y todas las interpretaciones posibles
dentro del presupuesto de búsqueda, incluyendo las asignaciones de variables
libres. La respuesta incluye, por separado, el primer modelo que hace verdadera
la fórmula y el primer contramodelo que la hace falsa, con su interpretación y
entorno.

El buscador revisa como máximo 2 000 interpretaciones, 5 000 asignaciones de
variables y tablas con hasta 128 filas por símbolo. `complete: true` indica que la búsqueda recorrió el rango
solicitado o que encontró ambos ejemplos; `limitReached: true` indica que se
detuvo por uno de esos límites. Una respuesta parcial puede incluir un modelo o
contramodelo encontrado, pero no permite concluir que no existe el otro. Si
ambos aparecen, la búsqueda se detiene al encontrarlos.

## Códigos de error del evaluador

| Código | Significado |
| --- | --- |
| `DOMAIN_EMPTY` | el dominio no contiene elementos |
| `DOMAIN_SIZE_INVALID` | el tamaño solicitado al generador no es positivo |
| `DOMAIN_INVALID_ELEMENT` | elemento del dominio con formato inválido |
| `DOMAIN_DUPLICATE` | elemento repetido en el dominio |
| `FUNC_MISSING` | falta una función requerida por el lenguaje |
| `FUNC_UNKNOWN` | se declaró una función no existente en el lenguaje |
| `FUNC_EMPTY` | una función no tiene entradas |
| `FUNC_ARITY` | una entrada de función tiene aridad incorrecta |
| `FUNC_NOT_IN_DOMAIN` | argumento o resultado fuera del dominio |
| `FUNC_DUPLICATE` | entrada de función repetida |
| `FUNC_INCOMPLETE` | faltan tuplas de la tabla de función |
| `REL_MISSING` | falta una relación requerida por el lenguaje |
| `REL_UNKNOWN` | se declaró una relación no existente en el lenguaje |
| `REL_EMPTY` | una relación no tiene tuplas |
| `REL_ARITY` | una tupla de relación tiene aridad incorrecta |
| `REL_NOT_IN_DOMAIN` | tupla de relación fuera del dominio |
| `ENV_MISSING` | falta una variable libre en el entorno |
| `ENV_NOT_IN_DOMAIN` | el entorno asigna un valor fuera del dominio |
| `LIMIT_EXCEEDED` | se excedió un límite general de recursos |
| `EVAL_LIMIT` | se excedió un límite específico de evaluación |

## Flujo obligatorio

El flujo de evaluación implementado es:

```text
validar lenguaje
      ↓
analizar fórmula
      ↓
validar interpretación contra el lenguaje y el dominio
      ↓
validar entorno contra las variables libres y el dominio
      ↓
evaluar semánticamente
```

Cada etapa debe acumular sus errores. La evaluación solo puede comenzar cuando
las etapas anteriores no produzcan errores; en particular, nunca debe generar
`result` si `errors` no está vacío.

La evaluación usa semántica de Tarski sobre el dominio finito: interpreta
términos con las tablas de funciones, la igualdad compara la identidad de los
elementos denotados, predicados por pertenencia de tuplas,
conectivos con sus tablas de verdad y cuantificadores recorriendo el dominio.
Cada cuantificador trabaja sobre una copia del entorno, por lo que una variable
ligada sombrea correctamente una asignación externa con el mismo nombre. El
presupuesto es de 100 000 pasos de evaluación por petición; al excederlo, se
devuelve `EVAL_LIMIT` y no se incluye `result`. El árbol de explicación se
recorta al superar 2 000 nodos, sin cambiar el valor calculado.

## Fixtures compartidos

Los ejemplos de integración están en `testdata/examples/*.json`. Cada archivo
contiene `name`, `description`, `language`, `input`, `interpretation`, `env` y
`expect`. El test Go actual verifica que todos los archivos decodifican contra
los tipos del contrato, sin evaluar todavía sus resultados.
