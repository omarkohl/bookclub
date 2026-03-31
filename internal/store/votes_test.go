package store_test

import (
	"database/sql"
	"math"
	"testing"

	"github.com/omar/bookclub/internal/model"
	"github.com/omar/bookclub/internal/store"
)

func createTestBook(t *testing.T, db *sql.DB, title string, nominatedBy *int) *model.Book {
	t.Helper()
	bs := store.NewBookStore(db)
	b, err := bs.Create(&model.Book{
		Title:       title,
		Authors:     "Author",
		NominatedBy: nominatedBy,
		Status:      "nominated",
	})
	if err != nil {
		t.Fatalf("create book %q: %v", title, err)
	}
	return b
}

func TestVoteStore_SetAndGet(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	book1 := createTestBook(t, db, "Dune", &alice.ID)
	book2 := createTestBook(t, db, "Neuromancer", &bob.ID)

	// Set votes for alice
	err := vs.Set(alice.ID, []model.Vote{
		{BookID: book1.ID, Credits: 25},
		{BookID: book2.ID, Credits: 50},
	})
	if err != nil {
		t.Fatalf("Set: %v", err)
	}

	// Get alice's votes
	votes, err := vs.GetByParticipant(alice.ID)
	if err != nil {
		t.Fatalf("GetByParticipant: %v", err)
	}
	if len(votes) != 2 {
		t.Fatalf("expected 2 votes, got %d", len(votes))
	}

	// Verify credits
	voteMap := make(map[int]int)
	for _, v := range votes {
		voteMap[v.BookID] = v.Credits
	}
	if voteMap[book1.ID] != 25 {
		t.Errorf("expected 25 credits on book1, got %d", voteMap[book1.ID])
	}
	if voteMap[book2.ID] != 50 {
		t.Errorf("expected 50 credits on book2, got %d", voteMap[book2.ID])
	}
}

func TestVoteStore_SetReplacesExisting(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	book1 := createTestBook(t, db, "Dune", &alice.ID)
	book2 := createTestBook(t, db, "Neuromancer", &bob.ID)

	// Initial votes
	vs.Set(alice.ID, []model.Vote{
		{BookID: book1.ID, Credits: 25},
		{BookID: book2.ID, Credits: 50},
	})

	// Replace with different allocation
	err := vs.Set(alice.ID, []model.Vote{
		{BookID: book2.ID, Credits: 75},
	})
	if err != nil {
		t.Fatalf("Set (replace): %v", err)
	}

	votes, _ := vs.GetByParticipant(alice.ID)
	if len(votes) != 1 {
		t.Fatalf("expected 1 vote after replace, got %d", len(votes))
	}
	if votes[0].BookID != book2.ID || votes[0].Credits != 75 {
		t.Errorf("expected book2 with 75 credits, got book %d with %d", votes[0].BookID, votes[0].Credits)
	}
}

func TestVoteStore_SetEmptyClears(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	book := createTestBook(t, db, "Dune", &alice.ID)

	vs.Set(alice.ID, []model.Vote{{BookID: book.ID, Credits: 25}})

	// Clear all votes
	err := vs.Set(alice.ID, []model.Vote{})
	if err != nil {
		t.Fatalf("Set (clear): %v", err)
	}

	votes, _ := vs.GetByParticipant(alice.ID)
	if len(votes) != 0 {
		t.Fatalf("expected 0 votes after clear, got %d", len(votes))
	}
}

func TestVoteStore_Scores(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	book1 := createTestBook(t, db, "Dune", &alice.ID)
	book2 := createTestBook(t, db, "Neuromancer", &bob.ID)

	// Alice: 16 credits on book1, 9 credits on book2
	vs.Set(alice.ID, []model.Vote{
		{BookID: book1.ID, Credits: 16},
		{BookID: book2.ID, Credits: 9},
	})
	// Bob: 25 credits on book1
	vs.Set(bob.ID, []model.Vote{
		{BookID: book1.ID, Credits: 25},
	})

	scores, err := vs.Scores()
	if err != nil {
		t.Fatalf("Scores: %v", err)
	}

	scoreMap := make(map[int]float64)
	for _, s := range scores {
		scoreMap[s.BookID] = s.Score
	}

	// book1: sqrt(16) + sqrt(25) = 4 + 5 = 9
	if math.Abs(scoreMap[book1.ID]-9.0) > 0.01 {
		t.Errorf("book1 score: expected 9.0, got %.2f", scoreMap[book1.ID])
	}
	// book2: sqrt(9) = 3
	if math.Abs(scoreMap[book2.ID]-3.0) > 0.01 {
		t.Errorf("book2 score: expected 3.0, got %.2f", scoreMap[book2.ID])
	}
}

