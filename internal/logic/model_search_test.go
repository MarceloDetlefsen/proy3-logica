package logic

import "testing"

func TestSearchModelsFindsModelAndCountermodel(t *testing.T) {
	lang := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}
	res := SearchModels(ModelSearchRequest{
		Language:      lang,
		Input:         "∀x P(x)",
		MaxDomainSize: 2,
	})
	if len(res.Errors) != 0 {
		t.Fatalf("unexpected errors: %v", res.Errors)
	}
	if !res.Complete || res.LimitReached {
		t.Fatalf("expected complete search within budget, got complete=%v limit=%v", res.Complete, res.LimitReached)
	}
	if res.Satisfying == nil {
		t.Fatal("expected a satisfying model for ∀x P(x)")
	}
	if res.Falsifying == nil {
		t.Fatal("expected a falsifying countermodel for ∀x P(x)")
	}

	satEval := EvaluateFormula(EvaluateRequest{
		Language:       lang,
		Input:          "∀x P(x)",
		Interpretation: res.Satisfying.Interpretation,
		Env:            res.Satisfying.Env,
	})
	if len(satEval.Errors) != 0 || satEval.Result == nil || !satEval.Result.Value {
		t.Fatalf("satisfying model failed verification: %#v", satEval)
	}

	falEval := EvaluateFormula(EvaluateRequest{
		Language:       lang,
		Input:          "∀x P(x)",
		Interpretation: res.Falsifying.Interpretation,
		Env:            res.Falsifying.Env,
	})
	if len(falEval.Errors) != 0 || falEval.Result == nil || falEval.Result.Value {
		t.Fatalf("falsifying countermodel failed verification: %#v", falEval)
	}
}

func TestSearchModelsOpenFormulaAndTautology(t *testing.T) {
	lang := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}

	// Open formula P(x) has a satisfying env and a falsifying env on D={d0,d1}.
	openRes := SearchModels(ModelSearchRequest{
		Language:      lang,
		Input:         "P(x)",
		MaxDomainSize: 2,
	})
	if len(openRes.Errors) != 0 || openRes.Satisfying == nil || openRes.Falsifying == nil {
		t.Fatalf("expected both model and countermodel for P(x), got %#v", openRes)
	}
	if openRes.Satisfying.Env["x"] == "" || openRes.Falsifying.Env["x"] == "" {
		t.Fatalf("expected env assignment for free variable x: sat=%#v fal=%#v", openRes.Satisfying.Env, openRes.Falsifying.Env)
	}

	// Tautology P(x) ∨ ¬P(x) has no falsifying countermodel.
	tautRes := SearchModels(ModelSearchRequest{
		Language:      lang,
		Input:         "P(x) ∨ ¬P(x)",
		MaxDomainSize: 2,
	})
	if len(tautRes.Errors) != 0 || !tautRes.Complete {
		t.Fatalf("expected complete search for tautology, got %#v", tautRes)
	}
	if tautRes.Satisfying == nil || tautRes.Falsifying != nil {
		t.Fatalf("expected satisfying != nil and falsifying == nil, got sat=%v fal=%v", tautRes.Satisfying, tautRes.Falsifying)
	}
}

func TestSearchModelsValidationAndLimits(t *testing.T) {
	lang := Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}}

	for _, invalidN := range []int{0, 101} {
		res := SearchModels(ModelSearchRequest{Language: lang, Input: "∀x P(x)", MaxDomainSize: invalidN})
		if len(res.Errors) == 0 || res.Errors[0].Code != DOMAIN_SIZE_INVALID {
			t.Fatalf("N=%d: expected DOMAIN_SIZE_INVALID, got %#v", invalidN, res.Errors)
		}
	}

	// Tautology over binary predicate + unary function exceeds MaxSearchedInterpretations before N=3 finishes.
	heavy := Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{"R": 2}}
	res := SearchModels(ModelSearchRequest{
		Language:      heavy,
		Input:         "∀x ∀y (R(x, y) ∨ ¬R(x, y))",
		MaxDomainSize: 3,
	})
	if len(res.Errors) != 0 {
		t.Fatalf("unexpected errors: %v", res.Errors)
	}
	if res.Complete || !res.LimitReached {
		t.Fatalf("expected search to hit budget limit, got complete=%v limit=%v", res.Complete, res.LimitReached)
	}
}
