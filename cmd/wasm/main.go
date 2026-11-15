//go:build js && wasm

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"syscall/js"

	"proy3-logica/internal/logic"
)

func main() {
	api := js.Global().Get("Object").New()
	api.Set("validateLanguage", js.FuncOf(wrapJSON(handleValidateLanguage)))
	api.Set("analyze", js.FuncOf(wrapJSON(handleAnalyze)))
	api.Set("validateInterpretation", js.FuncOf(wrapJSON(handleValidateInterpretation)))
	api.Set("generateInterpretation", js.FuncOf(wrapJSON(handleGenerateInterpretation)))
	api.Set("evaluate", js.FuncOf(wrapJSON(handleEvaluate)))
	api.Set("exportEvaluationTeX", js.FuncOf(wrapJSON(handleExportEvaluationTeX)))

	js.Global().Set("proy3Wasm", api)
	select {}
}

func wrapJSON(handler func(string) (any, int, error)) func(js.Value, []js.Value) any {
	return func(_ js.Value, args []js.Value) any {
		input := "{}"
		if len(args) > 0 && args[0].Type() == js.TypeString {
			input = args[0].String()
		}
		payload, status, err := handler(input)
		if err != nil {
			return marshalJSON(map[string]any{
				"__httpError": true,
				"status":      status,
				"message":     err.Error(),
			})
		}
		return marshalJSON(payload)
	}
}

func handleValidateLanguage(input string) (any, int, error) {
	var body logic.ValidateLanguageRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	return logic.ExecuteValidateLanguage(body), 200, nil
}

func handleAnalyze(input string) (any, int, error) {
	var body logic.AnalyzeRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	return logic.AnalyzeFormula(body.Input, body.Language), 200, nil
}

func handleValidateInterpretation(input string) (any, int, error) {
	var body logic.InterpretationValidateRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	return logic.ValidateInterpretation(body.Language, body.Interpretation), 200, nil
}

func handleGenerateInterpretation(input string) (any, int, error) {
	var body logic.GenerateInterpretationRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	res, err := logic.ExecuteGenerateInterpretation(body)
	if err != nil {
		return nil, 500, err
	}
	return res, 200, nil
}

func handleEvaluate(input string) (any, int, error) {
	var body logic.EvaluateRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	return logic.EvaluateFormula(body), 200, nil
}

func handleExportEvaluationTeX(input string) (any, int, error) {
	var body logic.EvaluateRequest
	if err := decodeStrictJSON(input, &body); err != nil {
		return nil, 400, errors.New("El cuerpo JSON no es válido.")
	}
	response := logic.EvaluateFormula(body)
	if len(response.Errors) > 0 {
		return response, 422, nil
	}
	return map[string]string{
		"tex": logic.EvaluationTeX(body, *response.Result, response.Warnings),
	}, 200, nil
}

func decodeStrictJSON(input string, destination any) error {
	decoder := json.NewDecoder(bytes.NewBufferString(input))
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

func marshalJSON(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return `{"__httpError":true,"status":500,"message":"Error interno al serializar JSON."}`
	}
	return string(encoded)
}
