# Exportación a PDF y LaTeX

**Propósito:** Documentar el flujo de generación de documentos LaTeX (`.tex`) y compilación a PDF con `pdflatex`, los paquetes TeX requeridos en Arch y Debian, el endurecimiento aplicado y las limitaciones detectadas.

## Flujo de exportación

1. **En modo servidor (`PROY3_BACKEND="http"`):**
   - El cliente envía `POST api/evaluate/export/pdf` a `exportEvaluationPDFHandler` en [`api.go`](../api.go) (límite de cuerpo: 2 MiB con `http.MaxBytesReader`).
   - Se revalida y evalúa la petición con `logic.EvaluateFormula`. Si hay errores, responde `422` con el JSON de errores.
   - `compileEvaluationPDF` en [`export_pdf.go`](../export_pdf.go) verifica el ejecutable `LATEX_COMPILER` (por defecto `pdflatex`); si falta, devuelve `503` (`errLatexUnavailable`).
   - Crea un directorio temporal (`os.MkdirTemp("", "proy3-latex-")`) con limpieza diferida (`defer os.RemoveAll`), escribe `resolucion.tex` generado por `logic.EvaluationTeX` ([`internal/logic/tex.go`](../internal/logic/tex.go)) y ejecuta `pdflatex` con timeout de 30 s, `-interaction=nonstopmode`, `-halt-on-error`, `-no-shell-escape` y `-output-directory . resolucion.tex`.
   - Verifica que `resolucion.pdf` exista, no esté vacío y pese $\le 20\text{ MiB}$.
2. **En modo estático (`PROY3_BACKEND="wasm"`):**
   - `WasmTransport.exportDocument` llama a `exportEvaluationTeX` en [`cmd/wasm/main.go`](../cmd/wasm/main.go), que invoca `logic.EvaluationTeX` y descarga `resolucion-semantica.tex` en el navegador, informando que el PDF requiere el servidor Docker.

## Paquetes LaTeX requeridos

La plantilla en `EvaluationTeX` usa: `\documentclass[11pt]{article}`, `inputenc` (`utf8`), `fontenc` (`T1`), `geometry` (`a4paper,margin=2.2cm`), `amsmath` y `amssymb`.

- **Debian (`debian:bookworm-slim`, verificado en Docker):** `texlive-latex-base`, `texlive-latex-recommended` y `texlive-fonts-recommended`.
- **Arch Linux (instalación aportada por el autor, no verificada en esta sesión):** `sudo pacman -S texlive-basic texlive-latex texlive-latexrecommended texlive-fontsrecommended`.

## Endurecimiento y escape de caracteres

- **Endurecimiento en contenedor ([`Dockerfile`](../Dockerfile)):** `/etc/texmf/texmf.d/99-hardening.cnf` fija `openin_any = p`, `openout_any = p` y `shell_escape = f` (aplicado con `update-texmf`), además de correr como usuario no root (`10001:10001`) con sistema de archivos raíz en solo lectura y `/tmp` en `tmpfs` (`noexec,nosuid`).
- **Escape en código:** `texEscape` en [`internal/logic/tex.go`](../internal/logic/tex.go) escapa `\`, `{`, `}`, `#`, `$`, `%`, `&`, `_`, `^`, `~` y convierte conectivos Unicode a `\ensuremath{...}`. `texMath` mapea conectivos a comandos matemáticos (`\forall`, `\exists`, `\neg`, `\land`, `\lor`, `\to`, `\leftrightarrow`).
- **Limitación detectada en auditoría:** En `texMath`, un identificador válido con dos o más guiones bajos no iniciales (p. ej. `x_1_2`) se transforma en `x_{1}_{2}`, lo cual produce error `Double subscript` en `pdflatex`.
