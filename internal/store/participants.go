package store

import (
	"database/sql"
	"fmt"

	"github.com/omar/bookclub/internal/model"
)

type ParticipantStore struct {
	db *sql.DB
}

func NewParticipantStore(db *sql.DB) *ParticipantStore {
	return &ParticipantStore{db: db}
}

func (s *ParticipantStore) Create(name string) (*model.Participant, error) {
	result, err := s.db.Exec(
		"INSERT INTO participants (name) VALUES (?)", name,
	)
	if err != nil {
		return nil, fmt.Errorf("insert participant: %w", err)
	}
	id, _ := result.LastInsertId()
	return s.GetByID(int(id))
}

func (s *ParticipantStore) GetByID(id int) (*model.Participant, error) {
	p := &model.Participant{}
	err := s.db.QueryRow(
		"SELECT id, name, created_at FROM participants WHERE id = ?", id,
	).Scan(&p.ID, &p.Name, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get participant %d: %w", id, err)
	}
	return p, nil
}

func (s *ParticipantStore) List() ([]model.Participant, error) {
	rows, err := s.db.Query("SELECT id, name, created_at FROM participants ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("list participants: %w", err)
	}
	defer rows.Close()

	var participants []model.Participant
	for rows.Next() {
		var p model.Participant
		if err := rows.Scan(&p.ID, &p.Name, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan participant: %w", err)
		}
		participants = append(participants, p)
	}
	return participants, rows.Err()
}

func (s *ParticipantStore) Delete(id int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Delete votes on books nominated by this participant.
	_, err = tx.Exec(
		"DELETE FROM votes WHERE book_id IN (SELECT id FROM books WHERE nominated_by = ?)", id,
	)
	if err != nil {
		return fmt.Errorf("delete votes on participant %d books: %w", id, err)
	}

	// Move nominations to backlog (clear nominated_by to avoid FK conflict).
	_, err = tx.Exec(
		"UPDATE books SET status = 'backlog', nominated_by = NULL WHERE nominated_by = ?", id,
	)
	if err != nil {
		return fmt.Errorf("move books to backlog for participant %d: %w", id, err)
	}

	// Delete the participant (their own votes cascade via FK).
	result, err := tx.Exec("DELETE FROM participants WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete participant %d: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}

	return tx.Commit()
}
