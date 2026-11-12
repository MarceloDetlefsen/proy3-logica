package logic

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

var analysisLanguage = Language{
	Funcs: map[string]int{"c": 0, "f": 1},
	Preds: map[string]int{"P": 1, "Q": 1, "R": 2},
}

func TestAnalyzeFormulaIntegration(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		freeVars []string
	}{
		{name: "closed constant", input: "P(c)", freeVars: []string{}},
		{name: "open variable", input: "P(x)", freeVars: []string{"x"}},
		{name: "closed quantified", input: "forall x P(x)", freeVars: []string{}},
		{name: "nested function", input: "P(f(x))", freeVars: []string{"x"}},
		{name: "free variables preserve order", input: "R(x,f(y))", freeVars: []string{"x", "y"}},
		{name: "bound and free variables", input: "exists x (P(x) & Q(y))", freeVars: []string{"y"}},
		{name: "closed negated function", input: "~P(f(c))", freeVars: []string{}},
		{name: "nested quantifiers", input: "forall x exists y R(x,y)", freeVars: []string{}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			analysis := AnalyzeFormula(test.input, analysisLanguage)
			if analysis.Formula == nil || len(analysis.Errors) != 0 {
				t.Fatalf("unexpected analysis errors: %#v", analysis)
			}
			if !reflect.DeepEqual(analysis.FreeVars, test.freeVars) {
				t.Fatalf("free variables mismatch: want %v, got %v", test.freeVars, analysis.FreeVars)
			}
			if analysis.Warnings == nil || analysis.Errors == nil {
				t.Fatal("analysis slices must be non-nil")
			}
			assertJSONHasNoNullSlices(t, analysis, true)
		})
	}
}

func TestAnalyzeFormulaInvalidInputs(t *testing.T) {
	tests := []struct {
		name  string
		input string
		code  string
	}{
		{name: "empty", input: "", code: PARSE_EMPTY},
		{name: "undeclared predicate", input: "S(x)", code: UNDECLARED_SYMBOL},
		{name: "wrong predicate arity", input: "P(c,c)", code: ARITY_MISMATCH},
		{name: "syntax error", input: "P(", code: PARSE_EXPECTED},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			analysis := AnalyzeFormula(test.input, analysisLanguage)
			if analysis.Formula != nil || len(analysis.FreeVars) != 0 {
				t.Fatalf("invalid analysis should not contain formula/free vars: %#v", analysis)
			}
			if len(analysis.Errors) == 0 || analysis.Errors[0].Code != test.code {
				t.Fatalf("expected first error %q, got %#v", test.code, analysis.Errors)
			}
			if analysis.FreeVars == nil || analysis.Warnings == nil || analysis.Errors == nil {
				t.Fatal("analysis slices must be non-nil")
			}
			assertJSONHasNoNullSlices(t, analysis, false)
		})
	}
}

func assertJSONHasNoNullSlices(t *testing.T, analysis Analysis, valid bool) {
	t.Helper()
	data, err := json.Marshal(analysis)
	if err != nil {
		t.Fatal(err)
	}
	jsonText := string(data)
	for _, field := range []string{"freeVars", "warnings", "errors"} {
		if strings.Contains(jsonText, `"`+field+`":null`) {
			t.Fatalf("JSON contains null slice for %s: %s", field, jsonText)
		}
	}
	if valid && !strings.Contains(jsonText, `"formula":{"k":`) {
		t.Fatalf("valid JSON does not contain serialized formula: %s", jsonText)
	}
	if !valid && strings.Contains(jsonText, `"formula"`) {
		t.Fatalf("invalid JSON should omit formula: %s", jsonText)
	}
}
