package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
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
	var document strings.Builder
	document.WriteString(`\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[a4paper,margin=2.2cm]{geometry}
\usepackage{amsmath,amssymb}
\setlength{\parskip}{0.2em}
\setlength{\parindent}{0pt}
\setlength{\itemsep}{0pt}
\setlength{\topsep}{2pt}
\setlength{\parsep}{0pt}
\makeatletter
\renewcommand{\section}{\@startsection{section}{1}{\z@}{-1.8ex plus -0.4ex minus -.2ex}{0.7ex plus .2ex}{\normalfont\large\bfseries}}
\renewcommand{\subsection}{\@startsection{subsection}{2}{\z@}{-1.3ex plus -.3ex minus -.2ex}{0.5ex plus .1ex}{\normalfont\normalsize\bfseries}}
\makeatother
\begin{document}
\begin{center}{\LARGE Resolución semántica}\end{center}
\textit{Evaluación de una fórmula en una interpretación finita.}

\section*{Lenguaje}
`)
	writeFunctionSignature(&document, request.Language)
	writePredicateSignature(&document, request.Language)
	document.WriteString("\n\\section*{Interpretación}\n\\textbf{Dominio:} ")
	writeMath(&document, "D = "+mathSet(request.Interpretation.Domain))
	document.WriteString("\n\\subsection*{Funciones}\n")
	functionNames := sortedFuncNames(request.Interpretation.Funcs)
	if len(functionNames) == 0 {
		document.WriteString("No hay funciones declaradas.\n")
	}
	for _, name := range functionNames {
		document.WriteString("\\textbf{")
		document.WriteString(texEscape(name))
		document.WriteString("}: ")
		entries := request.Interpretation.Funcs[name]
		if len(entries) == 0 {
			document.WriteString("sin entradas (no válido para una interpretación completa).\\\\\n")
			continue
		}
		for index, entry := range entries {
			if index > 0 {
				document.WriteString("; ")
			}
			application := name
			if len(entry.Args) > 0 {
				application += "(" + strings.Join(entry.Args, ",") + ")"
			}
			writeMath(&document, application+" = "+entry.Value)
		}
		document.WriteString("\\\\\n")
	}
	document.WriteString("\\subsection*{Relaciones}\n")
	document.WriteString("Las tuplas listadas forman la extensión de cada predicado; las no listadas son falsas.\\\\\n")
	predicateNames := sortedRelationNames(request.Interpretation.Rels)
	if len(predicateNames) == 0 {
		document.WriteString("No hay predicados declarados.\n")
	}
	for _, name := range predicateNames {
		document.WriteString("\\textbf{")
		document.WriteString(texEscape(name))
		document.WriteString(":} ")
		tuples := request.Interpretation.Rels[name]
		if len(tuples) == 0 {
			document.WriteString("\\(\\varnothing\\)")
		} else {
			applications := make([]string, len(tuples))
			for index, tuple := range tuples {
				applications[index] = name + "(" + strings.Join(tuple, ",") + ")"
			}
			writeMath(&document, mathSet(applications))
		}
		document.WriteString("\\\\\n")
	}

	document.WriteString("\\section*{Asignación y resultado}\n")
	document.WriteString("\\textbf{Variables libres:} ")
	if len(result.FreeVars) == 0 {
		document.WriteString("ninguna")
	} else {
		writeMath(&document, strings.Join(result.FreeVars, ","))
	}
	document.WriteString("\\\\\n\\textbf{Entorno:} ")
	writeEnvironment(&document, request.Env)
	document.WriteString("\\\\\n\\textbf{Fórmula evaluada:} ")
	writeMath(&document, result.Formula)
	document.WriteString("\\\\\n\\textbf{Valor:} ")
	if result.Value {
		document.WriteString("verdadero")
	} else {
		document.WriteString("falso")
	}
	document.WriteString(".\n")
	document.WriteString("\\section*{Procedimiento de evaluación}\n")
	writeExplanation(&document, result.Explanation, 0)
	if len(warnings) > 0 {
		document.WriteString("\\section*{Observaciones}\n\\begin{itemize}\n")
		for _, warning := range warnings {
			document.WriteString("\\item " + texEscape(warning.Message) + "\n")
		}
		document.WriteString("\\end{itemize}\n")
	}
	document.WriteString("\\end{document}\n")
	return document.String()
}

