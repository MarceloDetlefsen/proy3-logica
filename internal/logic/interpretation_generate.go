package logic

import (
	"fmt"
	"math/rand"
	"sort"
)

const maxGeneratedRelationTuples = 1000

// GenerateRandomInterpretation construye una interpretación finita válida. La
// semilla hace reproducibles las tablas, algo útil para repetir una demostración
// o convertir un caso aleatorio en una prueba de regresión.
func GenerateRandomInterpretation(language Language, domainSize int, seed int64) (Interpretation, []LogicError) {
	if domainSize < 1 {
		return Interpretation{}, []LogicError{{
			Code: DOMAIN_SIZE_INVALID, Message: "El tamaño del dominio debe ser al menos 1.", Path: "domainSize",
		}}
	}
	if domainSize > MaxDomainSize {
		return Interpretation{}, []LogicError{{
			Code:    LIMIT_EXCEEDED,
			Message: fmt.Sprintf("Se solicitaron %d elementos; el dominio máximo permitido es %d.", domainSize, MaxDomainSize),
			Path:    "domainSize",
		}}
	}

	funcDecls := make([]SymbolDecl, 0, len(language.Funcs))
	predDecls := make([]SymbolDecl, 0, len(language.Preds))
	for name, arity := range language.Funcs {
		funcDecls = append(funcDecls, SymbolDecl{Name: name, Arity: arity})
	}
	for name, arity := range language.Preds {
		predDecls = append(predDecls, SymbolDecl{Name: name, Arity: arity})
	}
	if _, errors := ValidateLanguage(funcDecls, predDecls); len(errors) != 0 {
		return Interpretation{}, errors
	}
	for name, arity := range language.Funcs {
		if arity > MaxGeneratedArity {
			return Interpretation{}, []LogicError{{Code: LIMIT_EXCEEDED, Message: fmt.Sprintf("La aridad %d de la función %q excede el máximo generable de %d.", arity, name, MaxGeneratedArity), Path: "funcs." + name}}
		}
	}
	for name, arity := range language.Preds {
		if arity > MaxGeneratedArity {
			return Interpretation{}, []LogicError{{Code: LIMIT_EXCEEDED, Message: fmt.Sprintf("La aridad %d del predicado %q excede el máximo generable de %d.", arity, name, MaxGeneratedArity), Path: "preds." + name}}
		}
	}

	domain := make([]string, domainSize)
	for i := range domain {
		domain[i] = fmt.Sprintf("d%d", i)
	}
	interpretation := Interpretation{
		Domain: domain,
		Funcs:  make(map[string][]FuncEntry, len(language.Funcs)),
		Rels:   make(map[string][][]string, len(language.Preds)),
	}
	rng := rand.New(rand.NewSource(seed))
	// Los mapas de Go no tienen orden estable. Ordenar nombres garantiza que una
	// misma semilla consuma la secuencia aleatoria de la misma manera.
	functionNames := make([]string, 0, len(language.Funcs))
	for name := range language.Funcs {
		functionNames = append(functionNames, name)
	}
	sort.Strings(functionNames)

	for _, name := range functionNames {
		arity := language.Funcs[name]
		count, withinLimit := powerWithinLimit(domainSize, arity, MaxTableEntries)
		if !withinLimit {
			return Interpretation{}, []LogicError{{
				Code:    LIMIT_EXCEEDED,
				Message: fmt.Sprintf("La tabla total de %q requiere más de %d entradas para cubrir todas las %d-tuplas del dominio.", name, MaxTableEntries, arity),
				Path:    "funcs." + name,
			}}
		}
		entries := make([]FuncEntry, 0, count)
		// Se visitan todas las |D|^n tuplas para garantizar funciones totales.
		visitTuples(domain, arity, func(args []string) {
			entries = append(entries, FuncEntry{Args: append([]string{}, args...), Value: domain[rng.Intn(len(domain))]})
		})
		interpretation.Funcs[name] = entries
	}

	predicateNames := make([]string, 0, len(language.Preds))
	for name := range language.Preds {
		predicateNames = append(predicateNames, name)
	}
	sort.Strings(predicateNames)
	for _, name := range predicateNames {
		arity := language.Preds[name]
		count, withinLimit := powerWithinLimit(domainSize, arity, MaxTableEntries)
		var tuples [][]string
		if withinLimit {
			allTuples := make([][]string, 0, count)
			visitTuples(domain, arity, func(tuple []string) { allTuples = append(allTuples, append([]string{}, tuple...)) })
			for _, tuple := range allTuples {
				if rng.Intn(2) == 1 {
					tuples = append(tuples, tuple)
				}
			}
			// Si el muestreo 50/50 no eligió ninguna, se agrega una para respetar
			// la decisión del proyecto de no admitir relaciones vacías.
			if len(tuples) == 0 {
				tuples = append(tuples, allTuples[rng.Intn(len(allTuples))])
			}
		} else {
			// Para relaciones enormes se muestrea un subconjunto único en vez de
			// materializar todas las combinaciones posibles.
			rowCount := 1 + rng.Intn(maxGeneratedRelationTuples)
			tuples = make([][]string, 0, rowCount)
			seen := make(map[string]bool, rowCount)
			for len(tuples) < rowCount {
				tuple := make([]string, arity)
				for i := range tuple {
					tuple[i] = domain[rng.Intn(len(domain))]
				}
				key := tupleKey(tuple)
				if !seen[key] {
					seen[key] = true
					tuples = append(tuples, tuple)
				}
			}
		}
		interpretation.Rels[name] = tuples
	}
	return interpretation, nil
}

func visitTuples(domain []string, arity int, visit func([]string)) {
	tuple := make([]string, arity)
	var walk func(int)
	walk = func(position int) {
		if position == arity {
			visit(tuple)
			return
		}
		for _, value := range domain {
			tuple[position] = value
			walk(position + 1)
		}
	}
	walk(0)
}
