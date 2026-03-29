package store_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/omar/bookclub/internal/store"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dir := t.TempDir()
	db, err := store.New(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("store.New: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestParticipantStore_CRUD(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)

	// Create
	p, err := ps.Create("Alice")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if p.Name != "Alice" {
		t.Errorf("expected Alice, got %q", p.Name)
	}
	if p.ID == 0 {
		t.Error("expected non-zero ID")
	}

	// List
	list, err := ps.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 participant, got %d", len(list))
	}

	// Create another
	p2, err := ps.Create("Bob")
	if err != nil {
		t.Fatalf("Create Bob: %v", err)
	}

	// List should return sorted by name
	list, err = ps.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(list))
	}
	if list[0].Name != "Alice" || list[1].Name != "Bob" {
		t.Errorf("expected [Alice, Bob], got [%s, %s]", list[0].Name, list[1].Name)
	}

	// GetByID
	got, err := ps.GetByID(p2.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Name != "Bob" {
		t.Errorf("expected Bob, got %q", got.Name)
	}

	// Delete
	if err := ps.Delete(p.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	list, err = ps.List()
	if err != nil {
		t.Fatalf("List after delete: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 participant after delete, got %d", len(list))
	}
}

func TestParticipantStore_DuplicateName(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)

	if _, err := ps.Create("Alice"); err != nil {
		t.Fatalf("Create: %v", err)
	}
	_, err := ps.Create("Alice")
	if err == nil {
		t.Fatal("expected error for duplicate name")
	}
}

func TestParticipantStore_EmptyName(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)

	_, err := ps.Create("")
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestParticipantStore_DeleteNonexistent(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)

	err := ps.Delete(999)
	if err != sql.ErrNoRows {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}
