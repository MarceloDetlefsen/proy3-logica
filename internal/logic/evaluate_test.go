package logic

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestEvaluateSharedExamples(t *testing.T) {
	_, sourceFile, _, _ := runtime.Caller(0)
	pattern := filepath.Join(filepath.Dir(sourceFile), "..", "..", "testdata", "examples", "*.json")
	paths, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) == 0 {
		t.Fatal("no shared examples found")
	}
	for _, path := range paths {
		t.Run(strings.TrimSuffix(filepath.Base(path), ".json"), func(t *testing.T) {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			var example evaluatorExample
			if err := json.Unmarshal(data, &example); err != nil {
				t.Fatal(err)
			}
			response := EvaluateFormula(EvaluateRequest{
				Language: example.Language, Input: example.Input,
				Interpretation: example.Interpretation, Env: example.Env,
			})
			gotCodes := make(map[string]bool, len(response.Errors))
			for _, logicError := range response.Errors {
				gotCodes[logicError.Code] = true
			}
			for _, code := range example.Expect.ErrorCodes {
				if !gotCodes[code] {
					t.Errorf("expected error %s; got %#v", code, response.Errors)
				}
			}
			if len(example.Expect.ErrorCodes) > 0 {
				if response.Result != nil {
					t.Fatal("invalid example unexpectedly produced a result")
				}
				return
			}
			if len(response.Errors) != 0 {
				t.Fatalf("unexpected errors: %#v", response.Errors)
			}
			if response.Result == nil {
				t.Fatal("valid example has no result")
			}
			if example.Expect.Value == nil || response.Result.Value != *example.Expect.Value {
				t.Fatalf("value: want %v, got %t", example.Expect.Value, response.Result.Value)
			}
			if example.Expect.Witness != nil && !explanationHasBinding(response.Result.Explanation, "witness", *example.Expect.Witness) {
				t.Errorf("expected witness %#v in explanation", *example.Expect.Witness)
			}
			if example.Expect.Counterexample != nil && !explanationHasBinding(response.Result.Explanation, "counterexample", *example.Expect.Counterexample) {
				t.Errorf("expected counterexample %#v in explanation", *example.Expect.Counterexample)
			}
			if err := checkExplanation(response.Result.Explanation, example.Interpretation); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestInterpretationAndEvaluationErrorCodes(t *testing.T) {
	baseLanguage := Language{Funcs: map[string]int{}, Preds: map[string]int{}}
	base := Interpretation{Domain: []string{"a", "b"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}
	tests := []struct {
		name   string
		lang   Language
		interp Interpretation
		code   string
	}{
		{"domain empty", baseLanguage, Interpretation{Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}, DOMAIN_EMPTY},
		{"invalid domain element", baseLanguage, Interpretation{Domain: []string{"bad-value"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}, DOMAIN_INVALID_ELEMENT},
		{"duplicate domain element", baseLanguage, Interpretation{Domain: []string{"a", "a"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{}}, DOMAIN_DUPLICATE},
		{"missing function table", Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}}, base, FUNC_MISSING},
		{"unknown function table", baseLanguage, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{"a"}, Value: "a"}}}, Rels: base.Rels}, FUNC_UNKNOWN},
		{"empty function table", Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}}, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {}}, Rels: base.Rels}, FUNC_EMPTY},
		{"function arity", Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}}, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{}, Value: "a"}}}, Rels: base.Rels}, FUNC_ARITY},
		{"function element outside domain", Language{Funcs: map[string]int{"f": 0}, Preds: map[string]int{}}, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{}, Value: "outside"}}}, Rels: base.Rels}, FUNC_NOT_IN_DOMAIN},
		{"duplicate function arguments", Language{Funcs: map[string]int{"f": 0}, Preds: map[string]int{}}, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{}, Value: "a"}, {Args: []string{}, Value: "b"}}}, Rels: base.Rels}, FUNC_DUPLICATE},
		{"incomplete function", Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{}}, Interpretation{Domain: base.Domain, Funcs: map[string][]FuncEntry{"f": {{Args: []string{"a"}, Value: "a"}}}, Rels: base.Rels}, FUNC_INCOMPLETE},
		{"missing relation", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, base, REL_MISSING},
		{"unknown relation", baseLanguage, Interpretation{Domain: base.Domain, Funcs: base.Funcs, Rels: map[string][][]string{"P": {{"a"}}}}, REL_UNKNOWN},
		{"empty relation", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, Interpretation{Domain: base.Domain, Funcs: base.Funcs, Rels: map[string][][]string{"P": {}}}, REL_EMPTY},
		{"relation arity", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, Interpretation{Domain: base.Domain, Funcs: base.Funcs, Rels: map[string][][]string{"P": {{"a", "b"}}}}, REL_ARITY},
		{"relation element outside domain", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, Interpretation{Domain: base.Domain, Funcs: base.Funcs, Rels: map[string][][]string{"P": {{"outside"}}}}, REL_NOT_IN_DOMAIN},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := ValidateInterpretation(test.lang, test.interp)
			if !responseHasCode(response.Errors, test.code) {
				t.Fatalf("expected %s, got %#v", test.code, response.Errors)
			}
			for _, logicError := range response.Errors {
				if logicError.Path == "" {
					t.Errorf("validation error %s has no path", logicError.Code)
				}
			}
		})
	}

	t.Run("domain size limit", func(t *testing.T) {
		values := make([]string, MaxDomainSize+1)
		for i := range values {
			values[i] = "d" + string(rune('a'+i%26)) + string(rune('A'+i/26))
		}
		response := ValidateInterpretation(baseLanguage, Interpretation{Domain: values, Funcs: base.Funcs, Rels: base.Rels})
		if !responseHasCode(response.Errors, LIMIT_EXCEEDED) {
			t.Fatalf("expected %s, got %#v", LIMIT_EXCEEDED, response.Errors)
		}
	})
	t.Run("table size limit", func(t *testing.T) {
		tuples := make([][]string, MaxTableEntries+1)
		for i := range tuples {
			tuples[i] = []string{"a"}
		}
		language := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}
		response := ValidateInterpretation(language, Interpretation{Domain: []string{"a"}, Funcs: base.Funcs, Rels: map[string][][]string{"P": tuples}})
		if !responseHasCode(response.Errors, LIMIT_EXCEEDED) {
			t.Fatalf("expected %s, got %#v", LIMIT_EXCEEDED, response.Errors)
		}
	})
	t.Run("environment missing", func(t *testing.T) {
		response := EvaluateFormula(EvaluateRequest{Language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, Input: "P(x)", Interpretation: Interpretation{Domain: []string{"a"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{"P": {{"a"}}}}, Env: Env{}})
		if !responseHasCode(response.Errors, ENV_MISSING) {
			t.Fatalf("expected %s, got %#v", ENV_MISSING, response.Errors)
		}
	})
	t.Run("environment outside domain", func(t *testing.T) {
		response := EvaluateFormula(EvaluateRequest{Language: Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}, Input: "P(x)", Interpretation: Interpretation{Domain: []string{"a"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{"P": {{"a"}}}}, Env: Env{"x": "b"}})
		if !responseHasCode(response.Errors, ENV_NOT_IN_DOMAIN) {
			t.Fatalf("expected %s, got %#v", ENV_NOT_IN_DOMAIN, response.Errors)
		}
	})
	t.Run("evaluation step limit", func(t *testing.T) {
		formula := "P(x)"
		for i := 0; i < 17; i++ {
			formula = "forall x " + formula
		}
		language := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}
		interp := Interpretation{Domain: []string{"a", "b"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{"P": {{"a"}, {"b"}}}}
		response := EvaluateFormula(EvaluateRequest{Language: language, Input: formula, Interpretation: interp, Env: Env{}})
		if !responseHasCode(response.Errors, EVAL_LIMIT) {
			t.Fatalf("expected %s, got %#v", EVAL_LIMIT, response.Errors)
		}
		if response.Result != nil {
			t.Fatal("evaluation limit response must not contain a result")
		}
	})
	t.Run("unknown predicate in formula", func(t *testing.T) {
		analysis := AnalyzeFormula("Q(x)", Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}})
		if !responseHasCode(analysis.Errors, UNDECLARED_SYMBOL) {
			t.Fatalf("got %#v", analysis.Errors)
		}
	})
}

