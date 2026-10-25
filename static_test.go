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
