package main

import (
	"embed"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// El binario incluye interfaz y ejemplos: en producción no necesita una carpeta
// pública separada ni rutas absolutas dependientes del sistema anfitrión.
//
//go:embed web testdata/examples
var webFiles embed.FS

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Verifica /healthz en el puerto configurado y termina")
	flag.Parse()

	addr := listenAddress()
	if *healthcheck {
		os.Exit(runHealthcheck(addr))
	}

	server := newServer()
	log.Printf("proy3-logica escuchando en %s", addr)
	log.Fatal(http.ListenAndServe(addr, server))
}

func listenAddress() string {
	// ADDR tiene prioridad; PORT facilita plataformas que solo inyectan el número.
	if addr := strings.TrimSpace(os.Getenv("ADDR")); addr != "" {
		return addr
	}
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		if strings.HasPrefix(port, ":") {
			return port
		}
		return ":" + port
	}
	return ":8080"
}

func runHealthcheck(addr string) int {
	// Docker puede comprobar salud con el propio binario, sin instalar curl/wget.
	port := "8080"
	if idx := strings.LastIndex(addr, ":"); idx >= 0 && idx+1 < len(addr) {
		port = addr[idx+1:]
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func newServer() http.Handler {
	// Los adaptadores HTTP delegan la lógica a internal/logic; el servidor solo
	// se ocupa de transporte, archivos estáticos y códigos de estado.
	server := http.NewServeMux()
	web, _ := fs.Sub(webFiles, "web")
	server.Handle("/", http.FileServer(http.FS(web)))
	examples, _ := fs.Sub(webFiles, "testdata/examples")
	server.Handle("/examples/", http.StripPrefix("/examples/", http.FileServer(http.FS(examples))))
	server.HandleFunc("/healthz", healthzHandler)
	server.HandleFunc("/api/language/validate", validateLanguageHandler)
	server.HandleFunc("/api/analyze", analyzeHandler)
	server.HandleFunc("/api/interpretation/validate", validateInterpretationHandler)
	server.HandleFunc("/api/interpretation/generate", generateInterpretationHandler)
	server.HandleFunc("/api/evaluate", evaluateHandler)
	server.HandleFunc("/api/models/search", searchModelsHandler)
	server.HandleFunc("/api/evaluate/export/pdf", exportEvaluationPDFHandler)
	return server
}

func healthzHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writeAPIError(writer, http.StatusMethodNotAllowed, "Método no permitido. Use GET.")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}
