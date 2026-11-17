package logic

import (
	"fmt"
	"strings"
)

// ValidateInterpretation comprueba que la interpretación sea un modelo finito
// para cada símbolo del lenguaje. Acumula errores independientes y usa Path
// para señalar el campo o la fila exacta que la interfaz debe resaltar.
func ValidateInterpretation(language Language, interpretation Interpretation) InterpretationValidateResponse {
	response := InterpretationValidateResponse{Errors: []LogicError{}, Warnings: []Warning{}}
	add := func(code, message, path string) {
		response.Errors = append(response.Errors, LogicError{Code: code, Message: message, Path: path})
	}
	domain := make(map[string]bool, len(interpretation.Domain))
	domainValid := true
	// La semántica de primer orden usada por la aplicación exige un dominio
	// finito, no vacío, sin elementos repetidos y dentro de los límites de costo.
	if len(interpretation.Domain) == 0 {
		add(DOMAIN_EMPTY, "El dominio no puede estar vacío.", "domain")
		domainValid = false
	}
	if len(interpretation.Domain) > MaxDomainSize {
		add(LIMIT_EXCEEDED, fmt.Sprintf("El dominio tiene %d elementos; el máximo permitido es %d.", len(interpretation.Domain), MaxDomainSize), "domain")
		domainValid = false
	}
	for i, value := range interpretation.Domain {
		path := fmt.Sprintf("domain[%d]", i)
		if !validDomainElement(value) {
			add(DOMAIN_INVALID_ELEMENT, fmt.Sprintf("El elemento %q no es válido; use solo letras, números y guion bajo.", value), path)
			domainValid = false
		}
		if domain[value] {
			add(DOMAIN_DUPLICATE, fmt.Sprintf("El elemento %q está repetido en el dominio.", value), path)
			domainValid = false
		}
		domain[value] = true
	}

	for name := range language.Funcs {
		// Toda función declarada debe tener una interpretación explícita.
		if _, exists := interpretation.Funcs[name]; !exists {
			add(FUNC_MISSING, fmt.Sprintf("Falta la tabla de la función %q.", name), "funcs."+name)
		}
	}
	for name, entries := range interpretation.Funcs {
		path := "funcs." + name
		arity, declared := language.Funcs[name]
		if !declared {
			add(FUNC_UNKNOWN, fmt.Sprintf("La función %q no está declarada en el lenguaje.", name), path)
		}
		if len(entries) == 0 {
			add(FUNC_EMPTY, fmt.Sprintf("La tabla de la función %q no tiene entradas.", name), path)
			continue
		}
		if len(entries) > MaxTableEntries {
			add(LIMIT_EXCEEDED, fmt.Sprintf("La tabla de la función %q tiene %d entradas; el máximo permitido es %d.", name, len(entries), MaxTableEntries), path)
		}
		// seen detecta si una misma tupla recibió dos salidas. Una función debe
		// ser univaluada, además de total.
		seen := make(map[string]bool, len(entries))
		for i, entry := range entries {
			rowPath := fmt.Sprintf("%s[%d]", path, i)
			if declared && len(entry.Args) != arity {
				add(FUNC_ARITY, fmt.Sprintf("La entrada tiene aridad %d; la función %q requiere %d.", len(entry.Args), name, arity), rowPath+".args")
			}
			key := tupleKey(entry.Args)
			if seen[key] {
				add(FUNC_DUPLICATE, "Esta entrada repite los mismos argumentos que otra fila; una función solo puede asignar un resultado por tupla.", rowPath+".args")
			}
			if declared && len(entry.Args) == arity {
				valid := true
				for _, arg := range entry.Args {
					if !domain[arg] {
						valid = false
						break
					}
				}
				if valid {
					seen[key] = true
				}
			}
			for j, arg := range entry.Args {
				if !domain[arg] {
					add(FUNC_NOT_IN_DOMAIN, fmt.Sprintf("El argumento %q no pertenece al dominio.", arg), fmt.Sprintf("%s.args[%d]", rowPath, j))
				}
			}
			if !domain[entry.Value] {
				add(FUNC_NOT_IN_DOMAIN, fmt.Sprintf("El resultado %q no pertenece al dominio.", entry.Value), rowPath+".value")
			}
		}
		if !declared || !domainValid || len(entries) > MaxTableEntries {
			continue
		}
		// Una función n-aria sobre D necesita exactamente |D|^n entradas. Para
		// una constante (n=0), el resultado es una única entrada sin argumentos.
		expected, withinLimit := powerWithinLimit(len(domain), arity, MaxTableEntries)
		if !withinLimit {
			add(LIMIT_EXCEEDED, fmt.Sprintf("La tabla total de %q requiere más de %d entradas para cubrir todas las %d-tuplas del dominio; no se puede validar dentro del límite.", name, MaxTableEntries, arity), path)
			continue
		}
		missing := expected - len(seen)
		if missing > 0 {
			examples := missingTupleExamples(interpretation.Domain, arity, seen, MaxIncompleteExamples)
			add(FUNC_INCOMPLETE, fmt.Sprintf("La función %q está incompleta: faltan %d de %d tuplas. Ejemplos faltantes: %s.", name, missing, expected, strings.Join(examples, ", ")), path)
		}
	}

	for name := range language.Preds {
		if _, exists := interpretation.Rels[name]; !exists {
			add(REL_MISSING, fmt.Sprintf("Falta definir la relación %q.", name), "rels."+name)
		}
	}
	for name, tuples := range interpretation.Rels {
		path := "rels." + name
		arity, declared := language.Preds[name]
		if !declared {
			add(REL_UNKNOWN, fmt.Sprintf("La relación %q no está declarada en el lenguaje.", name), path)
		}
		// El proyecto decidió rechazar relaciones vacías. Es una restricción de
		// la aplicación; la lógica de primer orden general sí puede admitirlas.
		if len(tuples) == 0 {
			add(REL_EMPTY, fmt.Sprintf("La relación %q no puede estar vacía.", name), path)
			continue
		}
		if len(tuples) > MaxTableEntries {
			add(LIMIT_EXCEEDED, fmt.Sprintf("La relación %q tiene %d tuplas; el máximo permitido es %d.", name, len(tuples), MaxTableEntries), path)
		}
		seenTuples := make(map[string]bool, len(tuples))
		for i, tuple := range tuples {
			rowPath := fmt.Sprintf("%s[%d]", path, i)
			key := tupleKey(tuple)
			if seenTuples[key] {
				// Repetir una tupla no cambia la relación, por eso es advertencia y
				// no error bloqueante.
				response.Warnings = append(response.Warnings, Warning{
					Kind: WarningDuplicateTuple, Message: "Esta tupla ya aparece en la relación.", Path: rowPath,
				})
			}
			seenTuples[key] = true
			if declared && len(tuple) != arity {
				add(REL_ARITY, fmt.Sprintf("La tupla tiene aridad %d; la relación %q requiere %d.", len(tuple), name, arity), rowPath)
			}
			for j, value := range tuple {
				if !domain[value] {
					add(REL_NOT_IN_DOMAIN, fmt.Sprintf("El elemento %q no pertenece al dominio.", value), fmt.Sprintf("%s[%d]", rowPath, j))
				}
			}
		}
	}
	return response
}

