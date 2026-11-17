package logic

import (
	"fmt"
	"strings"
)

const (
	// MaxEvaluationSteps limits recursive formula and term work per request.
	MaxEvaluationSteps  = 100000
	maxExplanationNodes = 2000
)

// EvaluateFormula valida todas las capas antes de emitir un valor de verdad:
// lenguaje, sintaxis, interpretación y asignación de variables libres. Solo si
// no hay errores aplica la semántica de Tarski sobre el modelo finito recibido.
func EvaluateFormula(request EvaluateRequest) EvaluateResponse {
	response := EvaluateResponse{Errors: []LogicError{}, Warnings: []Warning{}}
	funcDecls := make([]SymbolDecl, 0, len(request.Language.Funcs))
	predDecls := make([]SymbolDecl, 0, len(request.Language.Preds))
	for name, arity := range request.Language.Funcs {
		funcDecls = append(funcDecls, SymbolDecl{Name: name, Arity: arity})
	}
	for name, arity := range request.Language.Preds {
		predDecls = append(predDecls, SymbolDecl{Name: name, Arity: arity})
	}
	_, languageErrors := ValidateLanguage(funcDecls, predDecls)
	response.Errors = append(response.Errors, languageErrors...)

	formula, parseErrors := ParseFormula(request.Input, request.Language)
	response.Errors = append(response.Errors, parseErrors...)
	interpretationResult := ValidateInterpretation(request.Language, request.Interpretation)
	response.Errors = append(response.Errors, interpretationResult.Errors...)
	response.Warnings = append(response.Warnings, interpretationResult.Warnings...)
	if formula == nil {
		return response
	}
	freeVars := freeVariables(formula)
	domain := make(map[string]bool, len(request.Interpretation.Domain))
	for _, value := range request.Interpretation.Domain {
		domain[value] = true
	}
	for _, variable := range freeVars {
		// Toda fórmula abierta necesita una asignación en D para cada variable
		// libre; de lo contrario su verdad bajo este entorno no está definida.
		value, ok := request.Env[variable]
		if !ok {
			response.Errors = append(response.Errors, LogicError{Code: ENV_MISSING, Message: fmt.Sprintf("Falta asignar un valor a la variable libre %q.", variable), Path: "env." + variable})
			continue
		}
		if !domain[value] {
			response.Errors = append(response.Errors, LogicError{Code: ENV_NOT_IN_DOMAIN, Message: fmt.Sprintf("El valor %q de la variable %q no pertenece al dominio.", value, variable), Path: "env." + variable})
		}
	}
	free := make(map[string]bool, len(freeVars))
	for _, variable := range freeVars {
		free[variable] = true
	}
	for variable := range request.Env {
		// Las asignaciones sobrantes no cambian el resultado, pero se reportan
		// para evitar que el usuario crea que sí participaron.
		if !free[variable] {
			response.Warnings = append(response.Warnings, Warning{Kind: WarningExtraEnv, Message: fmt.Sprintf("La variable %q no es libre en la fórmula y su asignación inicial se ignora.", variable), Path: "env." + variable})
		}
	}
	if len(response.Errors) > 0 {
		return response
	}

	state := evaluationState{
		language: request.Language, interpretation: request.Interpretation,
		functions: make(map[string]map[string]string, len(request.Interpretation.Funcs)),
		relations: make(map[string]map[string]bool, len(request.Interpretation.Rels)),
		stepsLeft: MaxEvaluationSteps, explanationLeft: maxExplanationNodes,
	}
	for name, entries := range request.Interpretation.Funcs {
		// Las tablas se preindexan por tupleKey: durante la recursión, consultar
		// una función o relación pasa de buscar filas a una lectura de map O(1).
		state.functions[name] = make(map[string]string, len(entries))
		for _, entry := range entries {
			state.functions[name][tupleKey(entry.Args)] = entry.Value
		}
	}
	for name, tuples := range request.Interpretation.Rels {
		state.relations[name] = make(map[string]bool, len(tuples))
		for _, tuple := range tuples {
			state.relations[name][tupleKey(tuple)] = true
		}
	}
	value, explanation, err := state.eval(formula, cloneEnv(request.Env))
	if err != nil {
		response.Errors = append(response.Errors, LogicError{Code: EVAL_LIMIT, Message: fmt.Sprintf("La evaluación excedió el límite de %d pasos. Simplifique la fórmula, reduzca el dominio o evite cuantificadores anidados.", MaxEvaluationSteps)})
		return response
	}
	response.Result = &EvaluateResult{Value: value, Formula: FormulaString(formula), FreeVars: freeVars, Explanation: explanation}
	return response
}

