package logic

import (
	"fmt"
	"strings"
	"testing"
)

func benchmarkLanguage() Language {
	return Language{
		Funcs: map[string]int{"c": 0, "f": 1, "g": 2},
		Preds: map[string]int{"P": 1, "R": 2, "T": 3},
	}
}

func BenchmarkAnalyzeFormulaLength(b *testing.B) {
	lang := benchmarkLanguage()
	shortFormula := "∀x (P(x) → R(x, f(c)))"
	mediumFormula := "∀x ∃y ((P(x) ∧ R(x, y)) → (R(f(x), g(y, c)) ∨ ¬P(y)))"
	clauses := make([]string, 12)
	for i := range clauses {
		clauses[i] = fmt.Sprintf("(P(x%d) ∧ R(x%d, f(c)))", i, i)
	}
	longFormula := "∀x0 ∃x1 (" + strings.Join(clauses, " → ") + ")"

	cases := []struct {
		name  string
		input string
	}{
		{name: "corta", input: shortFormula},
		{name: "media", input: mediumFormula},
		{name: "larga", input: longFormula},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				res := AnalyzeFormula(tc.input, lang)
				if len(res.Errors) > 0 {
					b.Fatalf("unexpected errors: %v", res.Errors)
				}
			}
		})
	}
}

func buildDenseInterpretation(domainSize int) (Language, Interpretation) {
	lang := Language{
		Funcs: map[string]int{"f": 1},
		Preds: map[string]int{"P": 1, "R": 2, "T": 3},
	}
	domain := make([]string, domainSize)
	for i := range domain {
		domain[i] = fmt.Sprintf("d%d", i)
	}

	fEntries := make([]FuncEntry, domainSize)
	for i, d := range domain {
		fEntries[i] = FuncEntry{Args: []string{d}, Value: domain[(i+1)%domainSize]}
	}

	// P holds for all elements -> forall x P(x) checks entire domain.
	pTuples := make([][]string, domainSize)
	for i, d := range domain {
		pTuples[i] = []string{d}
	}

	// R holds for all pairs -> forall x forall y R(x,y) checks D^2.
	rTuples := make([][]string, 0, domainSize*domainSize)
	for _, a := range domain {
		for _, c := range domain {
			rTuples = append(rTuples, []string{a, c})
		}
	}

	// T holds for all triples (if domainSize^3 <= MaxTableEntries, else partial).
	var tTuples [][]string
	if domainSize*domainSize*domainSize <= MaxTableEntries {
		tTuples = make([][]string, 0, domainSize*domainSize*domainSize)
		for _, a := range domain {
			for _, c := range domain {
				for _, e := range domain {
					tTuples = append(tTuples, []string{a, c, e})
				}
			}
		}
	} else {
		tTuples = [][]string{{domain[0], domain[0], domain[0]}}
	}

	interp := Interpretation{
		Domain: domain,
		Funcs:  map[string][]FuncEntry{"f": fEntries},
		Rels:   map[string][][]string{"P": pTuples, "R": rTuples, "T": tTuples},
	}
	return lang, interp
}

func BenchmarkEvaluateQuantifiers(b *testing.B) {
	cases := []struct {
		name       string
		domainSize int
		formula    string
	}{
		{name: "1_cuantificador_D5", domainSize: 5, formula: "∀x P(x)"},
		{name: "1_cuantificador_D20", domainSize: 20, formula: "∀x P(x)"},
		{name: "2_cuantificadores_D5", domainSize: 5, formula: "∀x ∀y R(x, y)"},
		{name: "2_cuantificadores_D15", domainSize: 15, formula: "∀x ∀y R(x, y)"},
		{name: "3_cuantificadores_D5", domainSize: 5, formula: "∀x ∀y ∀z T(x, y, z)"},
		{name: "3_cuantificadores_D10", domainSize: 10, formula: "∀x ∀y ∀z T(x, y, z)"},
	}

	for _, tc := range cases {
		lang, interp := buildDenseInterpretation(tc.domainSize)
		req := EvaluateRequest{
			Language:       lang,
			Input:          tc.formula,
			Interpretation: interp,
			Env:            Env{},
		}
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				res := EvaluateFormula(req)
				if len(res.Errors) > 0 || res.Result == nil {
					b.Fatalf("evaluation failed: %v", res.Errors)
				}
			}
		})
	}
}

func BenchmarkExplanationConstruction(b *testing.B) {
	// Compare full universal explanation vs early witness vs truncated tree.
	lang, interp10 := buildDenseInterpretation(10)
	_, interp20 := buildDenseInterpretation(20)

	cases := []struct {
		name string
		req  EvaluateRequest
	}{
		{
			name: "testigo_temprano_D10",
			req: EvaluateRequest{
				Language:       lang,
				Input:          "∃x P(x)",
				Interpretation: interp10,
				Env:            Env{},
			},
		},
		{
			name: "comprobacion_completa_D10",
			req: EvaluateRequest{
				Language:       lang,
				Input:          "∀x ∀y R(x, y)",
				Interpretation: interp10,
				Env:            Env{},
			},
		},
		{
			name: "arbol_recortado_D20",
			req: EvaluateRequest{
				Language:       lang,
				Input:          "∀x ∀y ∀z (P(x) → R(y, z))",
				Interpretation: interp20,
				Env:            Env{},
			},
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				res := EvaluateFormula(tc.req)
				if len(res.Errors) > 0 || res.Result == nil {
					b.Fatalf("evaluation failed: %v", res.Errors)
				}
			}
		})
	}
}

func BenchmarkGenerateRandomInterpretation(b *testing.B) {
	lang := Language{
		Funcs: map[string]int{"c": 0, "f": 1, "g": 2},
		Preds: map[string]int{"P": 1, "R": 2},
	}
	for _, size := range []int{3, 10, 25} {
		b.Run(fmt.Sprintf("D%d", size), func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_, errs := GenerateRandomInterpretation(lang, size, 42)
				if len(errs) > 0 {
					b.Fatalf("unexpected errors: %v", errs)
				}
			}
		})
	}
}
