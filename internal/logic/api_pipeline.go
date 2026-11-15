package logic

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
)

// ValidateLanguageRequest matches the JSON payload of /api/language/validate.
type ValidateLanguageRequest struct {
	Funcs []SymbolDecl `json:"funcs"`
	Preds []SymbolDecl `json:"preds"`
}

// ValidateLanguageResponse matches the JSON response of /api/language/validate.
type ValidateLanguageResponse struct {
	Language Language     `json:"language"`
	Errors   []LogicError `json:"errors"`
}

// AnalyzeRequest matches the JSON payload of /api/analyze.
type AnalyzeRequest struct {
	Input    string   `json:"input"`
	Language Language `json:"language"`
}

// GenerateInterpretationRequest matches the JSON payload of /api/interpretation/generate.
type GenerateInterpretationRequest struct {
	Language   Language `json:"language"`
	DomainSize *int     `json:"domainSize,omitempty"`
	Seed       *int64   `json:"seed,omitempty"`
}

// ExecuteValidateLanguage normalizes nil maps/slices and returns the API response.
func ExecuteValidateLanguage(req ValidateLanguageRequest) ValidateLanguageResponse {
	language, errs := ValidateLanguage(req.Funcs, req.Preds)
	if language.Funcs == nil {
		language.Funcs = map[string]int{}
	}
	if language.Preds == nil {
		language.Preds = map[string]int{}
	}
	if errs == nil {
		errs = []LogicError{}
	}
	return ValidateLanguageResponse{Language: language, Errors: errs}
}

// ExecuteGenerateInterpretation resolves defaults for seed and domainSize and
// builds a random valid interpretation for the requested language.
func ExecuteGenerateInterpretation(req GenerateInterpretationRequest) (InterpretationGenerateResponse, error) {
	seed := int64(0)
	if req.Seed != nil {
		seed = *req.Seed
	} else {
		var seedBytes [8]byte
		if _, err := rand.Read(seedBytes[:]); err != nil {
			return InterpretationGenerateResponse{}, errors.New("No se pudo generar una semilla aleatoria.")
		}
		seed = int64(binary.LittleEndian.Uint64(seedBytes[:]) % (1<<53 - 1))
	}
	domainSize := 3
	if req.DomainSize != nil {
		domainSize = *req.DomainSize
	}
	interpretation, errs := GenerateRandomInterpretation(req.Language, domainSize, seed)
	response := InterpretationGenerateResponse{Seed: seed, Errors: errs}
	if len(errs) == 0 {
		response.Interpretation = &interpretation
	}
	return response, nil
}