type evaluationState struct {
	language        Language
	interpretation  Interpretation
	functions       map[string]map[string]string
	relations       map[string]map[string]bool
	stepsLeft       int
	explanationLeft int
}

func (s *evaluationState) tick() bool {
	// Fórmulas y términos comparten un presupuesto para impedir que dominios
	// grandes con cuantificadores anidados bloqueen servidor o navegador.
	s.stepsLeft--
	return s.stepsLeft >= 0
}

func (s *evaluationState) eval(formula Formula, env Env) (bool, Explanation, error) {
	if !s.tick() {
		return false, Explanation{}, errEvaluationLimit
	}
	holds := false
	// Cada llamada devuelve a la vez el booleano y la evidencia que lo justifica.
	// freeEnv conserva solo asignaciones relevantes para esta subfórmula.
	node := Explanation{Rule: "", Formula: FormulaString(formula), Env: freeEnv(formula, env), Children: []Explanation{}}
	child := func(f Formula, next Env) (bool, Explanation, error) { return s.eval(f, next) }
	appendChild := func(explanation Explanation) int {
		index := len(node.Children)
		if s.explanationLeft > 0 {
			node.Children = append(node.Children, explanation)
			s.explanationLeft--
			return index
		} else {
			// Recortar la explicación no interrumpe la evaluación booleana.
			node.Truncated = true
			return -1
		}
	}
	switch f := formula.(type) {
	case Pred:
		node.Rule = "pred"
		args := make([]string, len(f.Args))
		for i, term := range f.Args {
			value, err := s.evalTerm(term, env)
			if err != nil {
				return false, Explanation{}, err
			}
			args[i] = value
			node.Terms = append(node.Terms, ExplanationTerm{Term: TermString(term), Value: value})
		}
		// Un átomo es verdadero exactamente cuando la tupla de denotaciones
		// pertenece a la relación interpretada.
		holds = s.relations[f.Name][tupleKey(args)]
		if holds {
			node.Summary = "La tupla de términos pertenece a la relación."
		} else {
			node.Summary = "La tupla de términos no pertenece a la relación."
		}
	case Eq:
		node.Rule = "eq"
		left, err := s.evalTerm(f.Left, env)
		if err != nil {
			return false, Explanation{}, err
		}
		right, err := s.evalTerm(f.Right, env)
		if err != nil {
			return false, Explanation{}, err
		}
		node.Terms = []ExplanationTerm{
			{Term: TermString(f.Left), Value: left},
			{Term: TermString(f.Right), Value: right},
		}
		// La igualdad es lógica: compara denotaciones y no necesita una tabla.
		holds = left == right
		if holds {
			node.Summary = fmt.Sprintf("Ambos términos denotan el mismo elemento del dominio (%q).", left)
		} else {
			node.Summary = fmt.Sprintf("Los términos denotan elementos distintos del dominio (%q y %q).", left, right)
		}
	case Not:
		node.Rule = "not"
		value, explanation, err := child(f.F, env)
		if err != nil {
			return false, Explanation{}, err
		}
		appendChild(explanation)
		holds = !value
		node.Summary = "La negación invierte el valor de verdad de su subfórmula."
	case Bin:
		node.Rule = string(f.Op)
		left, leftExplanation, err := child(f.L, env)
		if err != nil {
			return false, Explanation{}, err
		}
		leftIndex := appendChild(leftExplanation)
		// and, or e imp aplican cortocircuito; iff siempre requiere ambos lados.
		needRight := true
		if f.Op == And && !left {
			holds, needRight = false, false
		}
		if f.Op == Or && left {
			holds, needRight = true, false
		}
		if f.Op == Imp && !left {
			holds, needRight = true, false
		}
		if needRight {
			right, rightExplanation, err := child(f.R, env)
			if err != nil {
				return false, Explanation{}, err
			}
			rightIndex := appendChild(rightExplanation)
			switch f.Op {
			case And:
				holds = left && right
			case Or:
				holds = left || right
			case Imp:
				holds = !left || right
			case Iff:
				holds = left == right
			}
			// Decisive indica qué hijos bastan para justificar el resultado en UI.
			if f.Op == And && !holds || f.Op == Or && holds {
				node.Decisive = []int{rightIndex}
			} else {
				node.Decisive = []int{leftIndex, rightIndex}
			}
		} else {
			node.Decisive = []int{leftIndex}
		}
		node.Summary = fmt.Sprintf("El conectivo %s aplicado a sus subfórmulas da %t.", f.Op, holds)
	case Quant:
		node.Rule = string(f.Q)
		checked, domainSize := 0, len(s.interpretation.Domain)
		node.DomainSize = &domainSize
		for _, value := range s.interpretation.Domain {
			checked++
			// Clonar y sobrescribir modela alcance léxico y shadowing: un
			// cuantificador interno puede ligar de nuevo la misma variable.
			next := cloneEnv(env)
			next[f.V] = value
			result, explanation, err := child(f.F, next)
			if err != nil {
				return false, Explanation{}, err
			}
			childIndex := appendChild(explanation)
			// La primera falsedad decide un universal y queda como contraejemplo.
			if f.Q == Forall && !result {
				holds = false
				node.Counterexample = &ExplanationBinding{Variable: f.V, Value: value}
				if childIndex >= 0 {
					node.Decisive = []int{childIndex}
				}
				break
			}
			// La primera verdad decide un existencial y queda como testigo.
			if f.Q == Exists && result {
				holds = true
				node.Witness = &ExplanationBinding{Variable: f.V, Value: value}
				if childIndex >= 0 {
					node.Decisive = []int{childIndex}
				}
				break
			}
			holds = f.Q == Forall
		}
		node.Checked = &checked
		if f.Q == Forall {
			if holds {
				node.Summary = "La fórmula se cumple para todos los elementos del dominio."
			} else {
				node.Summary = "Se encontró un contraejemplo en el dominio."
			}
		} else if holds {
			node.Summary = "Se encontró un testigo en el dominio."
		} else {
			node.Summary = "La fórmula no se cumple para ningún elemento del dominio."
		}
	default:
		return false, Explanation{}, errEvaluationLimit
	}
	node.Holds = holds
	if s.explanationLeft > 0 {
		s.explanationLeft--
	} else {
		node.Truncated = true
	}
	return holds, node, nil
}

