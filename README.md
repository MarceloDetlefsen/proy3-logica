# proy3-logica

Evaluador semántico de lógica de primer orden sobre interpretaciones finitas.

## Ejecutar

```bash
npm install
npm run build:web
go run .
```

Luego abrir <http://localhost:8080>.

La exportación a PDF requiere `pdflatex` en el `PATH` del servidor. Se puede
seleccionar otro ejecutable compatible con `LATEX_COMPILER=/ruta/al/ejecutable`.

La UI está escrita solo en TypeScript vanilla bajo `web/src/`. `npm run
build:web` genera los módulos que necesita el navegador dentro de `web/build/`;
esa carpeta generada no se versiona. Hay que recompilar después de cambiar los
`.ts` y antes de iniciar Go.

El núcleo lógico está en `internal/logic/`. El contrato compartido entre Go y
TypeScript está definido en `internal/logic` y `web/types.ts`.

## API

El servidor escucha en `http://localhost:8080` y expone endpoints JSON:

### `POST /api/language/validate`

Recibe declaraciones de funciones y predicados:

```json
{
  "funcs": [{ "name": "c", "arity": 0 }],
  "preds": [{ "name": "P", "arity": 1 }]
}
```

Responde con el lenguaje validado y una lista de errores. Los errores de
validación son respuestas `200` dentro de `errors`; un cuerpo JSON mal formado
responde `400` con `{ "message": "..." }`.

### `POST /api/analyze`

Recibe una fórmula y un lenguaje ya definido:

```json
{
  "input": "forall x P(x)",
  "language": {
    "funcs": { "c": 0 },
    "preds": { "P": 1 }
  }
}
```

Responde con `Analysis`: `formula`, `freeVars`, `warnings` y `errors`. Los
errores de lexer/parser o de símbolos permanecen en `errors` con status `200`;
`formula` queda omitida cuando el análisis falla.

Los tipos equivalentes para la UI están en `web/types.ts`, incluyendo
`ValidateLanguageRequest`, `ValidateLanguageResponse`, `AnalyzeRequest` y
`AnalyzeResponse`.

### `POST /api/interpretation/validate`

Valida que una interpretación cubra el lenguaje y que sus tablas sean
consistentes:

```json
{
  "language": { "funcs": { "f": 1 }, "preds": { "P": 1 } },
  "interpretation": {
    "domain": ["0", "1"],
    "funcs": {
      "f": [
        { "args": ["0"], "value": "1" },
        { "args": ["1"], "value": "0" }
      ]
    },
    "rels": { "P": [["0"]] }
  }
}
```

Responde con `InterpretationValidateResponse` (`errors` y `warnings`). Cada
error incluye `path` para ubicar el dato inválido. El dominio admite hasta 100
elementos y cada tabla de función o relación hasta 10 000 entradas. La
completitud de una función se comprueba contra todas las tuplas de `D^n`; si
faltan tuplas, el error informa cuántas faltan y muestra hasta cinco ejemplos.

### `POST /api/evaluate`

Evalúa una fórmula en una interpretación finita. Recibe `language`, `input`,
`interpretation` y `env` como se describe en `docs/contrato-evaluador.md`.
Primero valida el lenguaje, la fórmula, la interpretación y las asignaciones
de todas las variables libres. Si hay errores, no devuelve `result`. La
evaluación aplica semántica de Tarski y devuelve el valor y un árbol de
explicación. Cada petición tiene un presupuesto de 100 000 pasos; si se agota,
responde con `EVAL_LIMIT` en `errors`.

### `POST /api/evaluate/export/pdf`

Recibe el mismo cuerpo que `/api/evaluate`, valida y vuelve a evaluar la
petición, y responde con un PDF compilado mediante `pdflatex`. El documento
incluye la firma, el dominio, todas las tablas de función y relaciones, el
entorno, el resultado y el árbol de explicación disponible (subfórmulas,
valores, reglas, resúmenes, términos, testigos, contraejemplos, revisiones y
ramas decisivas). Si el árbol se recortó, el documento lo indica. Las
interpretaciones inválidas se responden con `422`; si falta `pdflatex`, con
`503`.
