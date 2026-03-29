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

type Book struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Authors     string    `json:"authors"`
	Description string    `json:"description,omitempty"`
	Link        string    `json:"link,omitempty"`
	NominatedBy *int      `json:"nominated_by"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}
