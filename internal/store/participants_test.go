package store_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/omar/bookclub/internal/model"
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

func TestParticipantStore_DeleteWithNomination(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)
	bs := store.NewBookStore(db)
	vs := store.NewVoteStore(db)

	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")

	// Alice nominates a book
	book, err := bs.Create(&model.Book{
		Title:       "Dune",
		Authors:     "Frank Herbert",
		NominatedBy: &alice.ID,
		Status:      "nominated",
	})
	if err != nil {
		t.Fatalf("Create book: %v", err)
	}

	// Bob votes on Alice's book
	err = vs.Set(bob.ID, []model.Vote{{BookID: book.ID, Credits: 25}})
	if err != nil {
		t.Fatalf("Set votes: %v", err)
	}

	// Delete Alice — should cascade: delete votes on her book, delete her book, then delete her
	if err := ps.Delete(alice.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Alice should be gone
	_, err = ps.GetByID(alice.ID)
	if err == nil {
		t.Error("expected error getting deleted participant")
	}

	// Her book should be in backlog
	got, err := bs.GetByID(book.ID)
	if err != nil {
		t.Fatalf("expected book to still exist in backlog: %v", err)
	}
	if got.Status != "backlog" {
		t.Errorf("expected status backlog, got %q", got.Status)
	}
	if got.NominatedBy != nil {
		t.Errorf("expected nominated_by to be nil, got %v", got.NominatedBy)
	}

	// Bob's votes on her book should be gone
	votes, err := vs.GetByParticipant(bob.ID)
	if err != nil {
		t.Fatalf("GetByParticipant: %v", err)
	}
	if len(votes) != 0 {
		t.Errorf("expected 0 votes, got %d", len(votes))
	}

	// Bob should still exist
	_, err = ps.GetByID(bob.ID)
	if err != nil {
		t.Error("Bob should still exist")
	}
}

func TestParticipantStore_DeleteWithVotesOnly(t *testing.T) {
	db := newTestDB(t)
	ps := store.NewParticipantStore(db)
	bs := store.NewBookStore(db)
	vs := store.NewVoteStore(db)

	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")

	// Bob nominates a book
	book, err := bs.Create(&model.Book{
		Title:       "Dune",
		Authors:     "Frank Herbert",
		NominatedBy: &bob.ID,
		Status:      "nominated",
	})
	if err != nil {
		t.Fatalf("Create book: %v", err)
	}

	// Alice votes on Bob's book
	err = vs.Set(alice.ID, []model.Vote{{BookID: book.ID, Credits: 25}})
	if err != nil {
		t.Fatalf("Set votes: %v", err)
	}

	// Delete Alice — she has votes but no nomination
	if err := ps.Delete(alice.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Alice should be gone
	_, err = ps.GetByID(alice.ID)
	if err == nil {
		t.Error("expected error getting deleted participant")
	}

	// Bob's book should still exist
	_, err = bs.GetByID(book.ID)
	if err != nil {
		t.Error("Bob's book should still exist")
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
