# Aleatorización de interpretaciones y fórmulas

**Propósito:** Explicar cómo funciona la generación aleatoria de interpretaciones finitas en Go y de fórmulas aleatorias en el frontend TypeScript, sus semillas, garantías de validez y límites.

## Generación aleatoria de interpretaciones

Implementada en `GenerateRandomInterpretation` ([`internal/logic/interpretation_generate.go`](../internal/logic/interpretation_generate.go)) y expuesta por `POST /api/interpretation/generate` (`ExecuteGenerateInterpretation` en [`internal/logic/api_pipeline.go`](../internal/logic/api_pipeline.go)) y por `proy3Wasm.generateInterpretation` en WASM:

- **Dominio:** Genera `domainSize` elementos `d0, d1, ..., d{n-1}` (por defecto `3`; rango permitido `1` a `MaxDomainSize = 100`).
- **Semilla (`seed`):** Si se omite en la petición, se genera una semilla criptográfica de 53 bits con `crypto/rand` y se devuelve en la respuesta para permitir reproducibilidad exacta mediante `math/rand.New(rand.NewSource(seed))`.
- **Garantías de validez:**
  - Valida primero el lenguaje con `ValidateLanguage`.
  - Para cada función $n$-aria, genera todas las $|D|^n$ tuplas con un valor aleatorio en $D$ (garantizando función total), siempre que $|D|^n \le \text{MaxTableEntries}\ (10\,000)$ y `arity <= MaxGeneratedArity` (`1000`).
  - Para cada predicado $n$-ario, si $|D|^n \le 10\,000$, selecciona cada tupla con probabilidad $1/2$ y, si resulta vacía, inserta al menos una tupla aleatoria. Si $|D|^n > 10\,000$, muestrea hasta `maxGeneratedRelationTuples = 1000` tuplas únicas, garantizando que ninguna relación quede vacía.

## Generación aleatoria de fórmulas

Implementada en `generateRandomFormula` y `buildRandomFormula` dentro de [`web/src/formula.ts`](../web/src/formula.ts):

- Valida primero las declaraciones actuales del lenguaje contra `/api/language/validate`.
- Construye una fórmula bien formada usando los símbolos declarados del lenguaje (o igualdades si no hay predicados) y asigna un entorno aleatorio `randomEnvironment(freeVars)` para las variables libres.
- En modo real (`!state.mockMode`), verifica la fórmula generada con `/api/analyze` antes de actualizar el estado.
