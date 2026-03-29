package store_test

import (
	"testing"

	"github.com/omar/bookclub/internal/model"
	"github.com/omar/bookclub/internal/store"
)

func TestSettingsStore_DefaultValues(t *testing.T) {
	db := newTestDB(t)
	ss := store.NewSettingsStore(db)

	s, err := ss.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if s.CreditBudget != 100 {
		t.Errorf("expected credit_budget=100, got %d", s.CreditBudget)
	}
	if s.VotingState != "open" {
		t.Errorf("expected voting_state=open, got %q", s.VotingState)
	}
	if s.PinsEnabled {
		t.Error("expected pins_enabled=false")
	}
}

func TestSettingsStore_Update(t *testing.T) {
	db := newTestDB(t)
	ss := store.NewSettingsStore(db)

	err := ss.Update(&model.Settings{
		CreditBudget: 200,
		VotingState:  "revealed",
		PinsEnabled:  true,
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	s, err := ss.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if s.CreditBudget != 200 {
		t.Errorf("expected 200, got %d", s.CreditBudget)
	}
	if s.VotingState != "revealed" {
		t.Errorf("expected revealed, got %q", s.VotingState)
	}
	if !s.PinsEnabled {
		t.Error("expected pins_enabled=true")
	}
}
