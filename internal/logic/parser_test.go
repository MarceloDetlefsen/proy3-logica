package logic

import (
	"reflect"
	"testing"
)

var parserLanguage = Language{
	Funcs: map[string]int{"c": 0, "f": 2, "g": 1},
	Preds: map[string]int{"P": 1, "Q": 1, "R": 1},
}

func TestParseFormulaPrecedence(t *testing.T) {
	v := func(name string) Term { return Var{Name: name} }
	p := func(name string, args ...Term) Formula { return Pred{Name: name, Args: args} }
	b := func(op BinOp, left, right Formula) Formula { return Bin{Op: op, L: left, R: right} }

	tests := []struct {
		name  string
		input string
		want  Formula
	}{
		{
			name:  "and binds tighter than or",
			input: "P(x) | Q(x) & R(x)",
			want:  b(Or, p("P", v("x")), b(And, p("Q", v("x")), p("R", v("x")))),
		},
		{
			name:  "or binds tighter than implication",
			input: "P(x) -> Q(x) | R(x)",
			want:  b(Imp, p("P", v("x")), b(Or, p("Q", v("x")), p("R", v("x")))),
		},
		{
			name:  "implication binds tighter than iff",
			input: "P(x) <-> Q(x) -> R(x)",
			want:  b(Iff, p("P", v("x")), b(Imp, p("Q", v("x")), p("R", v("x")))),
		},
		{
			name:  "left associative iff",
			input: "P(x) <-> Q(x) <-> R(x)",
			want:  b(Iff, b(Iff, p("P", v("x")), p("Q", v("x"))), p("R", v("x"))),
		},
		{
			name:  "right associative implication",
			input: "P(x) -> Q(x) -> R(x)",
			want:  b(Imp, p("P", v("x")), b(Imp, p("Q", v("x")), p("R", v("x")))),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, errors := ParseFormula(test.input, parserLanguage)
			if errors != nil {
				t.Fatalf("unexpected errors: %#v", errors)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("AST mismatch: want %#v, got %#v", test.want, got)
			}
		})
	}
}

func TestParseFormulaQuantifiersAndUnary(t *testing.T) {
	v := func(name string) Term { return Var{Name: name} }
	p := func(name string, args ...Term) Formula { return Pred{Name: name, Args: args} }
	tests := []struct {
		name  string
		input string
		want  Formula
	}{
		{
			name:  "quantifier binds only unary",
			input: "forall x P(x) -> Q(x)",
			want:  Bin{Op: Imp, L: Quant{Q: Forall, V: "x", F: p("P", v("x"))}, R: p("Q", v("x"))},
		},
		{
			name:  "nested quantifiers",
			input: "exists x forall y P(x)",
			want:  Quant{Q: Exists, V: "x", F: Quant{Q: Forall, V: "y", F: p("P", v("x"))}},
		},
		{
			name:  "double negation",
			input: "!!P(x)",
			want:  Not{F: Not{F: p("P", v("x"))}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, errors := ParseFormula(test.input, parserLanguage)
			if errors != nil {
				t.Fatalf("unexpected errors: %#v", errors)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("AST mismatch: want %#v, got %#v", test.want, got)
			}
		})
	}
}

func TestParseFormulaTerms(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  Formula
	}{
		{
			name:  "constant and variable",
			input: "P(c)",
			want:  Pred{Name: "P", Args: []Term{App{Fn: "c", Args: []Term{}}}},
		},
		{
			name:  "nested functions",
			input: "P(f(g(x),c))",
			want: Pred{Name: "P", Args: []Term{App{Fn: "f", Args: []Term{
				App{Fn: "g", Args: []Term{Var{Name: "x"}}},
				App{Fn: "c", Args: []Term{}},
			}}}},
		},
		{
			name:  "ASCII aliases",
			input: "~P(x) /\\ Q(x) \\/ R(x) => P(x) <=> Q(x)",
			want: Bin{Op: Iff,
				L: Bin{Op: Imp, L: Bin{Op: Or, L: Bin{Op: And, L: Not{F: Pred{Name: "P", Args: []Term{Var{Name: "x"}}}}, R: Pred{Name: "Q", Args: []Term{Var{Name: "x"}}}}, R: Pred{Name: "R", Args: []Term{Var{Name: "x"}}}}, R: Pred{Name: "P", Args: []Term{Var{Name: "x"}}}},
				R: Pred{Name: "Q", Args: []Term{Var{Name: "x"}}}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, errors := ParseFormula(test.input, parserLanguage)
			if errors != nil {
				t.Fatalf("unexpected errors: %#v", errors)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("AST mismatch: want %#v, got %#v", test.want, got)
			}
		})
	}
}

func TestParseFormulaSyntaxErrors(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		code       string
		start, end int
		message    string
	}{
		{"empty", "", PARSE_EMPTY, 0, 0, "La fórmula está vacía."},
		{"unbalanced parenthesis", "(P(x)", PARSE_EXPECTED, 5, 5, `Columna 6: se esperaba ")" pero se encontró "fin de la entrada".`},
		{"trailing token", "P(x) Q(x)", PARSE_EXPECTED, 5, 6, `Columna 6: se esperaba "fin de la entrada" pero se encontró "Q".`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			formula, errors := ParseFormula(test.input, parserLanguage)
			if formula != nil || len(errors) != 1 {
				t.Fatalf("want nil formula and one error, got formula=%#v errors=%#v", formula, errors)
			}
			error := errors[0]
			if error.Code != test.code || error.Start != test.start || error.End != test.end || error.Message != test.message {
				t.Fatalf("error mismatch: want %#v, got %#v", test, error)
			}
		})
	}
}

func TestParseFormulaSymbolErrors(t *testing.T) {
	tests := []struct {
		name  string
		input string
		codes []string
	}{
		{"undeclared predicate", "S(x)", []string{UNDECLARED_SYMBOL}},
		{"function in atom", "f(x)", []string{WRONG_SYMBOL_KIND}},
		{"predicate arity", "P(x,c)", []string{ARITY_MISMATCH}},
		{"function arity", "P(f(x))", []string{ARITY_MISMATCH}},
		{"nonconstant function as variable", "P(f)", []string{ARITY_MISMATCH}},
		{"predicate as term", "P(P)", []string{WRONG_SYMBOL_KIND}},
		{"declared quantified variable", "forall P P(x)", []string{WRONG_SYMBOL_KIND}},
		{"multiple errors", "S(x) ∧ P(x,c) ∧ f(x)", []string{UNDECLARED_SYMBOL, ARITY_MISMATCH, WRONG_SYMBOL_KIND}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			formula, errors := ParseFormula(test.input, parserLanguage)
			if formula != nil {
				t.Fatalf("expected nil formula, got %#v", formula)
			}
			gotCodes := make([]string, 0, len(errors))
			for _, error := range errors {
				gotCodes = append(gotCodes, error.Code)
				if error.Start < 0 || error.End < error.Start {
					t.Errorf("invalid error position: %#v", error)
				}
			}
			if !reflect.DeepEqual(gotCodes, test.codes) {
				t.Fatalf("error codes mismatch: want %v, got %v", test.codes, gotCodes)
			}
		})
	}
}
