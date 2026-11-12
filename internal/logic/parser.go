package logic

import "fmt"

func ParseFormula(input string, lang Language) (Formula, []LogicError) {
	tokens, lexErrors := Tokenize(input)
	if lexErrors != nil {
		return nil, lexErrors
	}
	if len(tokens) == 1 && tokens[0].Type == EOF {
		return nil, []LogicError{{Code: PARSE_EMPTY, Message: "La fórmula está vacía.", Start: 0, End: 0}}
	}

	parser := formulaParser{tokens: tokens, lang: lang}
	formula, err := parser.parseIff()
	if err != nil {
		return nil, []LogicError{*err}
	}
	if parser.current().Type != EOF {
		return nil, []LogicError{*parser.expected("EOF", parser.current())}
	}
	if len(parser.errors) > 0 {
		return nil, parser.errors
	}
	return formula, nil
}

type formulaParser struct {
	tokens []Token
	index  int
	lang   Language
	errors []LogicError
}

func (p *formulaParser) parseIff() (Formula, *LogicError) {
	left, err := p.parseImp()
	if err != nil {
		return nil, err
	}
	for p.current().Type == IFF {
		p.advance()
		right, syntaxErr := p.parseImp()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		left = Bin{Op: Iff, L: left, R: right}
	}
	return left, nil
}

func (p *formulaParser) parseImp() (Formula, *LogicError) {
	left, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if p.current().Type == IMP {
		p.advance()
		right, syntaxErr := p.parseImp()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		return Bin{Op: Imp, L: left, R: right}, nil
	}
	return left, nil
}

func (p *formulaParser) parseOr() (Formula, *LogicError) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	for p.current().Type == OR {
		p.advance()
		right, syntaxErr := p.parseAnd()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		left = Bin{Op: Or, L: left, R: right}
	}
	return left, nil
}

func (p *formulaParser) parseAnd() (Formula, *LogicError) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	for p.current().Type == AND {
		p.advance()
		right, syntaxErr := p.parseUnary()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		left = Bin{Op: And, L: left, R: right}
	}
	return left, nil
}

func (p *formulaParser) parseUnary() (Formula, *LogicError) {
	switch p.current().Type {
	case NOT:
		p.advance()
		formula, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return Not{F: formula}, nil
	case FORALL, EXISTS:
		quantifier := p.current()
		p.advance()
		variable, err := p.expect(IDENT)
		if err != nil {
			return nil, err
		}
		formula, syntaxErr := p.parseUnary()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		kind := Forall
		if quantifier.Type == EXISTS {
			kind = Exists
		}
		if _, isFunction := p.lang.Funcs[variable.Text]; isFunction {
			p.addError(WRONG_SYMBOL_KIND, fmt.Sprintf("La variable %q no puede ser un símbolo declarado como función.", variable.Text), variable)
		}
		if _, isPredicate := p.lang.Preds[variable.Text]; isPredicate {
			p.addError(WRONG_SYMBOL_KIND, fmt.Sprintf("La variable %q no puede ser un símbolo declarado como predicado.", variable.Text), variable)
		}
		return Quant{Q: kind, V: variable.Text, F: formula}, nil
	default:
		return p.parseAtom()
	}
}

func (p *formulaParser) parseAtom() (Formula, *LogicError) {
	if p.current().Type == LPAREN {
		p.advance()
		formula, err := p.parseIff()
		if err != nil {
			return nil, err
		}
		if _, syntaxErr := p.expect(RPAREN); syntaxErr != nil {
			return nil, syntaxErr
		}
		return formula, nil
	}
	name, err := p.expect(IDENT)
	if err != nil {
		return nil, err
	}
	args, syntaxErr := p.parseOptionalArgs()
	if syntaxErr != nil {
		return nil, syntaxErr
	}
	p.resolvePredicate(name, args)
	return Pred{Name: name.Text, Args: args}, nil
}

func (p *formulaParser) parseOptionalArgs() ([]Term, *LogicError) {
	if p.current().Type != LPAREN {
		return nil, nil
	}
	p.advance()
	first, err := p.parseTerm()
	if err != nil {
		return nil, err
	}
	args := []Term{first}
	for p.current().Type == COMMA {
		p.advance()
		term, syntaxErr := p.parseTerm()
		if syntaxErr != nil {
			return nil, syntaxErr
		}
		args = append(args, term)
	}
	if _, syntaxErr := p.expect(RPAREN); syntaxErr != nil {
		return nil, syntaxErr
	}
	return args, nil
}

