package logic

import (
	"reflect"
	"testing"
)

func TestValidateLanguage(t *testing.T) {
	tests := []struct {
		name         string
		funcs        []SymbolDecl
		preds        []SymbolDecl
		wantLanguage Language
		wantCodes    []string
	}{
		{
			name: "válido con constante",
			funcs: []SymbolDecl{
				{Name: "c", Arity: 0},
				{Name: "f2", Arity: 2},
			},
			preds: []SymbolDecl{{Name: "P", Arity: 1}},
			wantLanguage: Language{
				Funcs: map[string]int{"c": 0, "f2": 2},
				Preds: map[string]int{"P": 1},
			},
		},
		{
			name:      "duplicado entre función y predicado",
			funcs:     []SymbolDecl{{Name: "S", Arity: 1}},
			preds:     []SymbolDecl{{Name: "S", Arity: 1}},
			wantCodes: []string{DUPLICATE_SYMBOL},
		},
		{
			name: "nombres inválidos",
			funcs: []SymbolDecl{
				{Name: "", Arity: 0},
				{Name: "9f", Arity: 1},
				{Name: "f-g", Arity: 1},
				{Name: "á", Arity: 1},
			},
			wantCodes: []string{INVALID_NAME, INVALID_NAME, INVALID_NAME, INVALID_NAME},
		},
		{
			name:      "palabras reservadas sin distinguir mayúsculas",
			funcs:     []SymbolDecl{{Name: "forall", Arity: 0}},
			preds:     []SymbolDecl{{Name: "EXISTS", Arity: 1}},
			wantCodes: []string{RESERVED_NAME, RESERVED_NAME},
		},
		{
			name:      "aridades inválidas",
			funcs:     []SymbolDecl{{Name: "f", Arity: -1}},
			preds:     []SymbolDecl{{Name: "P", Arity: 0}},
			wantCodes: []string{INVALID_ARITY, INVALID_ARITY},
		},
		{
			name: "acumula múltiples errores",
			funcs: []SymbolDecl{
				{Name: "forall", Arity: -1},
			},
			preds: []SymbolDecl{
				{Name: "forall", Arity: 0},
				{Name: "bad-name", Arity: 0},
			},
			wantCodes: []string{
				RESERVED_NAME,
				INVALID_ARITY,
				RESERVED_NAME,
				DUPLICATE_SYMBOL,
				INVALID_ARITY,
				INVALID_NAME,
				INVALID_ARITY,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotLanguage, gotErrors := ValidateLanguage(test.funcs, test.preds)
			if !reflect.DeepEqual(gotLanguage, test.wantLanguage) {
				t.Fatalf("language mismatch: want %#v, got %#v", test.wantLanguage, gotLanguage)
			}

			var gotCodes []string
			if gotErrors != nil {
				gotCodes = make([]string, 0, len(gotErrors))
			}
			for _, err := range gotErrors {
				gotCodes = append(gotCodes, err.Code)
				if err.Start != 0 || err.End != 0 {
					t.Errorf("declaration error has unexpected position: %#v", err)
				}
			}
			if !reflect.DeepEqual(gotCodes, test.wantCodes) {
				t.Errorf("error codes mismatch: want %v, got %v", test.wantCodes, gotCodes)
			}
			if len(test.wantCodes) == 0 && gotErrors != nil {
				t.Errorf("expected nil errors, got %#v", gotErrors)
			}
		})
	}
}
