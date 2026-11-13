package logic

import (
	"strings"
	"testing"
)

func TestValidateInterpretationValidModel(t *testing.T) {
	language := Language{
		Funcs: map[string]int{"c": 0, "f": 1},
		Preds: map[string]int{"P": 1},
	}
	interpretation := Interpretation{
		Domain: []string{"0", "1"},
		Funcs: map[string][]FuncEntry{
			"c": {{Args: []string{}, Value: "0"}},
			"f": {{Args: []string{"0"}, Value: "1"}, {Args: []string{"1"}, Value: "0"}},
		},
		Rels: map[string][][]string{"P": {{"0"}}},
	}
	response := ValidateInterpretation(language, interpretation)
	if len(response.Errors) != 0 {
		t.Fatalf("unexpected errors: %#v", response.Errors)
	}
	if len(response.Warnings) != 0 {
		t.Fatalf("unexpected warnings: %#v", response.Warnings)
	}
}

func TestValidateInterpretationDomainErrorsIncludePaths(t *testing.T) {
	tests := []struct {
		name           string
		interpretation Interpretation
		code           string
		path           string
	}{
		{"empty", Interpretation{Funcs: emptyFuncs(), Rels: emptyRels()}, DOMAIN_EMPTY, "domain"},
		{"invalid element", Interpretation{Domain: []string{"ok", "bad-value"}, Funcs: emptyFuncs(), Rels: emptyRels()}, DOMAIN_INVALID_ELEMENT, "domain[1]"},
		{"duplicate element", Interpretation{Domain: []string{"same", "same"}, Funcs: emptyFuncs(), Rels: emptyRels()}, DOMAIN_DUPLICATE, "domain[1]"},
		{"too many elements", Interpretation{Domain: numberedDomain(MaxDomainSize + 1), Funcs: emptyFuncs(), Rels: emptyRels()}, LIMIT_EXCEEDED, "domain"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := ValidateInterpretation(emptyLanguage(), test.interpretation)
			assertErrorPath(t, response.Errors, test.code, test.path)
		})
	}
}

func TestValidateInterpretationFunctionErrorsIncludePaths(t *testing.T) {
	domain := []string{"a", "b"}
	tests := []struct {
		name           string
		language       Language
		interpretation Interpretation
		code           string
		path           string
	}{
		{
			name: "missing table", language: Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: emptyRels()}, code: FUNC_MISSING, path: "funcs.f",
		},
		{
			name: "undeclared table", language: emptyLanguage(),
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"g": {{Args: []string{"a"}, Value: "a"}}}, Rels: emptyRels()}, code: FUNC_UNKNOWN, path: "funcs.g",
		},
		{
			name: "empty table", language: Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"f": {}}, Rels: emptyRels()}, code: FUNC_EMPTY, path: "funcs.f",
		},
		{
			name: "wrong row arity", language: Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{"a"}, Value: "a"}, {Args: []string{"a", "b"}, Value: "a"}}}, Rels: emptyRels()}, code: FUNC_ARITY, path: "funcs.f[1].args",
		},
		{
			name: "argument outside domain", language: Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{"outside"}, Value: "a"}}}, Rels: emptyRels()}, code: FUNC_NOT_IN_DOMAIN, path: "funcs.f[0].args[0]",
		},
		{
			name: "result outside domain", language: Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{"a"}, Value: "outside"}, {Args: []string{"b"}, Value: "a"}}}, Rels: emptyRels()}, code: FUNC_NOT_IN_DOMAIN, path: "funcs.f[0].value",
		},
		{
			name: "duplicate arguments", language: Language{Funcs: map[string]int{"f": 0}, Preds: map[string]int{}},
			interpretation: Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{}, Value: "a"}, {Args: []string{}, Value: "b"}}}, Rels: emptyRels()}, code: FUNC_DUPLICATE, path: "funcs.f[1].args",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := ValidateInterpretation(test.language, test.interpretation)
			assertErrorPath(t, response.Errors, test.code, test.path)
		})
	}
}

