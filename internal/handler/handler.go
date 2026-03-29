package handler

import (
	"database/sql"
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/omar/bookclub/internal/model"
	"github.com/omar/bookclub/internal/store"
)

// Static holds the embedded frontend assets.
//
//go:embed all:frontend
var Static embed.FS

// New creates the root HTTP handler with API routes and SPA serving.
func New(db *sql.DB, clubSecret, adminSecret string) http.Handler {
	mux := http.NewServeMux()

	ps := store.NewParticipantStore(db)
	ss := store.NewSettingsStore(db)

	// API routes.
	apiPrefix := "/api/" + clubSecret + "/"
	adminPrefix := apiPrefix + "admin/" + adminSecret + "/"

	mux.HandleFunc(apiPrefix+"health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// User API: list participants.
	mux.HandleFunc(apiPrefix+"participants", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		participants, err := ps.List()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list participants")
			return
		}
		if participants == nil {
			participants = []model.Participant{}
		}
		writeJSON(w, http.StatusOK, participants)
	})

	// Admin API: CRUD participants.
	mux.HandleFunc(adminPrefix+"participants", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			participants, err := ps.List()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to list participants")
				return
			}
			if participants == nil {
				participants = []model.Participant{}
			}
			writeJSON(w, http.StatusOK, participants)
		case http.MethodPost:
			var req struct {
				Name string `json:"name"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Name = strings.TrimSpace(req.Name)
			if req.Name == "" {
				writeError(w, http.StatusBadRequest, "name is required")
				return
			}
			if len(req.Name) > 100 {
				writeError(w, http.StatusBadRequest, "name too long (max 100 chars)")
				return
			}
			p, err := ps.Create(req.Name)
			if err != nil {
				if strings.Contains(err.Error(), "UNIQUE") {
					writeError(w, http.StatusConflict, "participant already exists")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to create participant")
				return
			}
			writeJSON(w, http.StatusCreated, p)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc(adminPrefix+"participants/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		// Extract ID from path: .../participants/{id}
		idStr := strings.TrimPrefix(r.URL.Path, adminPrefix+"participants/")
		id := 0
		for _, c := range idStr {
			if c < '0' || c > '9' {
				writeError(w, http.StatusBadRequest, "invalid participant ID")
				return
			}
			id = id*10 + int(c-'0')
		}
		if id == 0 {
			writeError(w, http.StatusBadRequest, "invalid participant ID")
			return
		}
		err := ps.Delete(id)
		if err != nil {
			if err == sql.ErrNoRows {
				writeError(w, http.StatusNotFound, "participant not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to delete participant")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Admin API: settings.
	mux.HandleFunc(adminPrefix+"settings", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			s, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			writeJSON(w, http.StatusOK, s)
		case http.MethodPut:
			var req model.Settings
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.VotingState != "open" && req.VotingState != "revealed" {
				writeError(w, http.StatusBadRequest, "voting_state must be 'open' or 'revealed'")
				return
			}
			if req.CreditBudget < 1 {
				writeError(w, http.StatusBadRequest, "credit_budget must be positive")
				return
			}
			if err := ss.Update(&req); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to update settings")
				return
			}
			s, _ := ss.Get()
			writeJSON(w, http.StatusOK, s)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// Serve embedded SPA for club paths.
	frontendFS, _ := fs.Sub(Static, "frontend")

	clubPrefix := "/" + clubSecret + "/"
	mux.HandleFunc(clubPrefix, func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, clubPrefix)

		// Try to serve as a static asset. The SPA is served at varying
		// depths (/{club}/, /{club}/admin/{admin}/), so relative asset
		// paths like ./assets/foo.js resolve to different URL prefixes.
		// We try the path as-is first, then strip leading directories
		// to find "assets/..." in the embedded FS.
		if path != "" {
			if serveStaticFile(w, frontendFS, path) {
				return
			}
			if idx := strings.Index(path, "assets/"); idx > 0 {
				if serveStaticFile(w, frontendFS, path[idx:]) {
					return
				}
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

// serveStaticFile tries to read and serve a file from the given FS.
// Returns true if the file was found and served.
func serveStaticFile(w http.ResponseWriter, fsys fs.FS, path string) bool {
	f, err := fs.ReadFile(fsys, path)
	if err != nil {
		return false
	}
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
	return true
}
