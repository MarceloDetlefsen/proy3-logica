package logic

import (
	"fmt"
	"unicode"
)

type TokenType string

const (
	LPAREN TokenType = "LPAREN"
	RPAREN TokenType = "RPAREN"
	COMMA  TokenType = "COMMA"
	EQUAL  TokenType = "EQUAL"
	NOT    TokenType = "NOT"
	AND    TokenType = "AND"
	OR     TokenType = "OR"
	IMP    TokenType = "IMP"
	IFF    TokenType = "IFF"
	FORALL TokenType = "FORALL"
	EXISTS TokenType = "EXISTS"
	IDENT  TokenType = "IDENT"
	EOF    TokenType = "EOF"
)

type Token struct {
	Type       TokenType
	Text       string
	Start, End int
}

// Tokenize convierte la entrada textual en una secuencia neutral que el parser
// puede consumir. Los offsets Start/End cuentan runes (caracteres Unicode), no
// bytes UTF-8; así la interfaz puede seleccionar correctamente símbolos como ∀.
func Tokenize(input string) ([]Token, []LogicError) {
	// []rune evita que un operador Unicode ocupe varias posiciones visuales.
	runes := []rune(input)
	tokens := make([]Token, 0)
	var errors []LogicError

	for index := 0; index < len(runes); {
		if isWhitespace(runes[index]) {
			index++
			continue
		}

		start := index
		if tokenType, length := matchOperator(runes, index); length > 0 {
			tokens = append(tokens, Token{
				Type:  tokenType,
				Text:  string(runes[index : index+length]),
				Start: start,
				End:   index + length,
			})
			index += length
			continue
		}

		if isASCIIIdentifierStart(runes[index]) {
			index++
			for index < len(runes) && isASCIIIdentifierPart(runes[index]) {
				index++
			}
			text := string(runes[start:index])
			tokens = append(tokens, Token{
				Type:  keywordType(text),
				Text:  text,
				Start: start,
				End:   index,
			})
			continue
		}

		char := runes[index]
		errors = append(errors, LogicError{
			Code:    LEX_UNEXPECTED_CHAR,
			Message: fmt.Sprintf("Carácter inesperado %q en la columna %d.", string(char), start+1),
			Start:   start,
			End:     start + 1,
		})
		index++
	}

	tokens = append(tokens, Token{Type: EOF, Start: len(runes), End: len(runes)})
	return tokens, errors
}

// matchOperator centraliza los símbolos Unicode y sus aliases ASCII. Los
// operadores largos van primero para reconocer <-> antes que cualquier prefijo.
func matchOperator(input []rune, start int) (TokenType, int) {
	operators := [...]struct {
		text      string
		tokenType TokenType
	}{
		{"<->", IFF},
		{"<=>", IFF},
		{"->", IMP},
		{"=>", IMP},
		{"/\\", AND},
		{"\\/", OR},
		{"¬", NOT},
		{"~", NOT},
		{"!", NOT},
		{"∧", AND},
		{"&", AND},
		{"∨", OR},
		{"|", OR},
		{"→", IMP},
		{"↔", IFF},
		{"∀", FORALL},
		{"∃", EXISTS},
		{"(", LPAREN},
		{")", RPAREN},
		{",", COMMA},
		{"=", EQUAL},
	}

	for _, operator := range operators {
		operatorRunes := []rune(operator.text)
		if start+len(operatorRunes) > len(input) {
			continue
		}
		matches := true
		for offset, char := range operatorRunes {
			if input[start+offset] != char {
				matches = false
				break
			}
		}
		if matches {
			return operator.tokenType, len(operatorRunes)
		}
	}
	return "", 0
}

// forall/exists se convierten en cuantificadores desde el lexer. Cualquier otro
// texto con forma de identificador queda como IDENT para resolverlo con Language.
func keywordType(text string) TokenType {
	switch asciiLower(text) {
	case "forall":
		return FORALL
	case "exists":
		return EXISTS
	default:
		return IDENT
	}
}

func isWhitespace(char rune) bool {
	return unicode.IsSpace(char)
}

func isASCIIIdentifierStart(char rune) bool {
	return char == '_' || char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}

func isASCIIIdentifierPart(char rune) bool {
	return isASCIIIdentifierStart(char) || char >= '0' && char <= '9'
}

func asciiLower(text string) string {
	runes := []rune(text)
	for index, char := range runes {
		if char >= 'A' && char <= 'Z' {
			runes[index] = char + ('a' - 'A')
		}
	}
	return string(runes)
}
