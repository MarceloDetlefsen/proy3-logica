package logic

import (
	"fmt"
	"sort"
)

const (
	MaxSearchedInterpretations = 2000
	MaxSearchedEvaluations     = 5000
	maxSearchTableEntries      = 128
)

// SearchModels enumera interpretaciones finitas por tamaño creciente para hallar
// primero ejemplos pequeños. No demuestra validez sobre estructuras infinitas:
// Complete solo afirma que agotó el espacio finito solicitado dentro del presupuesto.
func SearchModels(request ModelSearchRequest) ModelSearchResponse {
	response := ModelSearchResponse{Errors: []LogicError{}, MaxDomainSize: request.MaxDomainSize, Complete: true}
	if request.MaxDomainSize < 1 || request.MaxDomainSize > MaxDomainSize {
		response.Errors = append(response.Errors, LogicError{Code: DOMAIN_SIZE_INVALID, Message: fmt.Sprintf("N debe estar entre 1 y %d.", MaxDomainSize), Path: "maxDomainSize"})
		return response
	}
	funcs, preds := declarations(request.Language)
	_, errs := ValidateLanguage(funcs, preds)
	response.Errors = append(response.Errors, errs...)
	formula, parseErrors := ParseFormula(request.Input, request.Language)
	response.Errors = append(response.Errors, parseErrors...)
	if len(response.Errors) > 0 {
		return response
	}
	variables := freeVariables(formula)
	// Se comienza por |D|=1 y se avanza hasta N. No se rompen simetrías por
	// isomorfismo, así que pueden visitarse modelos estructuralmente equivalentes.
	for size := 1; size <= request.MaxDomainSize; size++ {
		domain := make([]string, size)
		for i := range domain {
			domain[i] = fmt.Sprintf("d%d", i)
		}
		for _, arity := range request.Language.Funcs {
			if _, ok := powerWithinLimit(size, arity, maxSearchTableEntries); !ok {
				response.Complete = false
				response.LimitReached = true
				return response
			}
		}
		for _, arity := range request.Language.Preds {
			if _, ok := powerWithinLimit(size, arity, maxSearchTableEntries); !ok {
				response.Complete = false
				response.LimitReached = true
				return response
			}
		}
		interpretation := Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}
		enumerateModelTables(request.Language, domain, interpretation, func(candidate Interpretation) bool {
			if response.Checked >= MaxSearchedInterpretations {
				response.Complete = false
				response.LimitReached = true
				return false
			}
			response.Checked++
			// Una fórmula abierta se prueba bajo todas las asignaciones D^k.
			return enumerateEnvs(variables, domain, Env{}, func(env Env) bool {
				if response.Evaluated >= MaxSearchedEvaluations {
					response.Complete = false
					response.LimitReached = true
					return false
				}
				response.Evaluated++
				evaluation := EvaluateFormula(EvaluateRequest{Language: request.Language, Input: request.Input, Interpretation: candidate, Env: env})
				if len(evaluation.Errors) != 0 || evaluation.Result == nil {
					response.Complete = false
					response.LimitReached = true
					return false
				}
				found := &ModelSearchExample{Interpretation: cloneInterpretation(candidate), Env: cloneEnv(env)}
				if evaluation.Result.Value && response.Satisfying == nil {
					response.Satisfying = found
				}
				if !evaluation.Result.Value && response.Falsifying == nil {
					response.Falsifying = found
				}
				// Se detiene temprano cuando ya existe modelo y contramodelo.
				return response.Satisfying == nil || response.Falsifying == nil
			})
		})
		if response.Satisfying != nil && response.Falsifying != nil {
			return response
		}
		if !response.Complete {
			return response
		}
	}
	return response
}

func declarations(language Language) ([]SymbolDecl, []SymbolDecl) {
	funcs, preds := make([]SymbolDecl, 0, len(language.Funcs)), make([]SymbolDecl, 0, len(language.Preds))
	for name, arity := range language.Funcs {
		funcs = append(funcs, SymbolDecl{Name: name, Arity: arity})
	}
	for name, arity := range language.Preds {
		preds = append(preds, SymbolDecl{Name: name, Arity: arity})
	}
	sort.Slice(funcs, func(i, j int) bool { return funcs[i].Name < funcs[j].Name })
	sort.Slice(preds, func(i, j int) bool { return preds[i].Name < preds[j].Name })
	return funcs, preds
}

func enumerateModelTables(language Language, domain []string, current Interpretation, visit func(Interpretation) bool) bool {
	funcs, preds := declarations(language)
	return enumerateFunctions(funcs, preds, 0, domain, current, visit)
}

func enumerateFunctions(funcs, preds []SymbolDecl, index int, domain []string, current Interpretation, visit func(Interpretation) bool) bool {
	if index == len(funcs) {
		return enumerateRelations(funcs, preds, 0, domain, current, visit)
	}
	decl := funcs[index]
	entries := []FuncEntry{}
	visitTuples(domain, decl.Arity, func(args []string) { entries = append(entries, FuncEntry{Args: append([]string{}, args...)}) })
	// Cada posición de la tabla puede tomar cualquier valor de D: esto enumera
	// todas las funciones totales D^n -> D.
	var assign func(int) bool
	assign = func(position int) bool {
		if position == len(entries) {
			current.Funcs[decl.Name] = append([]FuncEntry{}, entries...)
			return enumerateFunctions(funcs, preds, index+1, domain, current, visit)
		}
		for _, value := range domain {
			entries[position].Value = value
			if !assign(position + 1) {
				return false
			}
		}
		return true
	}
	return assign(0)
}

func enumerateRelations(funcs, preds []SymbolDecl, index int, domain []string, current Interpretation, visit func(Interpretation) bool) bool {
	if index == len(preds) {
		return visit(current)
	}
	decl := preds[index]
	tuples := [][]string{}
	visitTuples(domain, decl.Arity, func(args []string) { tuples = append(tuples, append([]string{}, args...)) })
	selected := [][]string{}
	// Para cada tupla se exploran las decisiones excluir/incluir. La selección
	// vacía se omite porque el contrato del proyecto exige relaciones no vacías.
	var choose func(int) bool
	choose = func(position int) bool {
		if position == len(tuples) {
			if len(selected) == 0 {
				return true
			}
			current.Rels[decl.Name] = append([][]string{}, selected...)
			return enumerateRelations(funcs, preds, index+1, domain, current, visit)
		}
		if !choose(position + 1) {
			return false
		}
		selected = append(selected, tuples[position])
		keepGoing := choose(position + 1)
		selected = selected[:len(selected)-1]
		return keepGoing
	}
	return choose(0)
}

func enumerateEnvs(variables, domain []string, current Env, visit func(Env) bool) bool {
	if len(variables) == 0 {
		return visit(current)
	}
	variable := variables[0]
	for _, value := range domain {
		current[variable] = value
		if !enumerateEnvs(variables[1:], domain, current, visit) {
			delete(current, variable)
			return false
		}
	}
	delete(current, variable)
	return true
}

func cloneInterpretation(source Interpretation) Interpretation {
	result := Interpretation{Domain: append([]string{}, source.Domain...), Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}
	for name, entries := range source.Funcs {
		copied := make([]FuncEntry, len(entries))
		for i, entry := range entries {
			copied[i] = FuncEntry{Args: append([]string{}, entry.Args...), Value: entry.Value}
		}
		result.Funcs[name] = copied
	}
	for name, tuples := range source.Rels {
		copied := make([][]string, len(tuples))
		for i, tuple := range tuples {
			copied[i] = append([]string{}, tuple...)
		}
		result.Rels[name] = copied
	}
	return result
}
