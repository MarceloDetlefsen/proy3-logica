CONTAINER_CLI ?= $(shell command -v docker >/dev/null 2>&1 && echo docker || echo podman)
IMAGE_NAME ?= proy3-logica:local

.PHONY: run test bench pages verify-pages docker-build docker-run docs-check e2e e2e-full captures

run:
	npm run build:web
	go run .

test:
	go vet ./...
	go test ./...

bench:
	go test -run=^$$ -bench . -benchmem -count 5 ./...

pages:
	./scripts/build-pages.sh
	./scripts/check-pages.sh

verify-pages:
	./scripts/verify-pages.sh

docker-build:
	$(CONTAINER_CLI) build -t $(IMAGE_NAME) .

docker-run:
	$(CONTAINER_CLI) run --rm -p 8080:8080 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m --cap-drop=ALL --security-opt no-new-privileges:true $(IMAGE_NAME)

docs-check:
	go test -v -run TestDocsLinksAndPaths .

e2e:
	cd e2e && npm run test:fast

e2e-full:
	cd e2e && npm run test:full

captures:
	cd e2e && npm run captures
