package model

import "time"

type Settings struct {
	CreditBudget int    `json:"credit_budget"`
	VotingState  string `json:"voting_state"`
	PinsEnabled  bool   `json:"pins_enabled"`
}

type Participant struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}
