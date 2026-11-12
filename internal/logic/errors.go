package logic

type LogicError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Start   int    `json:"start"`
	End     int    `json:"end"`
	Path    string `json:"path,omitempty"`
}

const (
	LEX_UNEXPECTED_CHAR = "LEX_UNEXPECTED_CHAR"
	LEX_INVALID_TOKEN   = "LEX_INVALID_TOKEN"
	PARSE_EXPECTED      = "PARSE_EXPECTED"
	PARSE_EMPTY         = "PARSE_EMPTY"
	PARSE_UNEXPECTED    = "PARSE_UNEXPECTED"
	UNDECLARED_SYMBOL   = "UNDECLARED_SYMBOL"
	ARITY_MISMATCH      = "ARITY_MISMATCH"
	WRONG_SYMBOL_KIND   = "WRONG_SYMBOL_KIND"
	INVALID_NAME        = "INVALID_NAME"
	DUPLICATE_SYMBOL    = "DUPLICATE_SYMBOL"
	RESERVED_NAME       = "RESERVED_NAME"
	INVALID_ARITY       = "INVALID_ARITY"
)
