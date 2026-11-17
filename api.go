package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"proy3-logica/internal/logic"
)

func validateLanguageHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}

	var body logic.ValidateLanguageRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}

	writeJSON(writer, http.StatusOK, logic.ExecuteValidateLanguage(body))
}

func analyzeHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}

	var body logic.AnalyzeRequest
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
	var body logic.InterpretationValidateRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}
	writeJSON(writer, http.StatusOK, logic.ValidateInterpretation(body.Language, body.Interpretation))
}

func generateInterpretationHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}
	var body logic.GenerateInterpretationRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}
	response, err := logic.ExecuteGenerateInterpretation(body)
	if err != nil {
		writeAPIError(writer, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, response)
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
	// Los errores de fórmula/modelo viajan en el contrato con HTTP 200. Esto
	// permite que HTTP y WASM entreguen exactamente la misma respuesta lógica.
	writeJSON(writer, http.StatusOK, logic.EvaluateFormula(body))
}

func searchModelsHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use POST.")
		return
	}
	var body logic.ModelSearchRequest
	if err := decodeJSON(request, &body); err != nil {
		writeAPIError(writer, http.StatusBadRequest, "El cuerpo JSON no es válido.")
		return
	}
	writeJSON(writer, http.StatusOK, logic.SearchModels(body))
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
	// Se vuelve a evaluar en el servidor: no se confía en un resultado booleano
	// o un árbol enviado por el cliente antes de producir el documento oficial.
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
	// Rechazar campos desconocidos detecta contratos desactualizados y evita
	// aceptar silenciosamente errores tipográficos del cliente.
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
