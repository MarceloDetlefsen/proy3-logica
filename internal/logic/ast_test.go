package logic

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestTermJSONRoundTrip(t *testing.T) {
	want := App{
		Fn: "f",
		Args: []Term{
			Var{Name: "x"},
			App{Fn: "c", Args: nil},
		},
	}

	data, err := json.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := UnmarshalTerm(data)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("round-trip mismatch: want %#v, got %#v", want, got)
	}
}

func TestFormulaJSONRoundTrip(t *testing.T) {
	want := Quant{
		Q: Forall,
		V: "x",
		F: Bin{
			Op: Imp,
			L:  Pred{Name: "P", Args: []Term{Var{Name: "x"}}},
			R:  Not{F: Pred{Name: "Q", Args: []Term{App{Fn: "f", Args: []Term{Var{Name: "x"}}}}}},
		},
	}

	data, err := json.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := UnmarshalFormula(data)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("round-trip mismatch: want %#v, got %#v", want, got)
	}
}
