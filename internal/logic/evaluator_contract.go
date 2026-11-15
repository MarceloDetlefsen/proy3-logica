package logic

import "encoding/json"

type FuncEntry struct {
	Args  []string `json:"args"`
	Value string   `json:"value"`
}

type Interpretation struct {
	Domain []string               `json:"domain"`
	Funcs  map[string][]FuncEntry `json:"funcs"`
	Rels   map[string][][]string  `json:"rels"`
}

type Env map[string]string

type ExplanationTerm struct {
	Term  string `json:"term"`
	Value string `json:"value"`
}

type Explanation struct {
	Holds          bool                `json:"holds"`
	Rule           string              `json:"rule"`
	Formula        string              `json:"formula"`
	Summary        string              `json:"summary"`
	Env            Env                 `json:"env"`
	Terms          []ExplanationTerm   `json:"terms,omitempty"`
	Witness        *ExplanationBinding `json:"witness,omitempty"`
	Counterexample *ExplanationBinding `json:"counterexample,omitempty"`
	Checked        *int                `json:"checked,omitempty"`
	DomainSize     *int                `json:"domainSize,omitempty"`
	Decisive       []int               `json:"decisive,omitempty"`
	Truncated      bool                `json:"truncated,omitempty"`
	Children       []Explanation       `json:"children"`
}

type ExplanationBinding struct {
	Variable string `json:"variable"`
	Value    string `json:"value"`
}

type InterpretationValidateRequest struct {
	Language       Language       `json:"language"`
	Interpretation Interpretation `json:"interpretation"`
}

type InterpretationValidateResponse struct {
	Errors   []LogicError `json:"errors"`
	Warnings []Warning    `json:"warnings"`
}

type InterpretationGenerateResponse struct {
	Interpretation *Interpretation `json:"interpretation,omitempty"`
	Seed           int64           `json:"seed"`
	Errors         []LogicError    `json:"errors"`
}

type EvaluateRequest struct {
	Language       Language       `json:"language"`
	Input          string         `json:"input"`
	Interpretation Interpretation `json:"interpretation"`
	Env            Env            `json:"env"`
}

type EvaluateResult struct {
	Value       bool        `json:"value"`
	Formula     string      `json:"formula"`
	FreeVars    []string    `json:"freeVars"`
	Explanation Explanation `json:"explanation"`
}

type EvaluateResponse struct {
	Errors   []LogicError    `json:"errors"`
	Warnings []Warning       `json:"warnings"`
	Result   *EvaluateResult `json:"result,omitempty"`
}

type ModelSearchRequest struct {
	Language      Language `json:"language"`
	Input         string   `json:"input"`
	MaxDomainSize int      `json:"maxDomainSize"`
}

type ModelSearchExample struct {
	Interpretation Interpretation `json:"interpretation"`
	Env            Env            `json:"env"`
}

type ModelSearchResponse struct {
	Satisfying    *ModelSearchExample `json:"satisfying,omitempty"`
	Falsifying    *ModelSearchExample `json:"falsifying,omitempty"`
	Checked       int                 `json:"checked"`
	Evaluated     int                 `json:"evaluated"`
	MaxDomainSize int                 `json:"maxDomainSize"`
	Complete      bool                `json:"complete"`
	LimitReached  bool                `json:"limitReached"`
	Errors        []LogicError        `json:"errors"`
}

const (
	DOMAIN_EMPTY           = "DOMAIN_EMPTY"
	DOMAIN_SIZE_INVALID    = "DOMAIN_SIZE_INVALID"
	DOMAIN_INVALID_ELEMENT = "DOMAIN_INVALID_ELEMENT"
	DOMAIN_DUPLICATE       = "DOMAIN_DUPLICATE"
	FUNC_MISSING           = "FUNC_MISSING"
	FUNC_UNKNOWN           = "FUNC_UNKNOWN"
	FUNC_EMPTY             = "FUNC_EMPTY"
	FUNC_ARITY             = "FUNC_ARITY"
	FUNC_NOT_IN_DOMAIN     = "FUNC_NOT_IN_DOMAIN"
	FUNC_DUPLICATE         = "FUNC_DUPLICATE"
	FUNC_INCOMPLETE        = "FUNC_INCOMPLETE"
	REL_MISSING            = "REL_MISSING"
	REL_UNKNOWN            = "REL_UNKNOWN"
	REL_EMPTY              = "REL_EMPTY"
	REL_ARITY              = "REL_ARITY"
	REL_NOT_IN_DOMAIN      = "REL_NOT_IN_DOMAIN"
	ENV_MISSING            = "ENV_MISSING"
	ENV_NOT_IN_DOMAIN      = "ENV_NOT_IN_DOMAIN"
	LIMIT_EXCEEDED         = "LIMIT_EXCEEDED"
	EVAL_LIMIT             = "EVAL_LIMIT"
)