func validDomainElement(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range []byte(value) {
		letter := char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
		digit := char >= '0' && char <= '9'
		if !letter && !digit && char != '_' {
			return false
		}
	}
	return true
}

func tupleKey(tuple []string) string {
	// Prefijar cada valor con su longitud evita colisiones por concatenación:
	// ["a", "bc"] y ["ab", "c"] producen claves distintas.
	var key strings.Builder
	for _, value := range tuple {
		fmt.Fprintf(&key, "%d:%s;", len(value), value)
	}
	return key.String()
}

func powerWithinLimit(base, exponent, limit int) (int, bool) {
	// La comprobación previa a multiplicar evita overflow y trabajo explosivo.
	value := 1
	for i := 0; i < exponent; i++ {
		if base != 0 && value > limit/base {
			return 0, false
		}
		value *= base
	}
	return value, value <= limit
}

func missingTupleExamples(domain []string, arity int, present map[string]bool, maximum int) []string {
	result := []string{}
	var visit func([]string)
	visit = func(prefix []string) {
		if len(result) >= maximum {
			return
		}
		if len(prefix) == arity {
			if !present[tupleKey(prefix)] {
				quoted := make([]string, len(prefix))
				for i, value := range prefix {
					quoted[i] = fmt.Sprintf("%q", value)
				}
				result = append(result, "("+strings.Join(quoted, ", ")+")")
			}
			return
		}
		for _, value := range domain {
			visit(append(prefix, value))
			if len(result) >= maximum {
				return
			}
		}
	}
	visit([]string{})
	return result
}
