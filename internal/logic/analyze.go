package logic

type Warning struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
	Path    string `json:"path,omitempty"`
}

type Analysis struct {
	Formula  Formula      `json:"formula,omitempty"`
	FreeVars []string     `json:"freeVars"`
	Warnings []Warning    `json:"warnings"`
	Errors   []LogicError `json:"errors"`
}

func AnalyzeFormula(input string, lang Language) Analysis {
	analysis := Analysis{
		FreeVars: []string{},
		Warnings: []Warning{},
		Errors:   []LogicError{},
	}

	formula, errors := ParseFormula(input, lang)
	if errors != nil {
		analysis.Errors = errors
		return analysis
	}

	analysis.Formula = formula
	analysis.FreeVars = freeVariables(formula)
	return analysis
}

// freeVariables conserva el orden de primera aparición. Ese orden hace estable
// la creación de selectores de entorno en la interfaz y la búsqueda de modelos.
func freeVariables(formula Formula) []string {
	variables := []string{}
	seen := make(map[string]bool)
	collectFormulaVariables(formula, map[string]bool{}, &variables, seen)
	return variables
}

func collectFormulaVariables(formula Formula, bound map[string]bool, variables *[]string, seen map[string]bool) {
	switch node := formula.(type) {
	case Pred:
		for _, term := range node.Args {
			collectTermVariables(term, bound, variables, seen)
		}
	case Eq:
		collectTermVariables(node.Left, bound, variables, seen)
		collectTermVariables(node.Right, bound, variables, seen)
	case Not:
		collectFormulaVariables(node.F, bound, variables, seen)
	case Bin:
		collectFormulaVariables(node.L, bound, variables, seen)
		collectFormulaVariables(node.R, bound, variables, seen)
	case Quant:
		// Se copia el conjunto de ligadas al entrar a un cuantificador. Esto
		// modela alcance léxico y permite sombreado en cuantificadores anidados.
		nextBound := make(map[string]bool, len(bound)+1)
		for variable := range bound {
			nextBound[variable] = true
		}
		nextBound[node.V] = true
		collectFormulaVariables(node.F, nextBound, variables, seen)
	}
}

func collectTermVariables(term Term, bound map[string]bool, variables *[]string, seen map[string]bool) {
	switch node := term.(type) {
	case Var:
		// Solo se agrega si no está ligada y todavía no apareció como libre.
		if !bound[node.Name] && !seen[node.Name] {
			seen[node.Name] = true
			*variables = append(*variables, node.Name)
		}
	case App:
		for _, argument := range node.Args {
			collectTermVariables(argument, bound, variables, seen)
		}
	}
}
