package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLanguageValidateAPI(t *testing.T) {
	server := newServer()
	tests := []struct {
		name       string
		body       string
		status     int
		firstError string
	}{
		{
			name:   "valid language",
			body:   `{"funcs":[{"name":"c","arity":0}],"preds":[{"name":"P","arity":1}]}`,
			status: http.StatusOK,
		},
		{
			name:       "language validation errors stay in payload",
			body:       `{"funcs":[],"preds":[{"name":"P","arity":0}]}`,
			status:     http.StatusOK,
			firstError: "INVALID_ARITY",
		},
		{
			name:   "malformed JSON",
			body:   `{"funcs":`,
			status: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/language/validate", strings.NewReader(test.body))
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, request)

			if recorder.Code != test.status {
				t.Fatalf("status: want %d, got %d; body=%s", test.status, recorder.Code, recorder.Body.String())
			}
			var response struct {
				Language map[string]map[string]int `json:"language"`
				Errors   []struct {
					Code string `json:"code"`
				} `json:"errors"`
				Message string `json:"message"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if test.firstError != "" {
				if len(response.Errors) == 0 || response.Errors[0].Code != test.firstError {
					t.Fatalf("unexpected errors: %#v", response.Errors)
				}
			}
			if test.status == http.StatusBadRequest && response.Message == "" {
				t.Fatal("malformed JSON response has no Spanish message")
			}
		})
	}
}

func TestAnalyzeAPI(t *testing.T) {
	server := newServer()
	validBody := `{"input":"P(x)","language":{"funcs":{"c":0},"preds":{"P":1}}}`

	tests := []struct {
		name       string
		body       string
		status     int
		freeVars   []string
		firstError string
	}{
		{name: "valid formula", body: validBody, status: http.StatusOK, freeVars: []string{"x"}},
		{
			name:       "formula errors stay in analysis",
			body:       `{"input":"Q(x)","language":{"funcs":{},"preds":{"P":1}}}`,
			status:     http.StatusOK,
			firstError: "UNDECLARED_SYMBOL",
		},
		{name: "malformed JSON", body: `{`, status: http.StatusBadRequest},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/analyze", strings.NewReader(test.body))
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, request)

			if recorder.Code != test.status {
				t.Fatalf("status: want %d, got %d; body=%s", test.status, recorder.Code, recorder.Body.String())
			}
			var response struct {
				Formula  json.RawMessage `json:"formula"`
				FreeVars []string        `json:"freeVars"`
				Warnings []any           `json:"warnings"`
				Errors   []struct {
					Code string `json:"code"`
				} `json:"errors"`
				Message string `json:"message"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if test.status == http.StatusOK && test.firstError == "" && len(response.Formula) == 0 {
				t.Fatal("valid analysis has no formula")
			}
			if test.freeVars != nil && strings.Join(response.FreeVars, ",") != strings.Join(test.freeVars, ",") {
				t.Fatalf("free vars: want %v, got %v", test.freeVars, response.FreeVars)
			}
			if test.firstError != "" && (len(response.Errors) == 0 || response.Errors[0].Code != test.firstError) {
				t.Fatalf("unexpected errors: %#v", response.Errors)
			}
			if test.status == http.StatusBadRequest && response.Message == "" {
				t.Fatal("malformed JSON response has no Spanish message")
			}
		})
	}
}

func TestAPIRejectsUnsupportedMethods(t *testing.T) {
	server := newServer()
	for _, path := range []string{"/api/language/validate", "/api/analyze"} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status: want %d, got %d", http.StatusMethodNotAllowed, recorder.Code)
			}
		})
	}
}