func TestVoteStore_TotalCredits(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	book1 := createTestBook(t, db, "Dune", &alice.ID)
	book2 := createTestBook(t, db, "Neuromancer", &bob.ID)

	vs.Set(alice.ID, []model.Vote{
		{BookID: book1.ID, Credits: 25},
		{BookID: book2.ID, Credits: 50},
	})

	total, err := vs.TotalCredits(alice.ID)
	if err != nil {
		t.Fatalf("TotalCredits: %v", err)
	}
	if total != 75 {
		t.Errorf("expected 75 total credits, got %d", total)
	}
}

func TestVoteStore_CascadeOnBookDelete(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	bs := store.NewBookStore(db)
	alice := createTestParticipant(t, db, "Alice")
	book := createTestBook(t, db, "Dune", &alice.ID)

	vs.Set(alice.ID, []model.Vote{{BookID: book.ID, Credits: 25}})

	// Delete the book
	bs.Delete(book.ID)

	votes, _ := vs.GetByParticipant(alice.ID)
	if len(votes) != 0 {
		t.Errorf("expected 0 votes after book delete, got %d", len(votes))
	}
}

func TestVoteStore_ClearOverBudget(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	carol := createTestParticipant(t, db, "Carol")
	book1 := createTestBook(t, db, "Dune", &alice.ID)
	book2 := createTestBook(t, db, "Neuromancer", &bob.ID)

	// Alice spends 80 credits
	vs.Set(alice.ID, []model.Vote{
		{BookID: book1.ID, Credits: 50},
		{BookID: book2.ID, Credits: 30},
	})
	// Bob spends 40 credits
	vs.Set(bob.ID, []model.Vote{
		{BookID: book1.ID, Credits: 40},
	})
	// Carol spends 60 credits
	vs.Set(carol.ID, []model.Vote{
		{BookID: book2.ID, Credits: 60},
	})

	// Lower budget to 50: Alice (80) and Carol (60) are over, Bob (40) is fine
	affected, err := vs.ClearOverBudget(50)
	if err != nil {
		t.Fatalf("ClearOverBudget: %v", err)
	}
	if affected != 2 {
		t.Errorf("expected 2 affected users, got %d", affected)
	}

	// Alice's votes should be cleared
	aliceVotes, _ := vs.GetByParticipant(alice.ID)
	if len(aliceVotes) != 0 {
		t.Errorf("expected 0 alice votes, got %d", len(aliceVotes))
	}

	// Bob's votes should remain
	bobVotes, _ := vs.GetByParticipant(bob.ID)
	if len(bobVotes) != 1 {
		t.Errorf("expected 1 bob vote, got %d", len(bobVotes))
	}

	// Carol's votes should be cleared
	carolVotes, _ := vs.GetByParticipant(carol.ID)
	if len(carolVotes) != 0 {
		t.Errorf("expected 0 carol votes, got %d", len(carolVotes))
	}
}

func TestVoteStore_ClearOverBudget_NoneAffected(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	book := createTestBook(t, db, "Dune", &alice.ID)

	vs.Set(alice.ID, []model.Vote{{BookID: book.ID, Credits: 25}})

	// Budget higher than anyone's spending
	affected, err := vs.ClearOverBudget(100)
	if err != nil {
		t.Fatalf("ClearOverBudget: %v", err)
	}
	if affected != 0 {
		t.Errorf("expected 0 affected, got %d", affected)
	}

	votes, _ := vs.GetByParticipant(alice.ID)
	if len(votes) != 1 {
		t.Errorf("expected 1 vote preserved, got %d", len(votes))
	}
}

func TestVoteStore_ClearByParticipant(t *testing.T) {
	db := newTestDB(t)
	vs := store.NewVoteStore(db)
	alice := createTestParticipant(t, db, "Alice")
	bob := createTestParticipant(t, db, "Bob")
	book := createTestBook(t, db, "Dune", &alice.ID)

	vs.Set(alice.ID, []model.Vote{{BookID: book.ID, Credits: 25}})
	vs.Set(bob.ID, []model.Vote{{BookID: book.ID, Credits: 30}})

	err := vs.ClearByParticipant(alice.ID)
	if err != nil {
		t.Fatalf("ClearByParticipant: %v", err)
	}

	aliceVotes, _ := vs.GetByParticipant(alice.ID)
	bobVotes, _ := vs.GetByParticipant(bob.ID)
	if len(aliceVotes) != 0 {
		t.Errorf("expected 0 alice votes, got %d", len(aliceVotes))
	}
	if len(bobVotes) != 1 {
		t.Errorf("expected 1 bob vote, got %d", len(bobVotes))
	}
}
