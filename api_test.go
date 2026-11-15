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
	for _, path := range []string{"/api/language/validate", "/api/analyze", "/api/interpretation/generate"} {
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

func TestGenerateInterpretationAPI(t *testing.T) {
	server := newServer()
	request := httptest.NewRequest(http.MethodPost, "/api/interpretation/generate", strings.NewReader(`{"language":{"funcs":{"c":0,"f":1},"preds":{"P":1}},"domainSize":2,"seed":42}`))
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status: want %d, got %d; body=%s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var response struct {
		Interpretation struct {
			Domain []string `json:"domain"`
			Funcs  map[string][]struct {
				Args  []string `json:"args"`
				Value string   `json:"value"`
			} `json:"funcs"`
			Rels map[string][][]string `json:"rels"`
		} `json:"interpretation"`
		Seed   int64 `json:"seed"`
		Errors []struct {
			Code string `json:"code"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Errors) != 0 {
		t.Fatalf("unexpected errors: %#v", response.Errors)
	}
	if response.Seed != 42 {
		t.Fatalf("seed: want 42, got %d", response.Seed)
	}
	if len(response.Interpretation.Domain) != 2 {
		t.Fatalf("domain size: want 2, got %v", response.Interpretation.Domain)
	}
	if len(response.Interpretation.Funcs["c"]) != 1 || len(response.Interpretation.Funcs["c"][0].Args) != 0 {
		t.Fatalf("invalid constant table: %#v", response.Interpretation.Funcs["c"])
	}
	if len(response.Interpretation.Funcs["f"]) != 2 {
		t.Fatalf("unary table should contain 2 rows, got %#v", response.Interpretation.Funcs["f"])
	}
	if len(response.Interpretation.Rels["P"]) == 0 {
		t.Fatalf("relation must not be empty: %#v", response.Interpretation.Rels)
	}
}

func TestHealthzAPI(t *testing.T) {
	server := newServer()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /healthz: want 200, got %d", rec.Code)
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	recPost := httptest.NewRecorder()
	server.ServeHTTP(recPost, reqPost)
	if recPost.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /healthz: want 405, got %d", recPost.Code)
	}
}

func TestListenAddress(t *testing.T) {
	t.Setenv("ADDR", "")
	t.Setenv("PORT", "")
	if got := listenAddress(); got != ":8080" {
		t.Fatalf("default listenAddress: want :8080, got %q", got)
	}
	t.Setenv("PORT", "9090")
	if got := listenAddress(); got != ":9090" {
		t.Fatalf("PORT=9090 listenAddress: want :9090, got %q", got)
	}
	t.Setenv("ADDR", "0.0.0.0:7070")
	if got := listenAddress(); got != "0.0.0.0:7070" {
		t.Fatalf("ADDR listenAddress: want 0.0.0.0:7070, got %q", got)
	}
}

func TestSearchModelsAPI(t *testing.T) {
	server := newServer()
	body := `{"language":{"funcs":{},"preds":{"P":1}},"input":"∀x P(x)","maxDomainSize":2}`
	req := httptest.NewRequest(http.MethodPost, "/api/models/search", strings.NewReader(body))
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/models/search: want 200, got %d; body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Errors     []struct{ Code string } `json:"errors"`
		Complete   bool                    `json:"complete"`
		Satisfying any                     `json:"satisfying"`
		Falsifying any                     `json:"falsifying"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Errors) != 0 || !resp.Complete || resp.Satisfying == nil || resp.Falsifying == nil {
		t.Fatalf("unexpected search response: %#v", resp)
	}
}
