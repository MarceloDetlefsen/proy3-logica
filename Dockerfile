ARG GO_VERSION=1.27

FROM node:22-bookworm-slim AS web-builder
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
RUN npm run build:web

FROM golang:${GO_VERSION}-bookworm AS go-builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
COPY --from=web-builder /src/web/build ./web/build
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/proy3-logica .

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

WORKDIR /tmp
USER 10001:10001
ENV PORT=8080 ADDR=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/proy3-logica", "-healthcheck"]

ENTRYPOINT ["/usr/local/bin/proy3-logica"]