func TestRandomModelsPreserveLogicalEquivalences(t *testing.T) {
	rng := rand.New(rand.NewSource(731942))
	for iteration := 0; iteration < 80; iteration++ {
		size := 1 + rng.Intn(5)
		domain := make([]string, size)
		for i := range domain {
			domain[i] = "d" + string(rune('a'+i))
		}
		pTuples, qTuples := randomNonEmptyUnaryRelation(rng, domain), randomNonEmptyUnaryRelation(rng, domain)
		language := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1, "Q": 1}}
		interpretation := Interpretation{Domain: domain, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{"P": pTuples, "Q": qTuples}}
		t.Run(strings.Join([]string{"model", string(rune('A' + iteration))}, "-"), func(t *testing.T) {
			pairs := [][2]string{
				{"forall x !(P(x) & Q(x))", "forall x (!P(x) | !Q(x))"},
				{"P(x) -> Q(x)", "!P(x) | Q(x)"},
				{"!!P(x)", "P(x)"},
			}
			for _, pair := range pairs {
				var env Env
				if strings.Contains(pair[0], "P(x)") && !strings.Contains(pair[0], "forall") {
					env = Env{"x": domain[rng.Intn(len(domain))]}
				} else {
					env = Env{}
				}
				left := EvaluateFormula(EvaluateRequest{Language: language, Input: pair[0], Interpretation: interpretation, Env: env})
				right := EvaluateFormula(EvaluateRequest{Language: language, Input: pair[1], Interpretation: interpretation, Env: env})
				if len(left.Errors) != 0 || len(right.Errors) != 0 {
					t.Fatalf("unexpected errors: left=%#v right=%#v", left.Errors, right.Errors)
				}
				if left.Result.Value != right.Result.Value {
					t.Errorf("equivalence failed for %q and %q: %t != %t", pair[0], pair[1], left.Result.Value, right.Result.Value)
				}
				if err := checkExplanation(left.Result.Explanation, interpretation); err != nil {
					t.Errorf("left explanation: %v", err)
				}
				if err := checkExplanation(right.Result.Explanation, interpretation); err != nil {
					t.Errorf("right explanation: %v", err)
				}
			}
		})
	}
}