func TestValidateInterpretationIncompleteFunctionReportsCountAndExamples(t *testing.T) {
	language := Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}}
	interpretation := Interpretation{
		Domain: []string{"a", "b", "c"},
		Funcs:  map[string][]FuncEntry{"f": {{Args: []string{"a"}, Value: "a"}}},
		Rels:   emptyRels(),
	}
	response := ValidateInterpretation(language, interpretation)
	logicError := findError(response.Errors, FUNC_INCOMPLETE)
	if logicError == nil {
		t.Fatalf("expected %s, got %#v", FUNC_INCOMPLETE, response.Errors)
	}
	if logicError.Path != "funcs.f" {
		t.Errorf("path: want funcs.f, got %q", logicError.Path)
	}
	for _, text := range []string{"faltan 2 de 3", `("b")`, `("c")`} {
		if !strings.Contains(logicError.Message, text) {
			t.Errorf("incomplete message %q does not contain %q", logicError.Message, text)
		}
	}
}

func TestValidateInterpretationRelationErrorsIncludePaths(t *testing.T) {
	domain := []string{"a", "b"}
	tests := []struct {
		name           string
		language       Language
		interpretation Interpretation
		code           string
		path           string
	}{
		{
			name: "missing relation", language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: emptyRels()}, code: REL_MISSING, path: "rels.P",
		},
		{
			name: "undeclared relation", language: emptyLanguage(),
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: map[string][][]string{"Q": {{"a"}}}}, code: REL_UNKNOWN, path: "rels.Q",
		},
		{
			name: "empty relation", language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: map[string][][]string{"P": {}}}, code: REL_EMPTY, path: "rels.P",
		},
		{
			name: "wrong tuple arity", language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: map[string][][]string{"P": {{"a", "b"}}}}, code: REL_ARITY, path: "rels.P[0]",
		},
		{
			name: "tuple element outside domain", language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
			interpretation: Interpretation{Domain: domain, Funcs: emptyFuncs(), Rels: map[string][][]string{"P": {{"outside"}}}}, code: REL_NOT_IN_DOMAIN, path: "rels.P[0][0]",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := ValidateInterpretation(test.language, test.interpretation)
			assertErrorPath(t, response.Errors, test.code, test.path)
		})
	}
}

func TestValidateInterpretationRelationDuplicateIsWarning(t *testing.T) {
	language := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}
	interpretation := Interpretation{Domain: []string{"a"}, Funcs: emptyFuncs(), Rels: map[string][][]string{"P": {{"a"}, {"a"}}}}
	response := ValidateInterpretation(language, interpretation)
	if len(response.Errors) != 0 {
		t.Fatalf("unexpected errors: %#v", response.Errors)
	}
	if len(response.Warnings) != 1 || response.Warnings[0].Kind != WarningDuplicateTuple || response.Warnings[0].Path != "rels.P[1]" {
		t.Fatalf("unexpected warnings: %#v", response.Warnings)
	}
}

func emptyLanguage() Language {
	return Language{Funcs: map[string]int{}, Preds: map[string]int{}}
}

func emptyFuncs() map[string][]FuncEntry { return map[string][]FuncEntry{} }

func emptyRels() map[string][][]string { return map[string][][]string{} }

func numberedDomain(size int) []string {
	domain := make([]string, size)
	for i := range domain {
		domain[i] = "d" + string(rune('a'+i%26)) + string(rune('A'+i/26))
	}
	return domain
}

func findError(errors []LogicError, code string) *LogicError {
	for i := range errors {
		if errors[i].Code == code {
			return &errors[i]
		}
	}
	return nil
}

func assertErrorPath(t *testing.T, errors []LogicError, code, path string) {
	t.Helper()
	logicError := findError(errors, code)
	if logicError == nil {
		t.Fatalf("expected %s, got %#v", code, errors)
	}
	if logicError.Path != path {
		t.Errorf("%s path: want %q, got %q", code, path, logicError.Path)
	}
}
