package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
)

//go:embed web testdata/examples
var webFiles embed.FS

func main() {
	server := newServer()

	log.Println("proy3-logica escuchando en http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", server))
}

func newServer() http.Handler {
	server := http.NewServeMux()
	web, _ := fs.Sub(webFiles, "web")
	server.Handle("/", http.FileServer(http.FS(web)))
	examples, _ := fs.Sub(webFiles, "testdata/examples")
	server.Handle("/examples/", http.StripPrefix("/examples/", http.FileServer(http.FS(examples))))
	server.HandleFunc("/api/language/validate", validateLanguageHandler)
	server.HandleFunc("/api/analyze", analyzeHandler)
	server.HandleFunc("/api/interpretation/validate", validateInterpretationHandler)
	server.HandleFunc("/api/interpretation/generate", generateInterpretationHandler)
	server.HandleFunc("/api/evaluate", evaluateHandler)
	return server
}
