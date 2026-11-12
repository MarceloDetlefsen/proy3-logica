package logic

import (
	"reflect"
	"testing"
)

func TestTokenizeAliases(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []TokenType
	}{
		{"not", "¬ ~ !", []TokenType{NOT, NOT, NOT, EOF}},
		{"and", "∧ & /\\", []TokenType{AND, AND, AND, EOF}},
		{"or", "∨ | \\/", []TokenType{OR, OR, OR, EOF}},
		{"imp", "→ -> =>", []TokenType{IMP, IMP, IMP, EOF}},
		{"iff", "↔ <-> <=>", []TokenType{IFF, IFF, IFF, EOF}},
		{"quantifiers", "∀ forall FORALL ∃ exists ExIsTs", []TokenType{FORALL, FORALL, FORALL, EXISTS, EXISTS, EXISTS, EOF}},
		{"punctuation", "( ) ,", []TokenType{LPAREN, RPAREN, COMMA, EOF}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, errors := Tokenize(test.input)
			if errors != nil {
				t.Fatalf("unexpected lexical errors: %#v", errors)
			}
			gotTypes := make([]TokenType, 0, len(got))
			for _, token := range got {
				gotTypes = append(gotTypes, token.Type)
			}
			if !reflect.DeepEqual(gotTypes, test.want) {
				t.Fatalf("token types mismatch: want %v, got %v", test.want, gotTypes)
			}
		})
	}
}

func TestTokenizeLongestMatch(t *testing.T) {
	tokens, errors := Tokenize("<-> <=> -> =>")
	if errors != nil {
		t.Fatalf("unexpected lexical errors: %#v", errors)
	}

	want := []Token{
		{Type: IFF, Text: "<->", Start: 0, End: 3},
		{Type: IFF, Text: "<=>", Start: 4, End: 7},
		{Type: IMP, Text: "->", Start: 8, End: 10},
		{Type: IMP, Text: "=>", Start: 11, End: 13},
		{Type: EOF, Start: 13, End: 13},
	}
	if !reflect.DeepEqual(tokens, want) {
		t.Fatalf("tokens mismatch: want %#v, got %#v", want, tokens)
	}
}

func TestTokenizeUsesRuneOffsets(t *testing.T) {
	tokens, errors := Tokenize("P(x) ∧ Q(x)")
	if errors != nil {
		t.Fatalf("unexpected lexical errors: %#v", errors)
	}

	and := tokens[4]
	if and.Type != AND || and.Text != "∧" || and.Start != 5 || and.End != 6 {
		t.Fatalf("unexpected conjunction token: %#v", and)
	}
	if tokens[len(tokens)-1].Start != 11 || tokens[len(tokens)-1].End != 11 {
		t.Fatalf("unexpected EOF position: %#v", tokens[len(tokens)-1])
	}
}

func TestTokenizeIgnoresWhitespace(t *testing.T) {
	tokens, errors := Tokenize(" \tP\n\r ( x ) ")
	if errors != nil {
		t.Fatalf("unexpected lexical errors: %#v", errors)
	}
	wantTexts := []string{"P", "(", "x", ")", ""}
	for index, want := range wantTexts {
		if tokens[index].Text != want {
			t.Errorf("token %d text: want %q, got %q", index, want, tokens[index].Text)
		}
	}
}

func TestTokenizeReportsAllUnexpectedCharacters(t *testing.T) {
	tokens, errors := Tokenize("P # ∧ $")
	if len(errors) != 2 {
		t.Fatalf("expected two errors, got %#v", errors)
	}
	want := []LogicError{
		{Code: LEX_UNEXPECTED_CHAR, Message: `Carácter inesperado "#" en la columna 3.`, Start: 2, End: 3},
		{Code: LEX_UNEXPECTED_CHAR, Message: `Carácter inesperado "$" en la columna 7.`, Start: 6, End: 7},
	}
	if !reflect.DeepEqual(errors, want) {
		t.Fatalf("errors mismatch: want %#v, got %#v", want, errors)
	}
	if len(tokens) != 3 || tokens[0].Type != IDENT || tokens[1].Type != AND || tokens[2].Type != EOF {
		t.Fatalf("unexpected tokens after errors: %#v", tokens)
	}
}

func TestTokenizeEmptyInput(t *testing.T) {
	tokens, errors := Tokenize("")
	if errors != nil {
		t.Fatalf("unexpected lexical errors: %#v", errors)
	}
	want := []Token{{Type: EOF, Start: 0, End: 0}}
	if !reflect.DeepEqual(tokens, want) {
		t.Fatalf("tokens mismatch: want %#v, got %#v", want, tokens)
	}
}