func writeFunctionSignature(document *strings.Builder, language logic.Language) {
	names := sortedIntNames(language.Funcs)
	document.WriteString("\\textbf{Funciones:} ")
	if len(names) == 0 {
		document.WriteString("ninguna")
	} else {
		for index, name := range names {
			if index > 0 {
				document.WriteString(", ")
			}
			arity := language.Funcs[name]
			if arity == 0 {
				writeMath(document, name)
				document.WriteString("\\(\\in D\\)")
			} else {
				writeMath(document, name+"("+placeholderArguments(arity)+")")
				document.WriteString(": ")
				document.WriteString(fmt.Sprintf("\\(D^{%d} \\to D\\)", arity))
			}
		}
	}
	document.WriteString("\\\\\n")
}

func writePredicateSignature(document *strings.Builder, language logic.Language) {
	names := sortedIntNames(language.Preds)
	document.WriteString("\\textbf{Predicados:} ")
	if len(names) == 0 {
		document.WriteString("ninguno")
	} else {
		for index, name := range names {
			if index > 0 {
				document.WriteString(", ")
			}
			writeMath(document, name+"("+placeholderArguments(language.Preds[name])+")")
		}
	}
	document.WriteString("\\\\\n")
}

func writeExplanation(document *strings.Builder, node logic.Explanation, childNumber int) {
	document.WriteString("\\begin{itemize}\n\\item ")
	if childNumber == 0 {
		document.WriteString("\\textbf{Nodo raíz.} ")
	} else {
		document.WriteString(fmt.Sprintf("\\textbf{Hijo %d.} ", childNumber))
	}
	document.WriteString("\\textbf{Subfórmula:} ")
	writeMath(document, node.Formula)
	document.WriteString("; \\textbf{valor:} ")
	if node.Holds {
		document.WriteString("verdadero")
	} else {
		document.WriteString("falso")
	}
	document.WriteString("; \\textbf{regla:} ")
	document.WriteString(texEscape(ruleSpanish(node.Rule)))
	if node.Summary != "" {
		document.WriteString(". ")
		document.WriteString(texEscape(node.Summary))
	}
	if len(node.Env) > 0 {
		document.WriteString("\\\\\n\\textbf{Entorno local:} ")
		writeEnvironment(document, node.Env)
	}
	if len(node.Terms) > 0 {
		document.WriteString("\\\\\n\\textbf{Términos:} ")
		for index, term := range node.Terms {
			if index > 0 {
				document.WriteString("; ")
			}
			writeMath(document, term.Term+" = "+term.Value)
		}
	}
	if node.Witness != nil {
		document.WriteString("\\\\\n\\textbf{Testigo:} ")
		writeMath(document, node.Witness.Variable+" = "+node.Witness.Value)
	}
	if node.Counterexample != nil {
		document.WriteString("\\\\\n\\textbf{Contraejemplo:} ")
		writeMath(document, node.Counterexample.Variable+" = "+node.Counterexample.Value)
	}
	if node.Checked != nil {
		document.WriteString(fmt.Sprintf("\\\\\n\\textbf{Revisión:} %d de %d elementos del dominio.", *node.Checked, valueOrZero(node.DomainSize)))
	}
	if node.Truncated {
		document.WriteString("\\\\El árbol de explicación fue recortado por el límite de tamaño; el resultado se evaluó completo.")
	}
	document.WriteString("\\\\\n\\textbf{Hijos decisivos (números):} ")
	if len(node.Decisive) == 0 {
		document.WriteString("no aplica")
	} else {
		for index, childIndex := range node.Decisive {
			if index > 0 {
				document.WriteString(", ")
			}
			document.WriteString(fmt.Sprint(childIndex + 1))
		}
	}
	for index, child := range node.Children {
		document.WriteString("\n")
		writeExplanation(document, child, index+1)
	}
	document.WriteString("\n\\end{itemize}\n")
}

func writeTextList(document *strings.Builder, values []string) {
	if len(values) == 0 {
		document.WriteString("ninguno")
		return
	}
	for index, value := range values {
		if index > 0 {
			document.WriteString(", ")
		}
		document.WriteString(texEscape(value))
	}
}

func writeEnvironment(document *strings.Builder, environment logic.Env) {
	names := make([]string, 0, len(environment))
	for name := range environment {
		names = append(names, name)
	}
	sort.Strings(names)
	if len(names) == 0 {
		document.WriteString("vacío")
		return
	}
	for index, name := range names {
		if index > 0 {
			document.WriteString(", ")
		}
		writeMath(document, name+" = "+environment[name])
	}
}

