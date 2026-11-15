# Árbol de explicación

**Propósito:** Detallar cómo `evaluationState.eval` construye el árbol de explicación (`Explanation`), cómo determina testigos, contraejemplos, comprobación completa, hijos decisivos y cuándo aplica el recorte por tamaño.

## Estructura del nodo `Explanation`

Definido en [`internal/logic/evaluator_contract.go`](../internal/logic/evaluator_contract.go):

- `holds` (`bool`): Valor de verdad de la subfórmula en el entorno local.
- `rule` (`string`): `pred`, `eq`, `not`, `and`, `or`, `imp`, `iff`, `forall` o `exists`.
- `formula` (`string`): Subfórmula formateada por `FormulaString`.
- `summary` (`string`): Resumen en español de una línea.
- `env` (`Env`): Solo las variables libres de esa subfórmula (`freeEnv`).
- `terms` (`[]ExplanationTerm`): Valor denotado por cada término en `pred` y `eq`.
- `witness` (`*ExplanationBinding`): En `exists` verdadero, primer `{variable, value}` que satisface el cuerpo.
- `counterexample` (`*ExplanationBinding`): En `forall` falso, primer `{variable, value}` que refuta el cuerpo.
- `checked`, `domainSize` (`*int`): Cantidad de elementos del dominio evaluados antes de concluir.
- `decisive` (`[]int`): Índices (base 0) de los hijos en `children` que determinaron el resultado.
- `truncated` (`bool`): `true` si se alcanzó `maxExplanationNodes = 2000`.

## Reglas de construcción y decisión

1. **Testigo (`exists` verdadero):** Al encontrar el primer $d \in D$ donde el cuerpo evalúa a `true`, registra `witness = {V, d}`, `decisive = [childIndex]` y corta el ciclo (`break`).
2. **Contraejemplo (`forall` falso):** Al encontrar el primer $d \in D$ donde el cuerpo evalúa a `false`, registra `counterexample = {V, d}`, `decisive = [childIndex]` y corta el ciclo (`break`).
3. **Comprobación completa (`forall` verdadero / `exists` falso):** Recorre todos los $|D|$ elementos (`checked == domainSize`), agrega todos los hijos a `children` y deja `witness`/`counterexample` omitidos.
4. **Conectivos binarios con cortocircuito (`eval` en [`internal/logic/evaluate.go`](../internal/logic/evaluate.go)):**
   - `And` con izquierdo falso: no evalúa el derecho; `decisive = [0]`.
   - `Or` con izquierdo verdadero: no evalúa el derecho; `decisive = [0]`.
   - `Imp` con antecedente falso: no evalúa el consecuente; `decisive = [0]`.
   - Si evalúa ambos: en `And` falso o `Or` verdadero, `decisive = [1]`; en el resto, `decisive = [0, 1]`.
5. **Recorte del árbol (`maxExplanationNodes = 2000`):** Cuando `explanationLeft == 0`, `appendChild` deja de agregar nodos hijos y marca `node.Truncated = true`. El valor booleano de la evaluación se sigue calculando íntegro (sujeto únicamente a `MaxEvaluationSteps = 100000`).
