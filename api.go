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
