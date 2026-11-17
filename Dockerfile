ARG GO_VERSION=1.27

# Etapa 1: TypeScript solo es dependencia de construcción, no de ejecución.
FROM node:22-bookworm-slim AS web-builder
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
RUN npm run build:web

# Etapa 2: compila un binario estático que ya contiene web/ mediante go:embed.
FROM golang:${GO_VERSION}-bookworm AS go-builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
COPY --from=web-builder /src/web/build ./web/build
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/proy3-logica .

# Etapa 3: imagen mínima de ejecución con pdflatex para la única función que
# requiere un proceso externo: exportar el documento a PDF.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /etc/texmf/texmf.d \
    && printf "openin_any = p\nopenout_any = p\nshell_escape = f\n" > /etc/texmf/texmf.d/99-hardening.cnf \
    && update-texmf \
    && groupadd -g 10001 -r appuser \
    && useradd -u 10001 -g 10001 -r -s /sbin/nologin appuser

COPY --from=go-builder /out/proy3-logica /usr/local/bin/proy3-logica

# Usuario sin privilegios; /tmp es el único lugar necesario para compilar LaTeX.
WORKDIR /tmp
USER 10001:10001
ENV PORT=8080 ADDR=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/proy3-logica", "-healthcheck"]

ENTRYPOINT ["/usr/local/bin/proy3-logica"]
