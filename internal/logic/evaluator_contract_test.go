package logic

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

type evaluatorExample struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Language       Language        `json:"language"`
	Input          string          `json:"input"`
	Interpretation Interpretation  `json:"interpretation"`
	Env            Env             `json:"env"`
	Expect         evaluatorExpect `json:"expect"`
}

type evaluatorExpect struct {
	ErrorCodes     []string            `json:"errorCodes"`
	Value          *bool               `json:"value"`
	Witness        *ExplanationBinding `json:"witness,omitempty"`
	Counterexample *ExplanationBinding `json:"counterexample,omitempty"`
}

func TestEvaluatorFixturesDecode(t *testing.T) {
	_, sourceFile, _, _ := runtime.Caller(0)
	pattern := filepath.Join(filepath.Dir(sourceFile), "..", "..", "testdata", "examples", "*.json")
	paths, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) < 16 {
		t.Fatalf("expected at least 16 evaluator examples, got %d", len(paths))
	}

	seenNames := make(map[string]bool, len(paths))
	for _, path := range paths {
		t.Run(strings.TrimSuffix(filepath.Base(path), ".json"), func(t *testing.T) {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			var example evaluatorExample
			if err := json.Unmarshal(data, &example); err != nil {
				t.Fatal(err)
			}
			if example.Name == "" || example.Description == "" || example.Input == "" {
				t.Fatalf("fixture is missing required metadata: %#v", example)
			}
			if seenNames[example.Name] {
				t.Fatalf("duplicate fixture name %q", example.Name)
			}
			seenNames[example.Name] = true
			if example.Expect.ErrorCodes == nil {
				t.Fatal("expect.errorCodes must be an array")
			}
		})
	}
}

func TestEvaluatorContractSlicesSerializeAsArrays(t *testing.T) {
	data, err := json.Marshal(EvaluateResponse{})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), ":null") {
		t.Fatalf("contract response contains null: %s", data)
	}

	data, err = json.Marshal(Interpretation{})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), ":null") {
		t.Fatalf("interpretation contains null: %s", data)
	}
}
