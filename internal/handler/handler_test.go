package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/omar/bookclub/internal/handler"
	"github.com/omar/bookclub/internal/store"
)

func setupTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	db, err := store.New(dbPath)
	if err != nil {
		t.Fatalf("store.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	h := handler.New(db, "testclub", "testadmin")
	return httptest.NewServer(h)
}

func TestHealthEndpoint(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/testclub/health")
	if err != nil {
		t.Fatalf("GET /api/testclub/health error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", body["status"])
	}
}

func TestSPAFallback(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	// Any path under /testclub/ should return index.html (SPA fallback).
	resp, err := http.Get(srv.URL + "/testclub/")
	if err != nil {
		t.Fatalf("GET /testclub/ error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct != "text/html" {
		t.Errorf("expected Content-Type text/html, got %q", ct)
	}
}

func TestSPAFallback_DeepPath(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	// Deep path should also return index.html.
	resp, err := http.Get(srv.URL + "/testclub/admin/testadmin/")
	if err != nil {
		t.Fatalf("GET error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}
