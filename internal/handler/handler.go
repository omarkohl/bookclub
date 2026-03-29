package handler

import (
	"database/sql"
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

// Static holds the embedded frontend assets.
//
//go:embed all:frontend
var Static embed.FS

// New creates the root HTTP handler with API routes and SPA serving.
func New(db *sql.DB, clubSecret, adminSecret string) http.Handler {
	mux := http.NewServeMux()

	// API routes.
	apiPrefix := "/api/" + clubSecret + "/"
	mux.HandleFunc(apiPrefix+"health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve embedded SPA for club and admin paths.
	frontendFS, _ := fs.Sub(Static, "frontend")

	// SPA fallback: serve index.html for any path under /{club_secret}/ that
	// doesn't match a static asset.
	clubPrefix := "/" + clubSecret + "/"
	mux.HandleFunc(clubPrefix, func(w http.ResponseWriter, r *http.Request) {
		// Strip the club prefix to get the asset path.
		path := strings.TrimPrefix(r.URL.Path, clubPrefix)

		// Try to serve as a static file first.
		if path != "" {
			if f, err := frontendFS.(fs.ReadFileFS).ReadFile(path); err == nil {
				// Determine content type from extension.
				ct := "application/octet-stream"
				switch {
				case strings.HasSuffix(path, ".js"):
					ct = "application/javascript"
				case strings.HasSuffix(path, ".css"):
					ct = "text/css"
				case strings.HasSuffix(path, ".html"):
					ct = "text/html"
				case strings.HasSuffix(path, ".svg"):
					ct = "image/svg+xml"
				case strings.HasSuffix(path, ".png"):
					ct = "image/png"
				case strings.HasSuffix(path, ".ico"):
					ct = "image/x-icon"
				case strings.HasSuffix(path, ".json"):
					ct = "application/json"
				case strings.HasSuffix(path, ".woff2"):
					ct = "font/woff2"
				case strings.HasSuffix(path, ".woff"):
					ct = "font/woff"
				}
				w.Header().Set("Content-Type", ct)
				_, _ = w.Write(f)
				return
			}
		}

		// SPA fallback: serve index.html.
		index, err := fs.ReadFile(frontendFS, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write(index)
	})

	return mux
}