func writeMath(document *strings.Builder, expression string) {
	document.WriteString("\\(")
	document.WriteString(texMath(expression))
	document.WriteString("\\)")
}

func texMath(expression string) string {
	runes := []rune(expression)
	var output strings.Builder
	for index := 0; index < len(runes); {
		character := runes[index]
		if isMathIdentifierStart(character) {
			start := index
			index++
			for index < len(runes) && isMathIdentifierPart(runes[index]) {
				index++
			}
			identifier := string(runes[start:index])
			parts := strings.Split(identifier, "_")
			if parts[0] == "" {
				output.WriteString("\\text{" + strings.ReplaceAll(identifier, "_", `\_`) + "}")
				continue
			}
			output.WriteString(parts[0])
			for _, part := range parts[1:] {
				output.WriteString("_{" + part + "}")
			}
			continue
		}
		switch character {
		case '∀':
			output.WriteString("\\forall ")
		case '∃':
			output.WriteString("\\exists ")
		case '¬':
			output.WriteString("\\neg ")
		case '∧':
			output.WriteString("\\land ")
		case '∨':
			output.WriteString("\\lor ")
		case '→':
			output.WriteString("\\to ")
		case '↔':
			output.WriteString("\\leftrightarrow ")
		case '⊤':
			output.WriteString("\\top ")
		case '⊥':
			output.WriteString("\\bot ")
		case '{':
			output.WriteString("\\{")
		case '}':
			output.WriteString("\\}")
		case ' ', '\t', '\n', '(', ')', ',', '=':
			output.WriteRune(character)
		default:
			output.WriteString("\\text{" + texEscape(string(character)) + "}")
		}
		index++
	}
	return output.String()
}

func mathSet(values []string) string {
	return "{" + strings.Join(values, ",") + "}"
}

func placeholderArguments(arity int) string {
	arguments := make([]string, arity)
	for index := range arguments {
		arguments[index] = fmt.Sprintf("x_%d", index+1)
	}
	return strings.Join(arguments, ",")
}

func isMathIdentifierStart(character rune) bool {
	return character == '_' || character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z'
}

func isMathIdentifierPart(character rune) bool {
	return isMathIdentifierStart(character) || character >= '0' && character <= '9'
}

func sortedFuncNames(values map[string][]logic.FuncEntry) []string {
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func sortedRelationNames(values map[string][][]string) []string {
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func sortedIntNames(values map[string]int) []string {
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func valueOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func ruleSpanish(rule string) string {
	labels := map[string]string{
		"pred": "predicado", "eq": "igualdad", "not": "negación", "and": "conjunción",
		"or": "disyunción", "imp": "implicación", "iff": "bicondicional",
		"forall": "cuantificador universal", "exists": "cuantificador existencial", "mock": "explicación de demostración",
	}
	if label, ok := labels[rule]; ok {
		return label
	}
	return rule
}

func texEscape(value string) string {
	var escaped strings.Builder
	for _, character := range value {
		switch character {
		case '\\':
			escaped.WriteString("\\textbackslash{}")
		case '{':
			escaped.WriteString("\\{")
		case '}':
			escaped.WriteString("\\}")
		case '#':
			escaped.WriteString("\\#")
		case '$':
			escaped.WriteString("\\$")
		case '%':
			escaped.WriteString("\\%")
		case '&':
			escaped.WriteString("\\&")
		case '_':
			escaped.WriteString("\\_")
		case '^':
			escaped.WriteString("\\textasciicircum{}")
		case '~':
			escaped.WriteString("\\textasciitilde{}")
		case '\n', '\r':
			escaped.WriteByte(' ')
		case '∀':
			escaped.WriteString("\\ensuremath{\\forall}")
		case '∃':
			escaped.WriteString("\\ensuremath{\\exists}")
		case '¬':
			escaped.WriteString("\\ensuremath{\\neg}")
		case '∧':
			escaped.WriteString("\\ensuremath{\\land}")
		case '∨':
			escaped.WriteString("\\ensuremath{\\lor}")
		case '→':
			escaped.WriteString("\\ensuremath{\\to}")
		case '↔':
			escaped.WriteString("\\ensuremath{\\leftrightarrow}")
		case '⊤':
			escaped.WriteString("\\ensuremath{\\top}")
		case '⊥':
			escaped.WriteString("\\ensuremath{\\bot}")
		default:
			escaped.WriteRune(character)
		}
	}
	return escaped.String()
}
