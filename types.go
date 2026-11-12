package main

type Term struct {
	Kind string `json:"k"`
	Name string `json:"name,omitempty"`
	Fn   string `json:"fn,omitempty"`
	Args []Term `json:"args,omitempty"`
}

type Formula struct {
	Kind string `json:"k"`

	Name string `json:"name,omitempty"`
	Args []Term `json:"args,omitempty"`

	Formula *Formula `json:"f,omitempty"`

	Op    string   `json:"op,omitempty"`
	Left  *Formula `json:"l,omitempty"`
	Right *Formula `json:"r,omitempty"`

	Quantifier string `json:"q,omitempty"`
	Variable   string `json:"v,omitempty"`
}

type Interp struct {
	Domain []string                     `json:"domain"`
	Funcs  map[string]map[string]string `json:"funcs"`
	Rels   map[string][][]string        `json:"rels"`
}

type Env map[string]string

type Explanation struct {
	Holds    bool          `json:"holds"`
	Rule     string        `json:"rule"`
	Witness  Env           `json:"witness,omitempty"`
	Counter  Env           `json:"counter,omitempty"`
	Children []Explanation `json:"children"`
}