func (p *formulaParser) parseTerm() (Term, *LogicError) {
	name, err := p.expect(IDENT)
	if err != nil {
		return nil, err
	}
	args, syntaxErr := p.parseOptionalArgs()
	if syntaxErr != nil {
		return nil, syntaxErr
	}
	if args == nil {
		if arity, isFunction := p.lang.Funcs[name.Text]; isFunction {
			if arity == 0 {
				return App{Fn: name.Text, Args: []Term{}}, nil
			}
			p.addError(ARITY_MISMATCH, fmt.Sprintf("La función %q requiere aridad %d, pero se encontraron 0 argumentos.", name.Text, arity), name)
			return App{Fn: name.Text, Args: []Term{}}, nil
		}
		if _, isPredicate := p.lang.Preds[name.Text]; isPredicate {
			p.addError(WRONG_SYMBOL_KIND, fmt.Sprintf("El símbolo %q es un predicado, no una función.", name.Text), name)
			return Var{Name: name.Text}, nil
		}
		return Var{Name: name.Text}, nil
	}
	if arity, isFunction := p.lang.Funcs[name.Text]; isFunction {
		if arity != len(args) {
			p.addError(ARITY_MISMATCH, fmt.Sprintf("La función %q requiere aridad %d, pero se encontraron %d argumentos.", name.Text, arity, len(args)), name)
		}
		return App{Fn: name.Text, Args: args}, nil
	}
	if _, isPredicate := p.lang.Preds[name.Text]; isPredicate {
		p.addError(WRONG_SYMBOL_KIND, fmt.Sprintf("El símbolo %q es un predicado, no una función.", name.Text), name)
		return App{Fn: name.Text, Args: args}, nil
	}
	p.addError(UNDECLARED_SYMBOL, fmt.Sprintf("El símbolo %q no está declarado.", name.Text), name)
	return App{Fn: name.Text, Args: args}, nil
}

func (p *formulaParser) resolvePredicate(name Token, args []Term) {
	if arity, isPredicate := p.lang.Preds[name.Text]; isPredicate {
		found := len(args)
		if arity != found {
			p.addError(ARITY_MISMATCH, fmt.Sprintf("El predicado %q requiere aridad %d, pero se encontraron %d argumentos.", name.Text, arity, found), name)
		}
		return
	}
	if _, isFunction := p.lang.Funcs[name.Text]; isFunction {
		p.addError(WRONG_SYMBOL_KIND, fmt.Sprintf("El símbolo %q es una función, no un predicado.", name.Text), name)
		return
	}
	p.addError(UNDECLARED_SYMBOL, fmt.Sprintf("El predicado %q no está declarado.", name.Text), name)
}

func (p *formulaParser) addError(code, message string, token Token) {
	p.errors = append(p.errors, LogicError{Code: code, Message: message, Start: token.Start, End: token.End})
}

func (p *formulaParser) expect(kind TokenType) (Token, *LogicError) {
	if p.current().Type != kind {
		return Token{}, p.expected(tokenName(kind), p.current())
	}
	token := p.current()
	p.advance()
	return token, nil
}

func (p *formulaParser) expected(expected string, found Token) *LogicError {
	return &LogicError{
		Code:    PARSE_EXPECTED,
		Message: fmt.Sprintf("Columna %d: se esperaba %q pero se encontró %q.", found.Start+1, expected, tokenText(found)),
		Start:   found.Start,
		End:     found.End,
	}
}

func (p *formulaParser) current() Token { return p.tokens[p.index] }

func (p *formulaParser) advance() {
	if p.index < len(p.tokens)-1 {
		p.index++
	}
}

func tokenName(kind TokenType) string {
	switch kind {
	case RPAREN:
		return ")"
	case IDENT:
		return "identificador"
	case EOF:
		return "fin de la entrada"
	default:
		return string(kind)
	}
}

func tokenText(token Token) string {
	if token.Type == EOF {
		return "fin de la entrada"
	}
	return token.Text
}
