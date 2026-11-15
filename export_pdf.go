package main

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"proy3-logica/internal/logic"
)

var errLatexUnavailable = errors.New("No se encontró pdflatex. Instale una distribución de LaTeX con pdflatex para exportar a PDF.")

func compileEvaluationPDF(ctx context.Context, request logic.EvaluateRequest, result logic.EvaluateResult, warnings []logic.Warning) ([]byte, error) {
	compiler := strings.TrimSpace(os.Getenv("LATEX_COMPILER"))
	if compiler == "" {
		compiler = "pdflatex"
	}
	if _, err := exec.LookPath(compiler); err != nil {
		return nil, errLatexUnavailable
	}

	directory, err := os.MkdirTemp("", "proy3-latex-")
	if err != nil {
		return nil, errors.New("No se pudo preparar el documento PDF.")
	}
	defer os.RemoveAll(directory)
	texPath := filepath.Join(directory, "resolucion.tex")
	if err := os.WriteFile(texPath, []byte(evaluationTeX(request, result, warnings)), 0600); err != nil {
		return nil, errors.New("No se pudo preparar el documento PDF.")
	}

	compileCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	command := exec.CommandContext(compileCtx, compiler,
		"-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape",
		"-output-directory", ".", "resolucion.tex",
	)
	command.Dir = directory
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	if err := command.Run(); err != nil {
		if errors.Is(compileCtx.Err(), context.DeadlineExceeded) {
			return nil, errors.New("La compilación de LaTeX excedió 30 segundos. Reduzca el tamaño de la interpretación o del árbol de explicación.")
		}
		return nil, errors.New("LaTeX no pudo generar el PDF. Verifique la instalación de pdflatex y las fuentes Unicode del modelo.")
	}
	pdfPath := filepath.Join(directory, "resolucion.pdf")
	info, err := os.Stat(pdfPath)
	if err != nil || info.Size() == 0 || info.Size() > 20<<20 {
		return nil, errors.New("LaTeX no produjo un PDF válido de hasta 20 MiB.")
	}
	pdf, err := os.ReadFile(pdfPath)
	if err != nil {
		return nil, errors.New("No se pudo leer el PDF generado.")
	}
	return pdf, nil
}

func evaluationTeX(request logic.EvaluateRequest, result logic.EvaluateResult, warnings []logic.Warning) string {
	return logic.EvaluationTeX(request, result, warnings)
}
