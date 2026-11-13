# proy3-logica

Evaluador semántico de lógica de primer orden sobre interpretaciones finitas.

## Ejecutar

```bash
go run .
```

Luego abrir <http://localhost:8080>.

El núcleo lógico está en `internal/logic/`. El contrato compartido entre Go y
TypeScript está definido en `internal/logic` y `web/types.ts`.

## API

El servidor escucha en `http://localhost:8080` y expone endpoints JSON:

### `POST /api/language/validate`

Recibe declaraciones de funciones y predicados:

```json
{
  "funcs": [{"name": "c", "arity": 0}],
  "preds": [{"name": "P", "arity": 1}]
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
    "funcs": {"c": 0},
    "preds": {"P": 1}
  }
}
```

Responde con `Analysis`: `formula`, `freeVars`, `warnings` y `errors`. Los
errores de lexer/parser o de símbolos permanecen en `errors` con status `200`;
`formula` queda omitida cuando el análisis falla.

Los tipos equivalentes para la UI están en `web/types.ts`, incluyendo
`ValidateLanguageRequest`, `ValidateLanguageResponse`, `AnalyzeRequest` y
`AnalyzeResponse`.
