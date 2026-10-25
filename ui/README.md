# Asynqmon web UI

Vue 3 + [Vite+](https://viteplus.dev) (`vp`) + Tailwind CSS 4. `npm run build` writes `build/`, which the Go handler
embeds (`handler.go`) and serves through `static.go`: `build/index.html` is a Go template (delimiters `/[[` `]]`) that
receives the root path, the Prometheus address and the read-only flag.

| Command               | What it does                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm ci`              | install (also writes `node_modules/go.mod`, so `go test ./...` skips the Go code some packages ship) |
| `npm run dev`         | dev server on :3000, `/api` proxied to `ASYNQMON_URL` (default `http://127.0.0.1:8080`)              |
| `npm run build`       | production build into `build/`                                                                       |
| `npm run check`       | format and lint                                                                                      |
| `npm test`            | unit tests: helpers and the themes (structure, dark themes complete, WCAG contrast matrix)           |
| `npm run screenshots` | 2× screenshots of every page into `../docs/screenshots`, failing on console errors                   |

Layout: `src/api.js` (every API call), `src/pages/*` (one per route, the same paths as the earlier React UI),
`src/components/*`, `src/style.css` (the role contract and the component recipes) and `src/themes/*` (one block of
role values per theme, `registry.js` lists them). Components use role utilities only (`text-fg`, `bg-surface`…),
never literal colors; the theme tests enforce it.
