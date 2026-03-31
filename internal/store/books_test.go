package store_test

import (
	"database/sql"
	"testing"

	"github.com/omar/bookclub/internal/model"
	"github.com/omar/bookclub/internal/store"
)

func createTestParticipant(t *testing.T, db *sql.DB, name string) *model.Participant {
	t.Helper()
	ps := store.NewParticipantStore(db)
	p, err := ps.Create(name)
	if err != nil {
		t.Fatalf("create participant %q: %v", name, err)
	}
	return p
}

func TestBookStore_CreateAndGet(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	book, err := bs.Create(&model.Book{
		Title:       "Dune",
		Authors:     "Frank Herbert",
		Description: "A sci-fi epic",
		Link:        "https://example.com/dune",
		NominatedBy: &alice.ID,
		Status:      "nominated",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if book.ID == 0 {
		t.Error("expected non-zero ID")
	}
	if book.Title != "Dune" {
		t.Errorf("expected Dune, got %q", book.Title)
	}
	if book.Status != "nominated" {
		t.Errorf("expected nominated, got %q", book.Status)
	}
	if book.NominatedBy == nil || *book.NominatedBy != alice.ID {
		t.Errorf("expected nominated_by=%d, got %v", alice.ID, book.NominatedBy)
	}

	// GetByID
	got, err := bs.GetByID(book.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Title != "Dune" {
		t.Errorf("expected Dune, got %q", got.Title)
	}
}

func TestBookStore_ListNominatedAndBacklog(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		NominatedBy: &alice.ID, Status: "nominated",
	})
	bs.Create(&model.Book{
		Title: "Neuromancer", Authors: "William Gibson",
		Status: "backlog",
	})

	nominated, err := bs.ListNominated()
	if err != nil {
		t.Fatalf("ListNominated: %v", err)
	}
	if len(nominated) != 1 {
		t.Fatalf("expected 1 nominated, got %d", len(nominated))
	}
	if nominated[0].Title != "Dune" {
		t.Errorf("expected Dune, got %q", nominated[0].Title)
	}

	backlog, err := bs.ListBacklog()
	if err != nil {
		t.Fatalf("ListBacklog: %v", err)
	}
	if len(backlog) != 1 {
		t.Fatalf("expected 1 backlog, got %d", len(backlog))
	}
	if backlog[0].Title != "Neuromancer" {
		t.Errorf("expected Neuromancer, got %q", backlog[0].Title)
	}
}

func TestBookStore_OneNominationPerUser(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	_, err := bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		NominatedBy: &alice.ID, Status: "nominated",
	})
	if err != nil {
		t.Fatalf("first nomination: %v", err)
	}

	// Second nomination by same user should fail (unique index)
	_, err = bs.Create(&model.Book{
		Title: "Neuromancer", Authors: "William Gibson",
		NominatedBy: &alice.ID, Status: "nominated",
	})
	if err == nil {
		t.Fatal("expected error for duplicate nomination")
	}
}

func TestBookStore_MoveToBacklog(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	book, _ := bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		NominatedBy: &alice.ID, Status: "nominated",
	})

	if err := bs.MoveToBacklog(book.ID); err != nil {
		t.Fatalf("MoveToBacklog: %v", err)
	}

	got, err := bs.GetByID(book.ID)
	if err != nil {
		t.Fatalf("GetByID after move: %v", err)
	}
	if got.Status != "backlog" {
		t.Errorf("expected backlog, got %q", got.Status)
	}
	if got.NominatedBy != nil {
		t.Errorf("expected nil nominated_by, got %v", got.NominatedBy)
	}

	// Alice can now nominate again
	_, err = bs.Create(&model.Book{
		Title: "Neuromancer", Authors: "William Gibson",
		NominatedBy: &alice.ID, Status: "nominated",
	})
	if err != nil {
		t.Fatalf("re-nominate after move: %v", err)
	}
}

func TestBookStore_Delete(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)

	book, _ := bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert", Status: "backlog",
	})

	if err := bs.Delete(book.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err := bs.GetByID(book.ID)
	if err == nil {
		t.Fatal("expected error after delete")
	}
}

func TestBookStore_DeleteNonexistent(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)

	err := bs.Delete(999)
	if err != sql.ErrNoRows {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

func TestBookStore_GetNominationByParticipant(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	// No nomination yet
	_, err := bs.GetNominationByParticipant(alice.ID)
	if err == nil {
		t.Fatal("expected error when no nomination")
	}

	bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		NominatedBy: &alice.ID, Status: "nominated",
	})

	got, err := bs.GetNominationByParticipant(alice.ID)
	if err != nil {
		t.Fatalf("GetNominationByParticipant: %v", err)
	}
	if got.Title != "Dune" {
		t.Errorf("expected Dune, got %q", got.Title)
	}
}

func TestBookStore_Update(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	book, _ := bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		Description: "Old description", Link: "https://old.com",
		NominatedBy: &alice.ID, Status: "nominated",
	})

	updated, err := bs.Update(book.ID, &model.Book{
		Title:       "Dune Messiah",
		Authors:     "Frank Herbert",
		Description: "New description",
		Link:        "https://new.com",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Title != "Dune Messiah" {
		t.Errorf("expected Dune Messiah, got %q", updated.Title)
	}
	if updated.Description != "New description" {
		t.Errorf("expected New description, got %q", updated.Description)
	}
	if updated.Link != "https://new.com" {
		t.Errorf("expected https://new.com, got %q", updated.Link)
	}
	// Status and nominated_by should be unchanged
	if updated.Status != "nominated" {
		t.Errorf("expected nominated, got %q", updated.Status)
	}
	if updated.NominatedBy == nil || *updated.NominatedBy != alice.ID {
		t.Errorf("expected nominated_by=%d, got %v", alice.ID, updated.NominatedBy)
	}
}

func TestBookStore_UpdateNonexistent(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)

	_, err := bs.Update(999, &model.Book{
		Title: "X", Authors: "Y",
	})
	if err == nil {
		t.Fatal("expected error for nonexistent book")
	}
}

func TestBookStore_NominateFromBacklog(t *testing.T) {
	db := newTestDB(t)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")

	// Create a backlog book
	backlogBook, _ := bs.Create(&model.Book{
		Title: "Neuromancer", Authors: "William Gibson", Status: "backlog",
	})

	// Create existing nomination
	bs.Create(&model.Book{
		Title: "Dune", Authors: "Frank Herbert",
		NominatedBy: &alice.ID, Status: "nominated",
	})

	// Nominate from backlog — should move old nomination to backlog
	nominated, err := bs.NominateFromBacklog(backlogBook.ID, alice.ID)
	if err != nil {
		t.Fatalf("NominateFromBacklog: %v", err)
	}
	if nominated.Title != "Neuromancer" {
		t.Errorf("expected Neuromancer, got %q", nominated.Title)
	}
	if nominated.Status != "nominated" {
		t.Errorf("expected nominated, got %q", nominated.Status)
	}

	// Old book should be in backlog now
	backlog, _ := bs.ListBacklog()
	if len(backlog) != 1 {
		t.Fatalf("expected 1 backlog book, got %d", len(backlog))
	}
	if backlog[0].Title != "Dune" {
		t.Errorf("expected Dune in backlog, got %q", backlog[0].Title)
	}
}
