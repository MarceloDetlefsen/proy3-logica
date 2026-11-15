# Despliegue, Docker, WASM y CI/CD

**Propósito:** Documentar los tres modos de ejecución (local, Docker/Podman y GitHub Pages con WebAssembly), el endurecimiento del contenedor, la equivalencia de paquetes TeX, los workflows de GitHub Actions, los pasos manuales en GitHub y la solución de problemas.

## Comparativa de los tres modos de despliegue

| Capacidad | Local (`go run .`) | Contenedor (`Dockerfile` / Compose) | GitHub Pages (`dist/` + WASM) |
| --- | --- | --- | --- |
| Validación, análisis y evaluación | ✅ Go nativo | ✅ Go nativo | ✅ `logic.wasm` en Web Worker |
| Aleatorización de modelos y fórmulas | ✅ | ✅ | ✅ |
| Árbol de explicación y ejemplos | ✅ | ✅ | ✅ |
| Exportación a PDF (`pdflatex`) | ⚠️ Solo si `pdflatex` está instalado | ✅ TeX Live incluido | ❌ Descarga `.tex` (sin servidor) |
| Requisitos en máquina cliente | Go + Node (para compilar TS) | Docker o Podman | Solo navegador moderno |

## Uso de Docker, Docker Compose y Podman

### Con Docker Compose

```bash
docker compose up --build
```

### Con Docker o Podman directamente

```bash
make docker-build
make docker-run
```

O usando la imagen publicada en GHCR:

```bash
docker run --rm -p 8080:8080 ghcr.io/marcelodetlefsen/proy3-logica:latest
```

### Endurecimiento del contenedor y LaTeX

- **Contenedor ([`Dockerfile`](../Dockerfile) y [`docker-compose.yml`](../docker-compose.yml)):** Usuario no root `appuser` (`10001:10001`), raíz en solo lectura (`read_only: true`), `/tmp` montado como `tmpfs` (`rw,noexec,nosuid,size=128m`), `cap_drop: [ALL]`, `no-new-privileges:true`, límite de 512 MiB de RAM y 64 PIDs, `HEALTHCHECK` integrado mediante `-healthcheck` contra `GET /healthz`.
- **LaTeX:** `/etc/texmf/texmf.d/99-hardening.cnf` configura `openin_any = p`, `openout_any = p` y `shell_escape = f`; además [`export_pdf.go`](../export_pdf.go) ejecuta `pdflatex` con `-no-shell-escape`, `-halt-on-error`, `-interaction=nonstopmode`, rutas relativas dentro del directorio temporal y timeout de 30 s.

### Equivalencia de paquetes TeX

| Distribución | Paquetes | Estado de verificación |
| --- | --- | --- |
| Debian (`debian:bookworm-slim`) | `texlive-latex-base`, `texlive-latex-recommended`, `texlive-fonts-recommended` | Verificado compilando PDF real en [`scripts/docker-smoke.sh`](../scripts/docker-smoke.sh) |
| Arch Linux | `texlive-basic`, `texlive-latex`, `texlive-latexrecommended`, `texlive-fontsrecommended` | Dato aportado por el autor (no verificado en esta sesión) |

## Modo estático WebAssembly (GitHub Pages)

- [`cmd/wasm/main.go`](../cmd/wasm/main.go) compila `internal/logic` a `dist/logic.wasm` (`GOOS=js GOARCH=wasm`).
- [`scripts/build-pages.sh`](../scripts/build-pages.sh) copia `wasm_exec.js` desde `$(go env GOROOT)/lib/wasm/`, compila TypeScript, copia `testdata/examples/*.json` a `dist/examples/`, genera `dist/config.js` con `window.PROY3_BACKEND = "wasm";` y crea `dist/.nojekyll`.
- [`web/src/worker.ts`](../web/src/worker.ts) ejecuta `logic.wasm` fuera del hilo principal. [`web/src/api.ts`](../web/src/api.ts) correlaciona peticiones por `id` y aplica un timeout de 10 s (reiniciando el worker si se excede).

## Workflows de GitHub Actions

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): Se ejecuta en `push` y `pull_request` (`permissions: contents: read`). Corre `gofmt`, `go vet` nativo y WASM, `go test -race ./...`, build y smoke test de Pages (`check-pages.sh`, `wasm-smoke.mjs`), `make docs-check` y `scripts/docker-smoke.sh`.
- [`.github/workflows/docker.yml`](../.github/workflows/docker.yml): Se ejecuta en `push` a `main` y tags `v*` (`permissions: contents: read, packages: write`). Publica `ghcr.io/marcelodetlefsen/proy3-logica` con caché GHA.
- [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): Se ejecuta en `push` a `main` y `workflow_dispatch` (`permissions: contents: read, pages: write, id-token: write`, `concurrency: group pages`). Ejecuta pruebas mínimas y despliega `dist/` a GitHub Pages.

## Pasos manuales en GitHub (requeridos una sola vez)

1. **Activar GitHub Pages:** Ir a **Settings → Pages → Build and deployment → Source** y seleccionar **GitHub Actions**.
2. **Permisos de Actions:** En **Settings → Actions → General → Workflow permissions**, asegurar permisos de lectura/escritura o habilitar la ejecución de workflows en el repositorio.
3. **Visibilidad pública del paquete en GHCR:** Tras el primer `push` a `main`, ir al paquete `proy3-logica` en GitHub Packages (**Package settings → Change visibility → Public**) para que `docker pull ghcr.io/marcelodetlefsen/proy3-logica:latest` funcione sin autenticación.

## Cómo revertir y solución de problemas

- **Revertir despliegue de Pages o Docker:** Hacer `git revert <commit>` en `main` y empujar; los workflows reconstruirán automáticamente el estado anterior.
- **Error `404` en recursos de Pages:** Verificar que [`scripts/check-pages.sh`](../scripts/check-pages.sh) pase y que no existan rutas absolutas que inicien con `/`.
- **Error `503` al exportar PDF en local:** `pdflatex` no está en `PATH`; usar Docker o instalar TeX Live.
