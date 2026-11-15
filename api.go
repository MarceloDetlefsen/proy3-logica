package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"proy3-logica/internal/logic"
)

type validateLanguageRequest struct {
	Funcs []logic.SymbolDecl `json:"funcs"`
	Preds []logic.SymbolDecl `json:"preds"`
}

type validateLanguageResponse struct {
	Language logic.Language     `json:"language"`
	Errors   []logic.LogicError `json:"errors"`
}

type analyzeRequest struct {
	Input    string         `json:"input"`
	Language logic.Language `json:"language"`
}

type validateInterpretationRequest struct {
	Language       logic.Language       `json:"language"`
	Interpretation logic.Interpretation `json:"interpretation"`
}

func validateLanguageHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}

	var body validateLanguageRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}

	language, errors := logic.ValidateLanguage(body.Funcs, body.Preds)
	if language.Funcs == nil {
		language.Funcs = map[string]int{}
	}
	if language.Preds == nil {
		language.Preds = map[string]int{}
	}
	if errors == nil {
		errors = []logic.LogicError{}
	}
	writeJSON(writer, http.StatusOK, validateLanguageResponse{Language: language, Errors: errors})
}

func analyzeHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}

	var body analyzeRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}

	writeJSON(writer, http.StatusOK, logic.AnalyzeFormula(body.Input, body.Language))
}

func validateInterpretationHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}
	var body validateInterpretationRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}
	writeJSON(writer, http.StatusOK, logic.ValidateInterpretation(body.Language, body.Interpretation))
}

func evaluateHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}
	var body logic.EvaluateRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}
	writeJSON(writer, http.StatusOK, logic.EvaluateFormula(body))
}

func exportEvaluationPDFHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}
	request.Body = http.MaxBytesReader(writer, request.Body, 2<<20)
	var body logic.EvaluateRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido o excede el límite de 2 MiB.")
		return
	}
	response := logic.EvaluateFormula(body)
	if len(response.Errors) > 0 {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(writer).Encode(response)
		return
	}
	pdf, err := compileEvaluationPDF(request.Context(), body, *response.Result, response.Warnings)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errLatexUnavailable) {
			status = http.StatusServiceUnavailable
		}
		writeAPIError(writer, status, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/pdf")
	writer.Header().Set("Content-Disposition", `attachment; filename="resolucion-semantica.pdf"`)
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(pdf)
}

func decodeJSON(request *http.Request, destination any) error {
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return errors.New("el cuerpo contiene más de un valor JSON")
		}
		return err
	}
	return nil
}

func writeAPIError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"message": message})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}