func TestEvaluationExplanationTruncatesAndQuantifiersShadow(t *testing.T) {
	language := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}
	interpretation := Interpretation{Domain: []string{"a", "b"}, Funcs: map[string][]FuncEntry{}, Rels: map[string][][]string{"P": {{"a"}, {"b"}}}}
	formula := "forall x P(x)"
	for i := 0; i < 12; i++ {
		formula = "forall x (" + formula + ")"
	}
	response := EvaluateFormula(EvaluateRequest{Language: language, Input: formula, Interpretation: interpretation, Env: Env{"x": "a"}})
	if len(response.Errors) != 0 {
		t.Fatalf("unexpected errors: %#v", response.Errors)
	}
	if response.Result == nil || !response.Result.Value {
		t.Fatal("expected a true result")
	}
	if !explanationTruncated(response.Result.Explanation) {
		t.Fatal("expected explanation to be marked truncated")
	}
	shadowed := EvaluateFormula(EvaluateRequest{Language: language, Input: "forall x P(x)", Interpretation: interpretation, Env: Env{"x": "a"}})
	if len(shadowed.Errors) != 0 || shadowed.Result == nil {
		t.Fatalf("unexpected shadowing evaluation response: %#v", shadowed)
	}
	if len(shadowed.Result.Explanation.Env) != 0 {
		t.Fatalf("bound x leaked into root environment: %#v", shadowed.Result.Explanation.Env)
	}
	if !explanationHasEnvValue(shadowed.Result.Explanation, "x", "a") && !explanationHasEnvValue(shadowed.Result.Explanation, "x", "b") {
		t.Fatalf("quantifier did not bind x in its body environment: %#v", shadowed.Result.Explanation)
	}
}

func randomNonEmptyUnaryRelation(rng *rand.Rand, domain []string) [][]string {
	tuples := make([][]string, 0, len(domain))
	for _, value := range domain {
		if rng.Intn(2) == 1 {
			tuples = append(tuples, []string{value})
		}
	}
	if len(tuples) == 0 {
		tuples = append(tuples, []string{domain[rng.Intn(len(domain))]})
	}
	return tuples
}

