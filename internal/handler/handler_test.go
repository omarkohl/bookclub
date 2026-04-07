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

	h := handler.New(db, "testclub", "testadmin", "test", "2000-01-01")
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

func TestAdminSettings_CreditBudgetClearsOverBudgetVotes(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice and Bob nominate books
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var aliceBook model.Book
	json.NewDecoder(resp.Body).Decode(&aliceBook)
	resp.Body.Close()

	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Neuromancer","authors":"William Gibson","participant_id":%d}`, bob.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	var bobBook model.Book
	json.NewDecoder(resp.Body).Decode(&bobBook)
	resp.Body.Close()

	// Alice votes 80 credits (within default 100 budget)
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":50},{"book_id":%d,"credits":30}]}`,
		alice.ID, aliceBook.ID, bobBook.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	// Bob votes 40 credits
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":40}]}`,
		bob.ID, aliceBook.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	// Admin lowers budget to 50 — Alice (80) is over, Bob (40) is fine
	body = bytes.NewBufferString(`{"credit_budget":50,"voting_state":"open","pins_enabled":false}`)
	req, _ := http.NewRequest(http.MethodPut, admin+"settings", body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	var settingsResp struct {
		CreditBudget  int `json:"credit_budget"`
		AffectedUsers int `json:"affected_users"`
	}
	json.NewDecoder(resp.Body).Decode(&settingsResp)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if settingsResp.CreditBudget != 50 {
		t.Errorf("expected budget 50, got %d", settingsResp.CreditBudget)
	}
	if settingsResp.AffectedUsers != 1 {
		t.Errorf("expected 1 affected user, got %d", settingsResp.AffectedUsers)
	}

	// Alice's votes should be cleared
	resp, _ = http.Get(fmt.Sprintf("%svotes?participant_id=%d", user, alice.ID))
	var aliceVotes []model.Vote
	json.NewDecoder(resp.Body).Decode(&aliceVotes)
	resp.Body.Close()
	if len(aliceVotes) != 0 {
		t.Errorf("expected 0 alice votes, got %d", len(aliceVotes))
	}

	// Bob's votes should remain
	resp, _ = http.Get(fmt.Sprintf("%svotes?participant_id=%d", user, bob.ID))
	var bobVotes []model.Vote
	json.NewDecoder(resp.Body).Decode(&bobVotes)
	resp.Body.Close()
	if len(bobVotes) != 1 {
		t.Errorf("expected 1 bob vote, got %d", len(bobVotes))
	}
}

func TestAdminSettings_BudgetPreview(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Nominate books and vote
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":80}]}`, alice.ID, book.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":40}]}`, bob.ID, book.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	// Preview: budget=50 should affect Alice (80) but not Bob (40)
	resp, _ = http.Get(admin + "settings/budget-preview?budget=50")
	var preview struct {
		AffectedUsers int `json:"affected_users"`
	}
	json.NewDecoder(resp.Body).Decode(&preview)
	resp.Body.Close()
	if preview.AffectedUsers != 1 {
		t.Errorf("expected 1 affected, got %d", preview.AffectedUsers)
	}

	// Preview: budget=100 should affect nobody
	resp, _ = http.Get(admin + "settings/budget-preview?budget=100")
	json.NewDecoder(resp.Body).Decode(&preview)
	resp.Body.Close()
	if preview.AffectedUsers != 0 {
		t.Errorf("expected 0 affected, got %d", preview.AffectedUsers)
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

// --- Book endpoints ---

func createParticipant(t *testing.T, base, name string) model.Participant {
	t.Helper()
	body := bytes.NewBufferString(fmt.Sprintf(`{"name":%q}`, name))
	resp, _ := http.Post(base+"participants", "application/json", body)
	var p model.Participant
	json.NewDecoder(resp.Body).Decode(&p)
	resp.Body.Close()
	return p
}

func TestUserBooks_NominateAndList(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// List empty
	resp, _ := http.Get(user + "books")
	var list []model.Book
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 0 {
		t.Fatalf("expected empty list, got %d", len(list))
	}

	// Nominate
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","description":"Sci-fi","participant_id":%d}`, alice.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()
	if book.Title != "Dune" {
		t.Errorf("expected Dune, got %q", book.Title)
	}
	if book.Status != "nominated" {
		t.Errorf("expected nominated, got %q", book.Status)
	}

	// List should have 1
	resp, _ = http.Get(user + "books")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1, got %d", len(list))
	}

	// Get by ID
	resp, _ = http.Get(fmt.Sprintf("%sbooks/%d", user, book.ID))
	var got model.Book
	json.NewDecoder(resp.Body).Decode(&got)
	resp.Body.Close()
	if got.Title != "Dune" {
		t.Errorf("expected Dune, got %q", got.Title)
	}
}

