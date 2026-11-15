package main

import (
	"testing"

	"proy3-logica/internal/logic"
)

func BenchmarkEvaluationTeX(b *testing.B) {
	req := logic.EvaluateRequest{
		Language: logic.Language{
			Funcs: map[string]int{"c": 0, "f": 1},
			Preds: map[string]int{"P": 1, "R": 2},
		},
		Input: "∀x (P(x) → ∃y R(x, f(y)))",
		Interpretation: logic.Interpretation{
			Domain: []string{"d0", "d1", "d2", "d3"},
			Funcs: map[string][]logic.FuncEntry{
				"c": {{Args: []string{}, Value: "d0"}},
				"f": {
					{Args: []string{"d0"}, Value: "d1"},
					{Args: []string{"d1"}, Value: "d2"},
					{Args: []string{"d2"}, Value: "d3"},
					{Args: []string{"d3"}, Value: "d0"},
				},
			},
			Rels: map[string][][]string{
				"P": {{"d0"}, {"d1"}, {"d2"}, {"d3"}},
				"R": {{"d0", "d1"}, {"d1", "d2"}, {"d2", "d3"}, {"d3", "d0"}},
			},
		},
		Env: logic.Env{},
	}
	res := logic.EvaluateFormula(req)
	if len(res.Errors) > 0 || res.Result == nil {
		b.Fatalf("evaluate failed: %v", res.Errors)
	}

	b.ReportAllocs()
	for b.Loop() {
		tex := evaluationTeX(req, *res.Result, res.Warnings)
		if len(tex) == 0 {
			b.Fatal("empty tex output")
		}
	}
}
