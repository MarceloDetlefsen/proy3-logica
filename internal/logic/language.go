package logic

type Language struct {
	Funcs map[string]int `json:"funcs"`
	Preds map[string]int `json:"preds"`
}