const (
	WarningDuplicateTuple = "duplicate_tuple"
	WarningExtraEnv       = "extra_env"
)

// Interpretation limits keep validation and later evaluation bounded.
const (
	MaxDomainSize         = 100
	MaxTableEntries       = 10000
	MaxIncompleteExamples = 5
	MaxGeneratedArity     = 1000
)

func (entry FuncEntry) MarshalJSON() ([]byte, error) {
	args := entry.Args
	if args == nil {
		args = []string{}
	}
	type wire FuncEntry
	return json.Marshal(wire{Args: args, Value: entry.Value})
}

func (interpretation Interpretation) MarshalJSON() ([]byte, error) {
	domain := interpretation.Domain
	if domain == nil {
		domain = []string{}
	}
	funcs := interpretation.Funcs
	if funcs == nil {
		funcs = map[string][]FuncEntry{}
	}
	rels := interpretation.Rels
	if rels == nil {
		rels = map[string][][]string{}
	}
	for name, entries := range funcs {
		if entries == nil {
			funcs[name] = []FuncEntry{}
		}
	}
	for name, tuples := range rels {
		if tuples == nil {
			rels[name] = [][]string{}
		}
	}
	type wire Interpretation
	return json.Marshal(wire{Domain: domain, Funcs: funcs, Rels: rels})
}

func (explanation Explanation) MarshalJSON() ([]byte, error) {
	children := explanation.Children
	if children == nil {
		children = []Explanation{}
	}
	type wire Explanation
	return json.Marshal(wire{Holds: explanation.Holds, Rule: explanation.Rule, Formula: explanation.Formula, Summary: explanation.Summary, Env: explanation.Env, Terms: explanation.Terms, Witness: explanation.Witness, Counterexample: explanation.Counterexample, Checked: explanation.Checked, DomainSize: explanation.DomainSize, Decisive: explanation.Decisive, Truncated: explanation.Truncated, Children: children})
}

func (result EvaluateResult) MarshalJSON() ([]byte, error) {
	freeVars := result.FreeVars
	if freeVars == nil {
		freeVars = []string{}
	}
	type wire EvaluateResult
	return json.Marshal(wire{Value: result.Value, Formula: result.Formula, FreeVars: freeVars, Explanation: result.Explanation})
}

func (response InterpretationValidateResponse) MarshalJSON() ([]byte, error) {
	errors := response.Errors
	if errors == nil {
		errors = []LogicError{}
	}
	warnings := response.Warnings
	if warnings == nil {
		warnings = []Warning{}
	}
	type wire InterpretationValidateResponse
	return json.Marshal(wire{Errors: errors, Warnings: warnings})
}

func (response InterpretationGenerateResponse) MarshalJSON() ([]byte, error) {
	errors := response.Errors
	if errors == nil {
		errors = []LogicError{}
	}
	type wire InterpretationGenerateResponse
	return json.Marshal(wire{Interpretation: response.Interpretation, Seed: response.Seed, Errors: errors})
}

func (response EvaluateResponse) MarshalJSON() ([]byte, error) {
	errors := response.Errors
	if errors == nil {
		errors = []LogicError{}
	}
	warnings := response.Warnings
	if warnings == nil {
		warnings = []Warning{}
	}
	type wire EvaluateResponse
	return json.Marshal(wire{Errors: errors, Warnings: warnings, Result: response.Result})
}
