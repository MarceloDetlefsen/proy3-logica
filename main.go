package main

import (
	"embed"
	"log"
	"net/http"
)

//go:embed web
var webFiles embed.FS

func main() {
	server := newServer()

	log.Println("proy3-logica escuchando en http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", server))
}

func newServer() http.Handler {
	server := http.NewServeMux()
	server.Handle("/", http.FileServer(http.FS(webFiles)))
	server.HandleFunc("/api/language/validate", validateLanguageHandler)
	server.HandleFunc("/api/analyze", analyzeHandler)
	return server
}
