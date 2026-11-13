package main

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