var errEvaluationLimit = fmt.Errorf("evaluation step limit exceeded")

func (s *evaluationState) evalTerm(term Term, env Env) (string, error) {
	if !s.tick() {
		return "", errEvaluationLimit
	}
	switch value := term.(type) {
	case Var:
		// Las variables libres vienen del entorno inicial; las ligadas fueron
		// agregadas por el cuantificador que llamó a eval.
		return env[value.Name], nil
	case App:
		// Se evalúan primero los argumentos y luego se consulta la función por
		// la tupla resultante; una App sin argumentos representa una constante.
		args := make([]string, len(value.Args))
		for i, arg := range value.Args {
			result, err := s.evalTerm(arg, env)
			if err != nil {
				return "", err
			}
			args[i] = result
		}
		result, exists := s.functions[value.Fn][tupleKey(args)]
		if exists {
			return result, nil
		}
	}
	return "", errEvaluationLimit
}

func cloneEnv(env Env) Env {
	copy := make(Env, len(env)+1)
	for key, value := range env {
		copy[key] = value
	}
	return copy
}

func freeEnv(formula Formula, env Env) Env {
	result := Env{}
	for _, variable := range freeVariables(formula) {
		if value, exists := env[variable]; exists {
			result[variable] = value
		}
	}
	return result
}

func TermString(term Term) string {
	switch node := term.(type) {
	case Var:
		return node.Name
	case App:
		if len(node.Args) == 0 {
			return node.Fn
		}
		args := make([]string, len(node.Args))
		for i, arg := range node.Args {
			args[i] = TermString(arg)
		}
		return node.Fn + "(" + strings.Join(args, ", ") + ")"
	default:
		return "?"
	}
}

// FormulaString prints a formula with parentheses that make its parse tree
// explicit, including the strong scope of quantifiers.
func FormulaString(formula Formula) string {
	switch node := formula.(type) {
	case Pred:
		args := make([]string, len(node.Args))
		for i, arg := range node.Args {
			args[i] = TermString(arg)
		}
		if len(args) == 0 {
			return node.Name
		}
		return node.Name + "(" + strings.Join(args, ", ") + ")"
	case Eq:
		return TermString(node.Left) + " = " + TermString(node.Right)
	case Not:
		return "¬" + FormulaString(node.F)
	case Bin:
		ops := map[BinOp]string{And: "∧", Or: "∨", Imp: "→", Iff: "↔"}
		return "(" + FormulaString(node.L) + " " + ops[node.Op] + " " + FormulaString(node.R) + ")"
	case Quant:
		quantifier := "∀"
		if node.Q == Exists {
			quantifier = "∃"
		}
		return quantifier + node.V + " " + FormulaString(node.F)
	default:
		return "?"
	}
}
