.PHONY: api assets build docker ui-check seed

# the version printed by `asynqmon --version`: the git tag (or commit) of the checkout
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

# Build the web UI (Vue 3 + Vite+) into ui/build, which the Go binary embeds.
assets:
	@if [ ! -d ui/node_modules ]; then cd ./ui && npm ci; fi
	cd ./ui && npm run build

# Format, lint and unit tests of the web UI (theme contrast matrix included).
ui-check:
	@if [ ! -d ui/node_modules ]; then cd ./ui && npm ci; fi
	cd ./ui && npm run check && npm test

# Fill a local, throwaway Redis with sample tasks (REDIS_ADDR, default 127.0.0.1:6379).
seed:
	go run ./tools/seed

# This target skips the overhead of building UI assets.
# Intended to be used during development.
api:
	go build -o api ./cmd/asynqmon

# Build a release binary.
build: assets
	go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o asynqmon ./cmd/asynqmon

# Build image and run Asynqmon server (with default settings).
docker:
	docker build -t asynqmon .
	docker run --rm \
		--name asynqmon \
		-p 8080:8080 \
		asynqmon --redis-addr=host.docker.internal:6379