func TestUserBooks_ReplacesOldNomination(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// First nomination
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	resp.Body.Close()

	// Second nomination replaces first
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Neuromancer","authors":"William Gibson","participant_id":%d}`, alice.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Only one nominated book
	resp, _ = http.Get(user + "books")
	var list []model.Book
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1 nominated, got %d", len(list))
	}
	if list[0].Title != "Neuromancer" {
		t.Errorf("expected Neuromancer, got %q", list[0].Title)
	}

	// Old one should be in backlog
	resp, _ = http.Get(user + "backlog")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1 backlog, got %d", len(list))
	}
	if list[0].Title != "Dune" {
		t.Errorf("expected Dune in backlog, got %q", list[0].Title)
	}
}

func TestUserBooks_DeleteOwnNomination(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%sbooks/%d", user, book.ID), nil)
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}
}

func TestUserBooks_NominationBlockedWhenRevealed(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// Set voting to revealed
	body := bytes.NewBufferString(`{"credit_budget":100,"voting_state":"revealed","pins_enabled":false}`)
	req, _ := http.NewRequest(http.MethodPut, admin+"settings", body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()

	// Try to nominate
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestUserBooks_NominateFromBacklog(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// Add to backlog
	body := bytes.NewBufferString(`{"title":"Dune","authors":"Frank Herbert"}`)
	resp, _ := http.Post(user+"backlog", "application/json", body)
	var backlogBook model.Book
	json.NewDecoder(resp.Body).Decode(&backlogBook)
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	// Nominate from backlog
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"book_id":%d,"participant_id":%d}`, backlogBook.ID, alice.ID))
	resp, _ = http.Post(user+"books/nominate-from-backlog", "application/json", body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var nominated model.Book
	json.NewDecoder(resp.Body).Decode(&nominated)
	resp.Body.Close()
	if nominated.Status != "nominated" {
		t.Errorf("expected nominated, got %q", nominated.Status)
	}
}

func TestUserBooks_BacklogCRUD(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	user := srv.URL + "/api/testclub/"

	// List empty backlog
	resp, _ := http.Get(user + "backlog")
	var list []model.Book
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 0 {
		t.Fatalf("expected empty backlog, got %d", len(list))
	}

	// Add to backlog
	body := bytes.NewBufferString(`{"title":"Dune","authors":"Frank Herbert"}`)
	resp, _ = http.Post(user+"backlog", "application/json", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// List backlog
	resp, _ = http.Get(user + "backlog")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1, got %d", len(list))
	}

	// Delete backlog book (should work even when voting is revealed)
	bookID := list[0].ID
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%sbooks/%d", user, bookID), nil)
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 for backlog delete, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Verify backlog is empty
	resp, _ = http.Get(user + "backlog")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 0 {
		t.Fatalf("expected empty backlog after delete, got %d", len(list))
	}
}

func TestUserBooks_ValidationErrors(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// Missing title
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing title, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Missing authors
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","participant_id":%d}`, alice.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing authors, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Missing participant_id
	body = bytes.NewBufferString(`{"title":"Dune","authors":"Frank Herbert"}`)
	resp, _ = http.Post(user+"books", "application/json", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing participant_id, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestAdminBooks_ListDeleteMoveToBacklog(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice nominates
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var aliceBook model.Book
	json.NewDecoder(resp.Body).Decode(&aliceBook)
	resp.Body.Close()

	// Bob nominates
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Neuromancer","authors":"William Gibson","participant_id":%d}`, bob.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	resp.Body.Close()

	// Admin lists all books
	resp, _ = http.Get(admin + "books")
	var list []model.Book
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 2 {
		t.Fatalf("expected 2 books, got %d", len(list))
	}

	// Admin moves Alice's book to backlog
	req, _ := http.NewRequest(http.MethodPost,
		fmt.Sprintf("%sbooks/%d/move-to-backlog", admin, aliceBook.ID), nil)
	resp, _ = http.DefaultClient.Do(req)
	var moved model.Book
	json.NewDecoder(resp.Body).Decode(&moved)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if moved.Status != "backlog" {
		t.Errorf("expected backlog, got %q", moved.Status)
	}

	// Admin deletes the backlog book
	req, _ = http.NewRequest(http.MethodDelete,
		fmt.Sprintf("%sbooks/%d", admin, aliceBook.ID), nil)
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}

	// Only Bob's book remains
	resp, _ = http.Get(admin + "books")
	json.NewDecoder(resp.Body).Decode(&list)
	resp.Body.Close()
	if len(list) != 1 {
		t.Fatalf("expected 1, got %d", len(list))
	}
}

func TestAdminBooks_NominateForUser(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"

	alice := createParticipant(t, admin, "Alice")

	// Admin creates nomination for Alice
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(admin+"books/nominate-for-user", "application/json", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()
	if book.Title != "Dune" || book.Status != "nominated" {
		t.Errorf("unexpected book: %+v", book)
	}
}

func TestAdminBooks_DeleteNonexistent(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"

	req, _ := http.NewRequest(http.MethodDelete, admin+"books/999", nil)
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUserBooks_EditOwnNomination(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	// Create nomination
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","description":"Old desc","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Alice edits her own book (participant_id required for nominated books)
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune Messiah","authors":"Frank Herbert","description":"New desc","link":"https://new.com","participant_id":%d}`, alice.ID))
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", user, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var updated model.Book
	json.NewDecoder(resp.Body).Decode(&updated)
	resp.Body.Close()

	if updated.Title != "Dune Messiah" {
		t.Errorf("expected Dune Messiah, got %q", updated.Title)
	}
	if updated.Description != "New desc" {
		t.Errorf("expected New desc, got %q", updated.Description)
	}
	if updated.Status != "nominated" {
		t.Errorf("expected nominated, got %q", updated.Status)
	}
}

func TestUserBooks_CannotEditOthersNomination(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice nominates
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Bob tries to edit Alice's nomination — should fail
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Changed","authors":"Changed","participant_id":%d}`, bob.ID))
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", user, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestUserBooks_EditBacklogBook(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	user := srv.URL + "/api/testclub/"

	// Add to backlog
	body := bytes.NewBufferString(`{"title":"Dune","authors":"Frank Herbert"}`)
	resp, _ := http.Post(user+"backlog", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Edit the backlog book
	body = bytes.NewBufferString(`{"title":"Dune Messiah","authors":"Frank Herbert","description":"Updated"}`)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", user, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var updated model.Book
	json.NewDecoder(resp.Body).Decode(&updated)
	resp.Body.Close()

	if updated.Title != "Dune Messiah" {
		t.Errorf("expected Dune Messiah, got %q", updated.Title)
	}
	if updated.Status != "backlog" {
		t.Errorf("expected backlog, got %q", updated.Status)
	}
}

func TestUserBooks_EditValidation(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")

	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Missing title
	body = bytes.NewBufferString(`{"authors":"Frank Herbert"}`)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", user, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing title, got %d", resp.StatusCode)
	}

	// Missing authors
	body = bytes.NewBufferString(`{"title":"Dune"}`)
	req, _ = http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", user, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing authors, got %d", resp.StatusCode)
	}
}

func TestAdminBooks_EditBook(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"

	alice := createParticipant(t, admin, "Alice")

	// Admin creates nomination
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(admin+"books/nominate-for-user", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Admin edits the book
	body = bytes.NewBufferString(`{"title":"Dune Messiah","authors":"Frank Herbert","description":"Updated"}`)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%sbooks/%d", admin, book.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var updated model.Book
	json.NewDecoder(resp.Body).Decode(&updated)
	resp.Body.Close()

	if updated.Title != "Dune Messiah" {
		t.Errorf("expected Dune Messiah, got %q", updated.Title)
	}
}

func TestUserBooks_MoveOwnNominationToBacklog(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice nominates
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var aliceBook model.Book
	json.NewDecoder(resp.Body).Decode(&aliceBook)
	resp.Body.Close()

	// Bob nominates
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Neuromancer","authors":"William Gibson","participant_id":%d}`, bob.ID))
	resp, _ = http.Post(user+"books", "application/json", body)
	var bobBook model.Book
	json.NewDecoder(resp.Body).Decode(&bobBook)
	resp.Body.Close()

	// Alice moves own nomination to backlog
	body = bytes.NewBufferString(fmt.Sprintf(`{"participant_id":%d}`, alice.ID))
	req, _ := http.NewRequest(http.MethodPost,
		fmt.Sprintf("%sbooks/%d/move-to-backlog", user, aliceBook.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var moved model.Book
	json.NewDecoder(resp.Body).Decode(&moved)
	resp.Body.Close()
	if moved.Status != "backlog" {
		t.Errorf("expected backlog, got %q", moved.Status)
	}

	// Bob cannot move Alice's (now backlog) book — but let's test Bob can't move his own via wrong ID
	// Bob tries to move Alice's old book (now backlog, not nominated) — should fail
	body = bytes.NewBufferString(fmt.Sprintf(`{"participant_id":%d}`, bob.ID))
	req, _ = http.NewRequest(http.MethodPost,
		fmt.Sprintf("%sbooks/%d/move-to-backlog", user, bobBook.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	// Bob can move his own — should succeed
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for Bob moving own, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestUserBooks_CannotMoveOthersNomination(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice nominates
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var aliceBook model.Book
	json.NewDecoder(resp.Body).Decode(&aliceBook)
	resp.Body.Close()

	// Bob tries to move Alice's nomination to backlog — should fail
	body = bytes.NewBufferString(fmt.Sprintf(`{"participant_id":%d}`, bob.ID))
	req, _ := http.NewRequest(http.MethodPost,
		fmt.Sprintf("%sbooks/%d/move-to-backlog", user, aliceBook.ID), body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestScores_BlockedWhenNotRevealed(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	user := srv.URL + "/api/testclub/"

	resp, _ := http.Get(user + "scores")
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 when voting not revealed, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestScores_IncludesVoteDetails(t *testing.T) {
	srv := setupTestServer(t)
	defer srv.Close()
	admin := srv.URL + "/api/testclub/admin/testadmin/"
	user := srv.URL + "/api/testclub/"

	alice := createParticipant(t, admin, "Alice")
	bob := createParticipant(t, admin, "Bob")

	// Alice nominates a book
	body := bytes.NewBufferString(fmt.Sprintf(
		`{"title":"Dune","authors":"Frank Herbert","participant_id":%d}`, alice.ID))
	resp, _ := http.Post(user+"books", "application/json", body)
	var book model.Book
	json.NewDecoder(resp.Body).Decode(&book)
	resp.Body.Close()

	// Alice votes 16 credits, Bob votes 25 credits
	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":16}]}`, alice.ID, book.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	body = bytes.NewBufferString(fmt.Sprintf(
		`{"participant_id":%d,"votes":[{"book_id":%d,"credits":25}]}`, bob.ID, book.ID))
	resp, _ = http.Post(user+"votes", "application/json", body)
	resp.Body.Close()

	// Reveal voting
	body = bytes.NewBufferString(`{"credit_budget":100,"voting_state":"revealed","pins_enabled":false}`)
	req, _ := http.NewRequest(http.MethodPut, admin+"settings", body)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()

	// Fetch scores
	resp, _ = http.Get(user + "scores")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var scores []model.BookScore
	json.NewDecoder(resp.Body).Decode(&scores)
	resp.Body.Close()

	if len(scores) != 1 {
		t.Fatalf("expected 1 score, got %d", len(scores))
	}
	s := scores[0]
	if s.BookID != book.ID {
		t.Errorf("unexpected book_id %d", s.BookID)
	}
	// score: sqrt(16) + sqrt(25) = 4 + 5 = 9
	if s.Score != 9.0 {
		t.Errorf("expected score 9.0, got %.2f", s.Score)
	}
	if len(s.Votes) != 2 {
		t.Fatalf("expected 2 vote details, got %d", len(s.Votes))
	}
	votesByName := make(map[string]int)
	for _, v := range s.Votes {
		votesByName[v.ParticipantName] = v.Credits
	}
	if votesByName["Alice"] != 16 {
		t.Errorf("Alice credits: expected 16, got %d", votesByName["Alice"])
	}
	if votesByName["Bob"] != 25 {
		t.Errorf("Bob credits: expected 25, got %d", votesByName["Bob"])
	}
}
