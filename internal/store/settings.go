package store

import (
	"database/sql"
	"fmt"

	"github.com/omar/bookclub/internal/model"
)

type SettingsStore struct {
	db *sql.DB
}

func NewSettingsStore(db *sql.DB) *SettingsStore {
	return &SettingsStore{db: db}
}

func (s *SettingsStore) Get() (*model.Settings, error) {
	settings := &model.Settings{}
	err := s.db.QueryRow(
		"SELECT credit_budget, voting_state, pins_enabled FROM settings WHERE id = 1",
	).Scan(&settings.CreditBudget, &settings.VotingState, &settings.PinsEnabled)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return settings, nil
}

func (s *SettingsStore) Update(settings *model.Settings) error {
	_, err := s.db.Exec(
		"UPDATE settings SET credit_budget = ?, voting_state = ?, pins_enabled = ? WHERE id = 1",
		settings.CreditBudget, settings.VotingState, settings.PinsEnabled,
	)
	if err != nil {
		return fmt.Errorf("update settings: %w", err)
	}
	return nil
}
