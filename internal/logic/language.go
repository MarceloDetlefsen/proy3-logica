package logic

type Language struct {
	Funcs map[string]int `json:"funcs"`
	Preds map[string]int `json:"preds"`
}

type SymbolDecl struct {
	Name  string `json:"name"`
	Arity int    `json:"arity"`
}

// ValidateLanguage es la puerta de entrada de la fase de lenguaje.
// Primero valida todas las declaraciones y solo construye los mapas finales
// cuando no existe ningún error. El mapa seen es compartido entre funciones y
// predicados: por eso un mismo nombre tampoco puede pertenecer a ambas clases.
func ValidateLanguage(funcs, preds []SymbolDecl) (Language, []LogicError) {
	errors := make([]LogicError, 0)
	seen := make(map[string]string, len(funcs)+len(preds))

	for _, decl := range funcs {
		validateSymbol(decl, "función", &errors, seen)
	}
	for _, decl := range preds {
		validateSymbol(decl, "predicado", &errors, seen)
	}

	if len(errors) > 0 {
		return Language{}, errors
	}

	language := Language{
		Funcs: make(map[string]int, len(funcs)),
		Preds: make(map[string]int, len(preds)),
	}
	for _, decl := range funcs {
		language.Funcs[decl.Name] = decl.Arity
	}
	for _, decl := range preds {
		language.Preds[decl.Name] = decl.Arity
	}
	return language, nil
}

// validateSymbol concentra las reglas comunes de una declaración. Recibe el
// tipo como texto porque las funciones permiten aridad 0 (constantes), mientras
// que los predicados del proyecto deben tener al menos un argumento.
func validateSymbol(decl SymbolDecl, kind string, errors *[]LogicError, seen map[string]string) {
	// validSymbolName verifica el formato [A-Za-z_][A-Za-z0-9_]*. Se valida
	// aparte de las palabras reservadas para poder reportar ambos problemas.
	if !validSymbolName(decl.Name) {
		*errors = append(*errors, LogicError{
			Code:    INVALID_NAME,
			Message: `El nombre "` + decl.Name + `" no es válido.`,
			Start:   0,
			End:     0,
		})
	}
	if isReservedName(decl.Name) {
		*errors = append(*errors, LogicError{
			Code:    RESERVED_NAME,
			Message: `El nombre "` + decl.Name + `" está reservado.`,
			Start:   0,
			End:     0,
		})
	}
	// seen funciona como una tabla de símbolos: guarda dónde apareció primero
	// cada nombre. Al reutilizarlo en ambos bucles de ValidateLanguage también
	// detecta choques entre una función y un predicado.
	if previous, exists := seen[decl.Name]; exists {
		*errors = append(*errors, LogicError{
			Code:    DUPLICATE_SYMBOL,
			Message: `El nombre "` + decl.Name + `" ya fue declarado como ` + previous + `.`,
			Start:   0,
			End:     0,
		})
	} else {
		seen[decl.Name] = kind
	}

	// Un predicado de esta aplicación representa una relación de aridad >= 1.
	if kind == "predicado" && decl.Arity < 1 {
		*errors = append(*errors, LogicError{
			Code:    INVALID_ARITY,
			Message: `El predicado "` + decl.Name + `" debe tener aridad mayor o igual a 1.`,
			Start:   0,
			End:     0,
		})
	}
	// Una función admite aridad 0: ese es precisamente el modo en que el AST y
	// el evaluador representan una constante. Solo las aridades negativas fallan.
	if kind == "función" && decl.Arity < 0 {
		*errors = append(*errors, LogicError{
			Code:    INVALID_ARITY,
			Message: `La función "` + decl.Name + `" debe tener aridad mayor o igual a 0.`,
			Start:   0,
			End:     0,
		})
	}
}

// validSymbolName limita los identificadores a ASCII para que lexer, parser,
// tablas JSON y generación de LaTeX compartan exactamente la misma gramática.
func validSymbolName(name string) bool {
	if name == "" {
		return false
	}
	for index, char := range []byte(name) {
		isLetter := char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
		isDigit := char >= '0' && char <= '9'
		if index == 0 {
			if !isLetter && char != '_' {
				return false
			}
			continue
		}
		if !isLetter && !isDigit && char != '_' {
			return false
		}
	}
	return true
}

// forall y exists son aliases ASCII de los cuantificadores, sin distinguir
// mayúsculas; declararlos como símbolos haría ambigua la tokenización.
func isReservedName(name string) bool {
	return equalFoldASCII(name, "forall") || equalFoldASCII(name, "exists")
}

func equalFoldASCII(left, right string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		leftChar, rightChar := left[index], right[index]
		if leftChar >= 'A' && leftChar <= 'Z' {
			leftChar += 'a' - 'A'
		}
		if rightChar >= 'A' && rightChar <= 'Z' {
			rightChar += 'a' - 'A'
		}
		if leftChar != rightChar {
			return false
		}
	}
	return true
}
