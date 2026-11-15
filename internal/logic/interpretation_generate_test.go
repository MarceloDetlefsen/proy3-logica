package logic

import (
	"reflect"
	"testing"
)

func TestGenerateRandomInterpretationIsValidAndReproducible(t *testing.T) {
	language := Language{
		Funcs: map[string]int{"c": 0, "f": 1, "g": 2},
		Preds: map[string]int{"P": 1, "R": 2},
	}
	first, firstErrors := GenerateRandomInterpretation(language, 3, 42)
	second, secondErrors := GenerateRandomInterpretation(language, 3, 42)
	if len(firstErrors) != 0 || len(secondErrors) != 0 {
		t.Fatalf("unexpected generation errors: first=%#v second=%#v", firstErrors, secondErrors)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("same seed generated different interpretations:\n%#v\n%#v", first, second)
	}
	if len(first.Domain) != 3 {
		t.Fatalf("domain size: want 3, got %d", len(first.Domain))
	}
	if got := len(first.Funcs["c"]); got != 1 || len(first.Funcs["c"][0].Args) != 0 {
		t.Fatalf("constant table should have one zero-argument entry: %#v", first.Funcs["c"])
	}
	if got := len(first.Funcs["f"]); got != 3 {
		t.Fatalf("unary function should have 3 entries, got %d", got)
	}
	if got := len(first.Funcs["g"]); got != 9 {
		t.Fatalf("binary function should have 9 entries, got %d", got)
	}
	if len(first.Rels["P"]) == 0 || len(first.Rels["R"]) == 0 {
		t.Fatalf("generated relation must be non-empty: %#v", first.Rels)
	}
	validation := ValidateInterpretation(language, first)
	if len(validation.Errors) != 0 {
		t.Fatalf("generated interpretation is invalid: %#v", validation.Errors)
	}
}

func TestGenerateRandomInterpretationReportsLimitsAndInvalidLanguage(t *testing.T) {
	tests := []struct {
		name     string
		language Language
		size     int
		code     string
	}{
		{"zero domain", emptyLanguage(), 0, DOMAIN_SIZE_INVALID},
		{"domain above maximum", emptyLanguage(), MaxDomainSize + 1, LIMIT_EXCEEDED},
		{"function table exceeds cap", Language{Funcs: map[string]int{"f": 5}, Preds: map[string]int{}}, 10, LIMIT_EXCEEDED},
		{"invalid function arity", Language{Funcs: map[string]int{"f": -1}, Preds: map[string]int{}}, 3, INVALID_ARITY},
		{"invalid predicate arity", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 0}}, 3, INVALID_ARITY},
		{"reserved symbol", Language{Funcs: map[string]int{"forall": 0}, Preds: map[string]int{}}, 3, RESERVED_NAME},
		{"arity too large to generate", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": MaxGeneratedArity + 1}}, 1, LIMIT_EXCEEDED},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, errors := GenerateRandomInterpretation(test.language, test.size, 12)
			if !responseHasCode(errors, test.code) {
				t.Fatalf("expected %s, got %#v", test.code, errors)
			}
		})
	}
}

func TestGenerateRandomInterpretationCanGenerateUnaryTableAtLimit(t *testing.T) {
	language := Language{Funcs: map[string]int{"f": 2}, Preds: map[string]int{}}
	interpretation, errors := GenerateRandomInterpretation(language, 100, 7)
	if len(errors) != 0 {
		t.Fatalf("unexpected errors: %#v", errors)
	}
	if got := len(interpretation.Funcs["f"]); got != MaxTableEntries {
		t.Fatalf("table entries: want %d, got %d", MaxTableEntries, got)
	}
}
