package logic

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type Term interface{ isTerm() }

type Var struct{ Name string }
type App struct {
	Fn   string
	Args []Term
}

func (Var) isTerm() {}
func (App) isTerm() {}

type Formula interface{ isFormula() }

type Pred struct {
	Name string
	Args []Term
}
type Not struct{ F Formula }
type Bin struct {
	Op   BinOp
	L, R Formula
}
type Quant struct {
	Q QuantKind
	V string
	F Formula
}

func (Pred) isFormula()  {}
func (Not) isFormula()   {}
func (Bin) isFormula()   {}
func (Quant) isFormula() {}

type BinOp string

const (
	And BinOp = "and"
	Or  BinOp = "or"
	Imp BinOp = "imp"
	Iff BinOp = "iff"
)

type QuantKind string

const (
	Forall QuantKind = "forall"
	Exists QuantKind = "exists"
)

func (v Var) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K    string `json:"k"`
		Name string `json:"name"`
	}{"var", v.Name})
}

func (v *Var) UnmarshalJSON(data []byte) error {
	var wire struct {
		K    string `json:"k"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "var" {
		return fmt.Errorf("logic: expected term kind var, got %q", wire.K)
	}
	v.Name = wire.Name
	return nil
}

func (a App) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K    string `json:"k"`
		Fn   string `json:"fn"`
		Args []Term `json:"args"`
	}{"app", a.Fn, a.Args})
}

func (a *App) UnmarshalJSON(data []byte) error {
	var wire struct {
		K    string            `json:"k"`
		Fn   string            `json:"fn"`
		Args []json.RawMessage `json:"args"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "app" {
		return fmt.Errorf("logic: expected term kind app, got %q", wire.K)
	}
	var args []Term
	if wire.Args != nil {
		args = make([]Term, 0, len(wire.Args))
		for _, raw := range wire.Args {
			term, err := UnmarshalTerm(raw)
			if err != nil {
				return err
			}
			args = append(args, term)
		}
	}
	a.Fn, a.Args = wire.Fn, args
	return nil
}

func (p Pred) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K    string `json:"k"`
		Name string `json:"name"`
		Args []Term `json:"args"`
	}{"pred", p.Name, p.Args})
}

func (p *Pred) UnmarshalJSON(data []byte) error {
	var wire struct {
		K    string            `json:"k"`
		Name string            `json:"name"`
		Args []json.RawMessage `json:"args"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "pred" {
		return fmt.Errorf("logic: expected formula kind pred, got %q", wire.K)
	}
	var args []Term
	if wire.Args != nil {
		args = make([]Term, 0, len(wire.Args))
		for _, raw := range wire.Args {
			term, err := UnmarshalTerm(raw)
			if err != nil {
				return err
			}
			args = append(args, term)
		}
	}
	p.Name, p.Args = wire.Name, args
	return nil
}

func (n Not) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K string  `json:"k"`
		F Formula `json:"f"`
	}{"not", n.F})
}

func (n *Not) UnmarshalJSON(data []byte) error {
	var wire struct {
		K string          `json:"k"`
		F json.RawMessage `json:"f"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "not" {
		return fmt.Errorf("logic: expected formula kind not, got %q", wire.K)
	}
	f, err := UnmarshalFormula(wire.F)
	if err != nil {
		return err
	}
	n.F = f
	return nil
}

func (b Bin) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K  string  `json:"k"`
		Op BinOp   `json:"op"`
		L  Formula `json:"l"`
		R  Formula `json:"r"`
	}{"bin", b.Op, b.L, b.R})
}

func (b *Bin) UnmarshalJSON(data []byte) error {
	var wire struct {
		K  string          `json:"k"`
		Op BinOp           `json:"op"`
		L  json.RawMessage `json:"l"`
		R  json.RawMessage `json:"r"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "bin" {
		return fmt.Errorf("logic: expected formula kind bin, got %q", wire.K)
	}
	l, err := UnmarshalFormula(wire.L)
	if err != nil {
		return err
	}
	r, err := UnmarshalFormula(wire.R)
	if err != nil {
		return err
	}
	b.Op, b.L, b.R = wire.Op, l, r
	return nil
}

func (q Quant) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		K string    `json:"k"`
		Q QuantKind `json:"q"`
		V string    `json:"v"`
		F Formula   `json:"f"`
	}{"quant", q.Q, q.V, q.F})
}

func (q *Quant) UnmarshalJSON(data []byte) error {
	var wire struct {
		K string          `json:"k"`
		Q QuantKind       `json:"q"`
		V string          `json:"v"`
		F json.RawMessage `json:"f"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if wire.K != "quant" {
		return fmt.Errorf("logic: expected formula kind quant, got %q", wire.K)
	}
	f, err := UnmarshalFormula(wire.F)
	if err != nil {
		return err
	}
	q.Q, q.V, q.F = wire.Q, wire.V, f
	return nil
}

func UnmarshalTerm(data []byte) (Term, error) {
	kind, err := jsonKind(data)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "var":
		var value Var
		return value, json.Unmarshal(data, &value)
	case "app":
		var value App
		return value, json.Unmarshal(data, &value)
	default:
		return nil, fmt.Errorf("logic: unknown term kind %q", kind)
	}
}

func UnmarshalFormula(data []byte) (Formula, error) {
	kind, err := jsonKind(data)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "pred":
		var value Pred
		return value, json.Unmarshal(data, &value)
	case "not":
		var value Not
		return value, json.Unmarshal(data, &value)
	case "bin":
		var value Bin
		return value, json.Unmarshal(data, &value)
	case "quant":
		var value Quant
		return value, json.Unmarshal(data, &value)
	default:
		return nil, fmt.Errorf("logic: unknown formula kind %q", kind)
	}
}

func jsonKind(data []byte) (string, error) {
	var wire struct {
		K string `json:"k"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(data), &wire); err != nil {
		return "", err
	}
	return wire.K, nil
}
