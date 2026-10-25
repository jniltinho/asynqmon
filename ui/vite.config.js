import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The asynqmon SPA.
// - vp build → build/ (embedded in the Go binary through go:embed in handler.go)
// - vp dev   → proxies /api to a running asynqmon (default 127.0.0.1:8080, ASYNQMON_URL to change it)
//
// The Go server renders build/index.html as a template with the "/[[" "]]" delimiters (static.go). Assets are built
// with a relative base, so chunks and fonts load relative to their own file whatever --root-path is; only the
// index.html links (resolved against the page URL, which may be a deep route) get the root path from the template.
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'asynqmon-root-path',
      apply: 'build',
      transformIndexHtml: { order: 'post', handler: (html) => html.replaceAll(/(href|src)="\.\//g, '$1="/[[.RootPath]]/') },
    },
  ],
  build: { outDir: 'build', emptyOutDir: true, chunkSizeWarningLimit: 600 },
  server: { port: 3000, proxy: { '/api': { target: process.env.ASYNQMON_URL || 'http://127.0.0.1:8080', changeOrigin: true } } },
  test: { environment: 'node', include: ['src/**/*.test.js', 'tests/unit/**/*.test.mjs'] },
  fmt: { singleQuote: true, semi: false, printWidth: 140, ignorePatterns: ['build/**'] },
  lint: { ignorePatterns: ['build/**'] },
})
