package asynqmon

import (
	"io/fs"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUIAssetsHandler(t *testing.T) {
	h := &uiAssetsHandler{
		rootPath:      "/monitoring",
		contents:      staticContents,
		staticDirPath: "ui/build",
		indexFileName: "index.html",
		readOnly:      true,
	}

	// index.html is a template: links and flags get the root path, deep routes get the index too
	for _, path := range []string{"/monitoring/", "/monitoring/queues/default"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		body := rec.Body.String()
		if rec.Code != 200 || !strings.Contains(body, `src="/monitoring/assets/`) || strings.Contains(body, "/[[") {
			t.Fatalf("GET %s: code %d, index not rendered with the root path:\n%s", path, rec.Code, body)
		}
	}

	// assets are served with the type of their extension (a stylesheet or a module script with another type is refused)
	assets, err := fs.ReadDir(staticContents, "ui/build/assets")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml"}
	seen := map[string]bool{}
	for _, a := range assets {
		for ext, ct := range want {
			if !strings.HasSuffix(a.Name(), ext) || seen[ext] {
				continue
			}
			seen[ext] = true
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest("GET", "/monitoring/assets/"+a.Name(), nil))
			if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, ct) {
				t.Errorf("%s: Content-Type %q, want %s", a.Name(), got, ct)
			}
		}
	}
	if len(seen) != len(want) {
		t.Errorf("assets checked %v, want one of each of %v", seen, want)
	}
}

func TestUIAssetsHandlerTheme(t *testing.T) {
	page := func(theme func() (string, bool)) string {
		h := &uiAssetsHandler{contents: staticContents, staticDirPath: "ui/build", indexFileName: "index.html", theme: theme}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
		return rec.Body.String()
	}
	tests := []struct {
		desc  string
		theme func() (string, bool)
		want  string
	}{
		{"standalone: the default theme, the viewer picks", nil, `data-theme="default" data-flat="false" data-host-theme="false"`},
		{"host theme and flat look", func() (string, bool) { return "classic-blue", true }, `data-theme="classic-blue" data-flat="true" data-host-theme="true"`},
		{"an id outside [a-z0-9-] gives the default", func() (string, bool) { return `x" onload="alert(1)`, false }, `data-theme="default" data-flat="false" data-host-theme="true"`},
		{"an empty id gives the default", func() (string, bool) { return "", false }, `data-theme="default" data-flat="false" data-host-theme="true"`},
	}
	for _, tc := range tests {
		if body := page(tc.theme); !strings.Contains(body, tc.want) {
			t.Errorf("%s: want %s in\n%s", tc.desc, tc.want, body[:min(len(body), 400)])
		}
	}
}