func responseHasCode(errors []LogicError, code string) bool {
	for _, logicError := range errors {
		if logicError.Code == code {
			return true
		}
	}
	return false
}

func explanationHasBinding(explanation Explanation, field string, want ExplanationBinding) bool {
	if field == "witness" && explanation.Witness != nil && *explanation.Witness == want {
		return true
	}
	if field == "counterexample" && explanation.Counterexample != nil && *explanation.Counterexample == want {
		return true
	}
	for _, child := range explanation.Children {
		if explanationHasBinding(child, field, want) {
			return true
		}
	}
	return false
}

func explanationTruncated(explanation Explanation) bool {
	if explanation.Truncated {
		return true
	}
	for _, child := range explanation.Children {
		if explanationTruncated(child) {
			return true
		}
	}
	return false
}

func checkExplanation(explanation Explanation, interpretation Interpretation) error {
	childValues := make([]bool, len(explanation.Children))
	for i, child := range explanation.Children {
		if err := checkExplanation(child, interpretation); err != nil {
			return err
		}
		childValues[i] = child.Holds
	}
	switch explanation.Rule {
	case "pred":
		args := make([]string, len(explanation.Terms))
		for i, term := range explanation.Terms {
			args[i] = term.Value
		}
		name := explanation.Formula
		if open := strings.IndexByte(name, '('); open >= 0 {
			name = name[:open]
		}
		want := false
		for _, tuple := range interpretation.Rels[name] {
			if tupleKey(tuple) == tupleKey(args) {
				want = true
				break
			}
		}
		if explanation.Holds != want {
			return fmt.Errorf("predicate node %s holds=%t, relation membership=%t", explanation.Formula, explanation.Holds, want)
		}
	case "not":
		if len(childValues) != 1 || explanation.Holds != !childValues[0] {
			return fmt.Errorf("invalid not explanation for %s", explanation.Formula)
		}
	case "and":
		want := len(childValues) > 0 && childValues[0]
		if len(childValues) == 2 {
			want = childValues[0] && childValues[1]
		}
		if explanation.Holds != want {
			return fmt.Errorf("invalid and explanation for %s", explanation.Formula)
		}
	case "or":
		want := len(childValues) > 0 && childValues[0]
		if len(childValues) == 2 {
			want = childValues[0] || childValues[1]
		}
		if explanation.Holds != want {
			return fmt.Errorf("invalid or explanation for %s", explanation.Formula)
		}
	case "imp":
		want := len(childValues) > 0 && !childValues[0]
		if len(childValues) == 2 {
			want = !childValues[0] || childValues[1]
		}
		if explanation.Holds != want {
			return fmt.Errorf("invalid implication explanation for %s", explanation.Formula)
		}
	case "iff":
		if len(childValues) != 2 || explanation.Holds != (childValues[0] == childValues[1]) {
			return fmt.Errorf("invalid iff explanation for %s", explanation.Formula)
		}
	case "forall", "exists":
		if explanation.Checked == nil {
			return fmt.Errorf("quantifier %s has no checked count", explanation.Formula)
		}
		if !explanation.Truncated && *explanation.Checked != len(childValues) {
			return fmt.Errorf("quantifier %s checked %d but has %d children", explanation.Formula, *explanation.Checked, len(childValues))
		}
		want := explanation.Rule == "forall"
		if explanation.Rule == "exists" {
			want = false
		}
		for _, value := range childValues {
			if explanation.Rule == "forall" {
				want = want && value
			} else {
				want = want || value
			}
		}
		if explanation.Holds != want {
			return fmt.Errorf("invalid %s explanation for %s", explanation.Rule, explanation.Formula)
		}
	default:
		return fmt.Errorf("unknown explanation rule %q", explanation.Rule)
	}
	return nil
}

func explanationHasEnvValue(explanation Explanation, variable, value string) bool {
	if explanation.Env[variable] == value {
		return true
	}
	for _, child := range explanation.Children {
		if explanationHasEnvValue(child, variable, value) {
			return true
		}
	}
	return false
}
