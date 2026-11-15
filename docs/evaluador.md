# Evaluador semántico

**Propósito:** Explicar la definición formal de satisfacción (semántica de Tarski) implementada en el proyecto, su correspondencia exacta con el código Go, todos los códigos de error de validación/evaluación y tres ejemplos trabajados a mano.

## Correspondencia entre Tarski y el código

La evaluación de una fórmula $\varphi$ bajo una interpretación $\mathcal{I} = (D, \{f^{\mathcal{I}}\}, \{P^{\mathcal{I}}\})$ y un entorno $s: \text{Var} \to D$ se implementa en [`internal/logic/evaluate.go`](../internal/logic/evaluate.go):

| Constructo formal | Definición de Tarski | Implementación en `internal/logic/evaluate.go` |
| --- | --- | --- |
| Término variable $x$ | $\llbracket x \rrbracket^{\mathcal{I}}_s = s(x)$ | `evalTerm` (`case Var`: `return env[value.Name], nil`) |
| Término funcional $f(t_1, \dots, t_n)$ | $\llbracket f(t_1, \dots, t_n) \rrbracket^{\mathcal{I}}_s = f^{\mathcal{I}}(\llbracket t_1 \rrbracket, \dots, \llbracket t_n \rrbracket)$ | `evalTerm` (`case App`: evalúa argumentos recursivamente y consulta `s.functions[value.Fn][tupleKey(args)]`) |
| Átomo $P(t_1, \dots, t_n)$ | $\mathcal{I}, s \models P(t_1, \dots, t_n) \iff (\llbracket t_1 \rrbracket, \dots, \llbracket t_n \rrbracket) \in P^{\mathcal{I}}$ | `eval` (`case Pred`: `holds = s.relations[f.Name][tupleKey(args)]`) |
| Igualdad $t_1 = t_2$ | $\mathcal{I}, s \models t_1 = t_2 \iff \llbracket t_1 \rrbracket^{\mathcal{I}}_s = \llbracket t_2 \rrbracket^{\mathcal{I}}_s$ | `eval` (`case Eq`: `holds = left == right`) |
| Negación $\neg \varphi$ | $\mathcal{I}, s \models \neg \varphi \iff \mathcal{I}, s \not\models \varphi$ | `eval` (`case Not`: `holds = !value`) |
| Conjunción $\varphi \land \psi$ | $\mathcal{I}, s \models \varphi \land \psi \iff \mathcal{I}, s \models \varphi \text{ y } \mathcal{I}, s \models \psi$ | `eval` (`case Bin`, `And`, con cortocircuito si `!left`) |
| Disyunción $\varphi \lor \psi$ | $\mathcal{I}, s \models \varphi \lor \psi \iff \mathcal{I}, s \models \varphi \text{ o } \mathcal{I}, s \models \psi$ | `eval` (`case Bin`, `Or`, con cortocircuito si `left`) |
| Implicación $\varphi \to \psi$ | $\mathcal{I}, s \models \varphi \to \psi \iff \mathcal{I}, s \not\models \varphi \text{ o } \mathcal{I}, s \models \psi$ | `eval` (`case Bin`, `Imp`, con cortocircuito si `!left`) |
| Bicondicional $\varphi \leftrightarrow \psi$ | $\mathcal{I}, s \models \varphi \leftrightarrow \psi \iff (\mathcal{I}, s \models \varphi) = (\mathcal{I}, s \models \psi)$ | `eval` (`case Bin`, `Iff`: `holds = left == right`) |
| Universal $\forall x\, \varphi$ | $\mathcal{I}, s \models \forall x\, \varphi \iff \forall d \in D,\ \mathcal{I}, s[x \mapsto d] \models \varphi$ | `eval` (`case Quant`, `Forall`: itera `Domain`, detiene al hallar `!result`) |
| Existencial $\exists x\, \varphi$ | $\mathcal{I}, s \models \exists x\, \varphi \iff \exists d \in D,\ \mathcal{I}, s[x \mapsto d] \models \varphi$ | `eval` (`case Quant`, `Exists`: itera `Domain`, detiene al hallar `result`) |

## Códigos de error

Definidos en [`internal/logic/errors.go`](../internal/logic/errors.go) e [`internal/logic/evaluator_contract.go`](../internal/logic/evaluator_contract.go):

- **Lenguaje y sintaxis:** `INVALID_NAME` (`"1P"`), `RESERVED_NAME` (`"forall"`), `DUPLICATE_SYMBOL` (`P` en funciones y predicados), `INVALID_ARITY` (predicado de aridad 0), `LEX_UNEXPECTED_CHAR` (`"@"`), `PARSE_EMPTY` (`""`), `PARSE_EXPECTED` (`"P(x"`), `UNDECLARED_SYMBOL` (`Q(x)` sin declarar `Q`), `ARITY_MISMATCH` (`P(x,y)` para `P/1`), `WRONG_SYMBOL_KIND` (`f(x)` usado como átomo).
- **Interpretación:** `DOMAIN_EMPTY` (`domain: []`), `DOMAIN_SIZE_INVALID` (`domainSize: 0`), `DOMAIN_INVALID_ELEMENT` (`"a-b"`), `DOMAIN_DUPLICATE` (`["a","a"]`), `FUNC_MISSING`, `FUNC_UNKNOWN`, `FUNC_EMPTY`, `FUNC_ARITY`, `FUNC_NOT_IN_DOMAIN`, `FUNC_DUPLICATE`, `FUNC_INCOMPLETE`, `REL_MISSING`, `REL_UNKNOWN`, `REL_EMPTY`, `REL_ARITY`, `REL_NOT_IN_DOMAIN`, `LIMIT_EXCEEDED`.
- **Entorno y evaluación:** `ENV_MISSING` (falta variable libre en `env`), `ENV_NOT_IN_DOMAIN` (`env.x = "z"` fuera de `D`), `EVAL_LIMIT` (supera `MaxEvaluationSteps = 100000`).

## 3 ejemplos trabajados a mano

1. **Universal falso (`sin-sucesor`):**
   - $D = \{1, 2\}$, $Lt^I = \{(1, 2)\}$, fórmula $\forall x\, \exists y\, Lt(x, y)$.
   - Para $x = 1$: se prueba $y = 1 \to (1,1) \notin Lt^I$ (falso); $y = 2 \to (1,2) \in Lt^I$ (verdadero, testigo $y = 2$).
   - Para $x = 2$: $y = 1 \to$ falso; $y = 2 \to$ falso. $\exists y\, Lt(2, y)$ es **falso**.
   - Resultado global: **Falso**, contraejemplo $x = 2$, `checked = 2` de `domainSize = 2`.
2. **Existencial verdadero (`min-existe`):**
   - $D = \{1, 2, 3\}$, $Leq^I = \{(1,1),(1,2),(1,3),(2,2),(2,3),(3,3)\}$, fórmula $\exists x\, \forall y\, Leq(x, y)$.
   - Para $x = 1$: $\forall y\, Leq(1, y)$ verifica $(1,1), (1,2), (1,3) \in Leq^I \to$ **verdadero**.
   - Se detiene inmediatamente con testigo $x = 1$ (`checked = 1` de `domainSize = 3`).
3. **Igualdad con función (`funcion-sucesor`):**
   - $D = \{0, 1\}$, $s(0)=1, s(1)=0$, fórmula abierta $s(x) = y$ con entorno $\{x: 0, y: 1\}$.
   - $\llbracket s(x) \rrbracket = s^I(0) = 1$, $\llbracket y \rrbracket = 1 \implies 1 = 1 \implies$ **Verdadero**.
