package logic

import "testing"

func BenchmarkSearchModels(b *testing.B) {
	cases := []struct {
		name string
		req  ModelSearchRequest
	}{
		{
			name: "satisfacible_y_falsable_N2",
			req: ModelSearchRequest{
				Language:      Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
				Input:         "∀x P(x)",
				MaxDomainSize: 2,
			},
		},
		{
			name: "sin_modelos_barbero_N2",
			req: ModelSearchRequest{
				Language:      Language{Funcs: map[string]int{}, Preds: map[string]int{"Afeita": 2}},
				Input:         "∃b ∀x (Afeita(b, x) ↔ ¬Afeita(x, x))",
				MaxDomainSize: 2,
			},
		},
		{
			name: "tautologia_abierta_N2",
			req: ModelSearchRequest{
				Language:      Language{Funcs: map[string]int{}, Preds: map[string]int{"P": 1}},
				Input:         "P(x) ∨ ¬P(x)",
				MaxDomainSize: 2,
			},
		},
		{
			name: "limite_presupuesto_N3",
			req: ModelSearchRequest{
				Language:      Language{Funcs: map[string]int{"f": 1}, Preds: map[string]int{"R": 2}},
				Input:         "∀x ∀y (R(x, y) ∨ ¬R(x, y))",
				MaxDomainSize: 3,
			},
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				res := SearchModels(tc.req)
				if len(res.Errors) > 0 {
					b.Fatalf("unexpected errors: %v", res.Errors)
				}
			}
		})
	}
}
