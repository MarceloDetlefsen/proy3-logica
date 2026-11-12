package main

import (
	"embed"
	"log"
	"net/http"
)

//go:embed web
var webFiles embed.FS

func main() {
	server := http.FileServer(http.FS(webFiles))

	log.Println("proy3-logica escuchando en http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", server))
}
