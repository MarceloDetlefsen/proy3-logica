package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"proy3-logica/internal/logic"
)

func TestLearnLessonsMatchRealConstants(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("web", "src", "learn", "lessons.ts"))
	if err != nil {
		t.Fatalf("no se pudo leer web/src/learn/lessons.ts: %v", err)
	}
	text := string(data)

	expected := []struct {
		label string
		value string
	}{
		{"MaxDomainSize", fmt.Sprintf("%d", logic.MaxDomainSize)},
		{"MaxTableEntries", "10 000"},
		{"MaxEvaluationSteps", "100 000"},
		{"MaxSearchedInterpretations", fmt.Sprintf("%d", logic.MaxSearchedInterpretations)},
		{"MaxSearchedEvaluations", fmt.Sprintf("%d", logic.MaxSearchedEvaluations)},
		{"maxSearchTableEntries", "128"},
	}

	if logic.MaxTableEntries != 10000 {
		t.Fatalf("MaxTableEntries inesperado: %d", logic.MaxTableEntries)
	}
	if logic.MaxEvaluationSteps != 100000 {
		t.Fatalf("MaxEvaluationSteps inesperado: %d", logic.MaxEvaluationSteps)
	}

	for _, item := range expected {
		if !strings.Contains(text, item.value) {
			t.Errorf("lessons.ts no contiene la constante real %s (%s)", item.label, item.value)
		}
	}

	if strings.Contains(text, "Peano") {
		t.Error("lessons.ts no debe incluir contenido de Peano (pertenece a Historia)")
	}
}
