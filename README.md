<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.png" />
    <img src="docs/logo-light.png" alt="asynqmon" width="272" />
  </picture>
</p>

# Web UI for monitoring and administering [Asynq](https://github.com/hibiken/asynq) task queues

[![CI](https://github.com/jniltinho/asynqmon/actions/workflows/ci.yml/badge.svg)](https://github.com/jniltinho/asynqmon/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/jniltinho/asynqmon?color=blue)](https://github.com/jniltinho/asynqmon/releases)
[![Go Reference](https://pkg.go.dev/badge/github.com/jniltinho/asynqmon.svg)](https://pkg.go.dev/github.com/jniltinho/asynqmon)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Asynqmon is a web UI for monitoring and administering [Asynq](https://github.com/hibiken/asynq) queues and tasks,
with [Prometheus](https://prometheus.io) integration for time-series charts. It is both a binary you run and a Go
library you mount in your own web application.

This repository continues [hibiken/asynqmon](https://github.com/hibiken/asynqmon) on its own. What it adds:

- **A new web UI** in Vue 3 + [Vite+](https://viteplus.dev) + Tailwind CSS 4, with the same pages, paths and API: a
  queue health overview, a tab per task state with counts, a payload and result viewer, bulk actions behind
  confirmations, sortable tables, loading/empty/error states, keyboard navigation and visible focus.
- **20 themes**, the ones of the [ad-manager](https://github.com/jniltinho/ad-manager) panel (Classic blue XP,
  Grafana, RabbitMQ, Graphite, High contrast…), with a flat look; every theme passes WCAG AA.
- **`Options.Theme`**, so an application that embeds asynqmon can make it follow its own theme.
- **Go 1.27**, the module `github.com/jniltinho/asynqmon`, images on `ghcr.io/jniltinho/asynqmon`.

![Queues dashboard](docs/screenshots/01-dashboard.png)

## Contents

- [Install](#install) · [Run](#run) · [Flags](#flags) · [Redis](#connecting-to-redis) · [Prometheus](#prometheus)
- [The web UI](#the-web-ui) · [Themes](#themes)
- [Use as a library](#use-as-a-library) · [Following the host application's theme](#following-the-host-applications-theme)
- [Development](#development) · [License](#license)

## Install

**Docker image** ([GitHub Container Registry](https://github.com/jniltinho/asynqmon/pkgs/container/asynqmon)):

```bash
docker pull ghcr.io/jniltinho/asynqmon          # latest (master)
docker pull ghcr.io/jniltinho/asynqmon:0.8      # a release line, once tagged
```

**Release binary**: download `asynqmon_<version>_<os>_<arch>.tar.gz` for Linux, macOS or Windows (amd64 or arm64)
from the [releases page](https://github.com/jniltinho/asynqmon/releases), check it against `checksums.txt`, and run
the `asynqmon` binary inside (`asynqmon --version` prints its version):

```bash
tar -xzf asynqmon_v0.8.0_linux_amd64.tar.gz && ./asynqmon_v0.8.0_linux_amd64/asynqmon --version
```

**With Go** (1.27 or higher; the web UI is already built into the module):

```bash
go install github.com/jniltinho/asynqmon/cmd/asynqmon@latest
```

**From source**: Go 1.27+ and [Node.js](https://nodejs.org/) 22.18+ (with npm, for the web UI). `make build` builds
the UI (`npm ci` and `npm run build` in `ui/`, into `ui/build`, which the binary embeds) and then `./asynqmon`.
`make docker` builds the Docker image locally.

### Version compatibility

| Asynq version  | asynqmon version                    |
| -------------- | ----------------------------------- |
| 0.24.x         | this repository (`master`)          |
| 0.23.x         | 0.7.x (hibiken/asynqmon)            |
| 0.22.x         | 0.6.x (hibiken/asynqmon)            |
| 0.20.x, 0.21.x | 0.5.x (hibiken/asynqmon)            |
| 0.19.x         | 0.4.x (hibiken/asynqmon)            |
| 0.18.x         | 0.2.x, 0.3.x (hibiken/asynqmon)     |
| 0.16.x, 0.17.x | 0.1.x (hibiken/asynqmon)            |

## Run

By default asynqmon listens on port `8080` and connects to Redis on `127.0.0.1:6379`; open http://localhost:8080.

```bash
# the binary
./asynqmon

# the Docker image, with Redis on the host
docker run --rm --name asynqmon -p 8080:8080 \
    ghcr.io/jniltinho/asynqmon --redis-addr=host.docker.internal:6379

# the Docker image, with Redis in a container of the network dev-network
docker run --rm --name asynqmon --network dev-network -p 8080:8080 \
    ghcr.io/jniltinho/asynqmon --redis-addr=dev-redis:6379

# another port, Redis on localhost:6380, read-only
./asynqmon --port=3000 --redis-addr=localhost:6380 --read-only
```

## Flags

`./asynqmon --help` (or `docker run ghcr.io/jniltinho/asynqmon --help`) lists them. Every flag can also be set by its
environment variable.

| Flag                              | Env                       | Description                                                                                                                      | Default          |
| --------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `--port` (int)                    | `PORT`                    | port of the web UI server                                                                                                        | 8080             |
| `--redis-url` (string)            | `REDIS_URL`               | URL of a Redis or Sentinel server; see [`asynq.ParseRedisURI`](https://pkg.go.dev/github.com/hibiken/asynq#ParseRedisURI)        | ""               |
| `--redis-addr` (string)           | `REDIS_ADDR`              | address of the Redis server                                                                                                      | "127.0.0.1:6379" |
| `--redis-db` (int)                | `REDIS_DB`                | Redis database number                                                                                                            | 0                |
| `--redis-password` (string)       | `REDIS_PASSWORD`          | password of the Redis server                                                                                                     | ""               |
| `--redis-cluster-nodes` (string)  | `REDIS_CLUSTER_NODES`     | comma-separated host:port addresses of the cluster nodes                                                                         | ""               |
| `--redis-tls` (string)            | `REDIS_TLS`               | server name for TLS validation when connecting to Redis                                                                          | ""               |
| `--redis-insecure-tls` (bool)     | `REDIS_INSECURE_TLS`      | disable the TLS certificate host checks                                                                                          | false            |
| `--max-payload-length` (int)      | `MAX_PAYLOAD_LENGTH`      | maximum number of characters of a payload shown in the task tables                                                               | 200              |
| `--max-result-length` (int)       | `MAX_RESULT_LENGTH`       | maximum number of characters of a result shown in the task tables                                                                | 200              |
| `--enable-metrics-exporter` (bool)| `ENABLE_METRICS_EXPORTER` | expose the queue metrics for Prometheus at `/metrics`                                                                            | false            |
| `--prometheus-addr` (string)      | `PROMETHEUS_ADDR`         | address of the Prometheus server to query for the Metrics page                                                                   | ""               |
| `--read-only` (bool)              | `READ_ONLY`               | view-only mode: the UI hides every action and the API refuses changes                                                            | false            |

Prefer the environment variables for secrets (`REDIS_PASSWORD`, `REDIS_URL`): command-line arguments show in the
process list.

## Connecting to Redis

A **single Redis server**: `--redis-url`, or `--redis-addr`, `--redis-db` and `--redis-password`.

```sh
REDIS_URL=redis://:mypassword@localhost:6380/2 ./asynqmon
./asynqmon --redis-addr=localhost:6380 --redis-db=2   # with REDIS_PASSWORD in the environment
```

**Redis Sentinel**: `--redis-url`.

```sh
REDIS_URL='redis-sentinel://:mypassword@localhost:5000,localhost:5001,localhost:5002?master=mymaster' ./asynqmon
```

**Redis Cluster**: `--redis-cluster-nodes`.

```sh
./asynqmon --redis-cluster-nodes=localhost:7000,localhost:7001,localhost:7002,localhost:7003,localhost:7004,localhost:7005
```

## Prometheus

`--enable-metrics-exporter` exposes the queue metrics at `/metrics` for a Prometheus server to scrape.
`--prometheus-addr` points asynqmon at that Prometheus server and turns on the **Metrics** page: processed and failed
tasks, error rate, queue size, latency and memory, and the pending, retry and archived tasks per queue, over a live or
historical window, for the queues you pick.

```bash
./asynqmon --enable-metrics-exporter --prometheus-addr=http://localhost:9090
```

![Metrics](docs/screenshots/09-metrics.png)

## The web UI

| Page | What it shows |
| --- | --- |
| **Queues** | totals, queue size by state, tasks processed per day, the queue list (sortable, filterable) with pause, resume and delete |
| **Queue** | a tab per task state with its count; task tables with the payload/result viewer, row actions, actions on a selection or on every task of the state, each destructive one behind a confirmation that names the queue, state and group; groups of aggregating tasks; find a task by ID |
| **Task** | every field of a task, its payload and result, and the actions of its state |
| **Servers** | the asynq servers, their queues and priorities, how busy their workers are and the tasks they run now |
| **Schedulers** | the periodic tasks, their next and previous enqueue, and the enqueue history |
| **Redis** | the key numbers and the full `INFO` (or `CLUSTER INFO`), a tab per section, with a filter over all of them |
| **Metrics** | Prometheus time series (with `--prometheus-addr`) |
| **Settings** | theme, flat look, refresh interval and table size, kept in the browser |

![Queue view with a selection and a payload open](docs/screenshots/03-queue-archived-selection.png)

| Task | Servers |
| --- | --- |
| ![Task details](docs/screenshots/05-task-completed.png) | ![Servers](docs/screenshots/06-servers.png) |
| **Schedulers** | **Redis** |
| ![Scheduler entries](docs/screenshots/07-schedulers.png) | ![Redis info](docs/screenshots/08-redis.png) |

## Themes

The 20 themes of the [ad-manager](https://github.com/jniltinho/ad-manager) panel, from the same files
(`ui/src/themes/*.css`, kept identical to the panel's), with square corners and an optional flat look: Default,
ADManager, Breeze, Violet, Aurora and Crystal (each also dark), Cone, Classic blue (XP), Classic gray (98), Graphite,
**Grafana** (the Grafana 11 look), **RabbitMQ** (the RabbitMQ management UI look), Matrix, Winamp, Pink Panther and
High contrast. "Automatic" follows the system (Default on a light system, Grafana on a dark one). Every theme passes
WCAG AA contrast (Classic blue, Crystal and High contrast AAA), checked by the UI tests.

| Grafana | RabbitMQ |
| --- | --- |
| ![Grafana theme](docs/screenshots/12-theme-grafana.png) | ![RabbitMQ theme](docs/screenshots/14-theme-rabbitmq.png) |
| ![Grafana theme, queue view](docs/screenshots/13-theme-grafana-queue.png) | ![RabbitMQ theme, queue view](docs/screenshots/15-theme-rabbitmq-queue.png) |
| **Classic blue (XP)** | **Graphite** |
| ![Classic blue theme](docs/screenshots/11-theme-classic-blue.png) | ![Graphite theme, metrics](docs/screenshots/16-theme-graphite-metrics.png) |

## Use as a library

```bash
go get github.com/jniltinho/asynqmon
```

With [net/http](https://pkg.go.dev/net/http):

```go
package main

import (
	"log"
	"net/http"

	"github.com/hibiken/asynq"
	"github.com/jniltinho/asynqmon"
)

func main() {
	h := asynqmon.New(asynqmon.Options{
		RootPath:     "/monitoring", // the URL path asynqmon is served under
		RedisConnOpt: asynq.RedisClientOpt{Addr: ":6379"},
	})
	defer h.Close()

	// net/http.ServeMux needs the trailing slash
	http.Handle(h.RootPath()+"/", h)

	// open http://localhost:8080/monitoring
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

With [gorilla/mux](https://pkg.go.dev/github.com/gorilla/mux): `r.PathPrefix(h.RootPath()).Handler(h)`. With
[labstack/echo](https://github.com/labstack/echo): `e.Any("/monitoring/*", echo.WrapHandler(h))`.

| Option | Description |
| --- | --- |
| `RootPath` | URL path asynqmon is served under (default `/`) |
| `RedisConnOpt` | the Redis connection (required): `asynq.RedisClientOpt`, `RedisFailoverClientOpt` or `RedisClusterClientOpt` |
| `PayloadFormatter`, `ResultFormatter` | how task payloads and results are shown |
| `PrometheusAddress` | Prometheus server for the Metrics page |
| `ReadOnly` | view-only mode |
| `Theme` | follow the host application's theme (below) |
| `HomeURL`, `HomeLabel` | a link back to the host application at the top right of the header (a path starting with `/` or an http(s) URL; label default `Back`) |

### Following the host application's theme

`Options.Theme` is a `func() (id string, flat bool)` called for every page load. The page is served with that theme
already set (no flash) and the UI hides its theme picker. Ids are the UI's themes (`default`, `classic-blue`,
`grafana`, …, or `auto` to follow the viewer's light or dark system setting); an empty id or one outside `[a-z0-9-]`
gives the default theme. Leave it nil and viewers choose in Settings.

```go
h := asynqmon.New(asynqmon.Options{
	RootPath:     "/monitoring",
	RedisConnOpt: asynq.RedisClientOpt{Addr: ":6379"},
	Theme: func() (string, bool) {
		return currentSettings().Theme, currentSettings().FlatLook // the host's own settings
	},
})
```

## Development

The UI lives in `ui/` (Vue 3, Vite+, Tailwind CSS 4); `ui/README.md` describes its layout. With a throwaway Redis
filled with sample tasks:

```bash
docker run -d --name asynqmon-redis -p 6379:6379 redis:7-alpine
make seed &                       # an asynq server, scheduler and producer with tasks in every state
make api && ./api &               # the API on :8080 (no UI build needed)
cd ui && npm ci && npm run dev    # the UI on http://localhost:3000, /api proxied to :8080
```

| Command | What it does |
| --- | --- |
| `go test ./...` | Go tests |
| `make ui-check` | UI format, lint and unit tests (helpers, themes, WCAG contrast matrix) |
| `make build` | the UI into `ui/build` (committed: `go get` users embed it) and the binary |
| `npm run screenshots` (in `ui/`) | retakes `docs/screenshots` at 2× against a running asynqmon (`ASYNQMON_URL`); fails on any console error or failed request |
| `THEME_MATRIX=<dir> npm run screenshots` | every page in every theme, normal and flat |

CI runs the Go and UI checks, verifies that the committed `ui/build` matches the source, runs CodeQL and builds the
Docker image (pushed to `ghcr.io` from `master` and `v*` tags).

**Releasing**: rename `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD` (with a new empty
`## [Unreleased]` above it), merge, then tag and push:

```bash
git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
```

The release workflow runs the CI, builds the `.tar.gz` for Linux, macOS and Windows on amd64 and arm64 (binary,
LICENSE, README, CHANGELOG), and publishes a GitHub release with `checksums.txt` and that version's CHANGELOG notes;
the Docker image gets the `X.Y.Z` and `X.Y` tags.

## License

MIT, see [LICENSE](LICENSE). Based on [hibiken/asynqmon](https://github.com/hibiken/asynqmon), copyright (c)
2019-present [Ken Hibino](https://github.com/hibiken) and [contributors](https://github.com/hibiken/asynqmon/graphs/contributors).
The original logo by [Vic Shóstak](https://github.com/koddr) (CC0 1.0) was replaced by a new mark in this repository.
