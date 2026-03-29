package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/omar/bookclub/internal/handler"
	"github.com/omar/bookclub/internal/model"
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
		t.Fatalf("GET error: %v", err)
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

	resp, err := http.Get(srv.URL + "/testclub/")
	if err != nil {
		t.Fatalf("GET error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "text/html" {
		t.Errorf("expected text/html, got %q", ct)
	}
}

func TestSPAFallback_DeepPath(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/testclub/admin/testadmin/")
	if err != nil {
		t.Fatalf("GET error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestSPAFallback_AssetFromDeepPath(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	// First, find out what asset files exist by checking index.html
	resp, err := http.Get(srv.URL + "/testclub/")
	if err != nil {
		t.Fatalf("GET error: %v", err)
	}
	defer resp.Body.Close()
	// The embedded frontend has index.html; request an asset from a deep path
	// simulating what the browser does when SPA is loaded at /testclub/admin/testadmin/
	resp2, err := http.Get(srv.URL + "/testclub/admin/testadmin/assets/nonexistent.js")
	if err != nil {
		t.Fatalf("GET error: %v", err)
	}
	defer resp2.Body.Close()
	// Since the file doesn't exist, it should fall back to index.html
	if ct := resp2.Header.Get("Content-Type"); ct != "text/html" {
		t.Errorf("expected SPA fallback text/html for nonexistent asset, got %q", ct)
	}
}

func TestAdminParticipants_CRUD(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	// List empty
	resp, _ := http.Get(base + "participants")
	var list []model.Participant
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 0 {
		t.Fatalf("expected empty list, got %d", len(list))
	}

	// Create
	body := bytes.NewBufferString(`{"name":"Alice"}`)
	resp, _ = http.Post(base+"participants", "application/json", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	var alice model.Participant
	json.NewDecoder(resp.Body).Decode(&alice)
	resp.Body.Close()
	if alice.Name != "Alice" {
		t.Errorf("expected Alice, got %q", alice.Name)
	}

	// Create another
	body = bytes.NewBufferString(`{"name":"Bob"}`)
	resp, _ = http.Post(base+"participants", "application/json", body)
	resp.Body.Close()

	// List should have 2
	resp, _ = http.Get(base + "participants")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 2 {
		t.Fatalf("expected 2, got %d", len(list))
	}

	// Delete Alice
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%sparticipants/%d", base, alice.ID), nil)
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}

	// List should have 1
	resp, _ = http.Get(base + "participants")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1, got %d", len(list))
	}
}

func TestAdminParticipants_DuplicateName(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	body := bytes.NewBufferString(`{"name":"Alice"}`)
	resp, _ := http.Post(base+"participants", "application/json", body)
	resp.Body.Close()

	body = bytes.NewBufferString(`{"name":"Alice"}`)
	resp, _ = http.Post(base+"participants", "application/json", body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp.StatusCode)
	}
}

func TestAdminParticipants_EmptyName(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	body := bytes.NewBufferString(`{"name":"  "}`)
	resp, _ := http.Post(base+"participants", "application/json", body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestAdminParticipants_DeleteNonexistent(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	req, _ := http.NewRequest(http.MethodDelete, base+"participants/999", nil)
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUserParticipants_ListOnly(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()

	// User can list
	resp, _ := http.Get(srv.URL + "/api/testclub/participants")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// User cannot POST
	body := bytes.NewBufferString(`{"name":"Alice"}`)
	resp, _ = http.Post(srv.URL+"/api/testclub/participants", "application/json", body)
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestAdminSettings_GetAndUpdate(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	// Get defaults
	resp, _ := http.Get(base + "settings")
	var s model.Settings
	json.NewDecoder(resp.Body).Decode(&s)
	resp.Body.Close()
	if s.CreditBudget != 100 {
		t.Errorf("expected 100, got %d", s.CreditBudget)
	}
	if s.VotingState != "open" {
		t.Errorf("expected open, got %q", s.VotingState)
	}

	// Update
	body := bytes.NewBufferString(`{"credit_budget":200,"voting_state":"revealed","pins_enabled":false}`)
	req, _ := http.NewRequest(http.MethodPut, base+"settings", body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	json.NewDecoder(resp.Body).Decode(&s)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if s.CreditBudget != 200 {
		t.Errorf("expected 200, got %d", s.CreditBudget)
	}
	if s.VotingState != "revealed" {
		t.Errorf("expected revealed, got %q", s.VotingState)
	}
}

func TestAdminSettings_InvalidVotingState(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	base := srv.URL + "/api/testclub/admin/testadmin/"

	body := bytes.NewBufferString(`{"credit_budget":100,"voting_state":"invalid","pins_enabled":false}`)
	req, _ := http.NewRequest(http.MethodPut, base+"settings", body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}
