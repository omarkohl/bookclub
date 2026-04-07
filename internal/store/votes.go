package store

import (
	"database/sql"
	"fmt"
	"math"

	"github.com/omar/bookclub/internal/model"
)

type VoteStore struct {
	db *sql.DB
}

func NewVoteStore(db *sql.DB) *VoteStore {
	return &VoteStore{db: db}
}

// Set replaces all votes for a participant atomically.
func (s *VoteStore) Set(participantID int, votes []model.Vote) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec("DELETE FROM votes WHERE participant_id = ?", participantID); err != nil {
		return fmt.Errorf("clear votes: %w", err)
	}

	for _, v := range votes {
		if v.Credits <= 0 {
			continue
		}
		if _, err := tx.Exec(
			"INSERT INTO votes (participant_id, book_id, credits) VALUES (?, ?, ?)",
			participantID, v.BookID, v.Credits,
		); err != nil {
			return fmt.Errorf("insert vote (book %d): %w", v.BookID, err)
		}
	}

	return tx.Commit()
}

// GetByParticipant returns all votes for a participant.
func (s *VoteStore) GetByParticipant(participantID int) ([]model.Vote, error) {
	rows, err := s.db.Query(
		"SELECT participant_id, book_id, credits FROM votes WHERE participant_id = ?",
		participantID,
	)
	if err != nil {
		return nil, fmt.Errorf("get votes for participant %d: %w", participantID, err)
	}
	defer func() { _ = rows.Close() }()

	var votes []model.Vote
	for rows.Next() {
		var v model.Vote
		if err := rows.Scan(&v.ParticipantID, &v.BookID, &v.Credits); err != nil {
			return nil, fmt.Errorf("scan vote: %w", err)
		}
		votes = append(votes, v)
	}
	return votes, rows.Err()
}

// TotalCredits returns the sum of credits allocated by a participant.
func (s *VoteStore) TotalCredits(participantID int) (int, error) {
	var total int
	err := s.db.QueryRow(
		"SELECT COALESCE(SUM(credits), 0) FROM votes WHERE participant_id = ?",
		participantID,
	).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("total credits for participant %d: %w", participantID, err)
	}
	return total, nil
}

// Scores computes QV scores (SUM(sqrt(credits))) per book, including per-participant vote details.
func (s *VoteStore) Scores() ([]model.BookScore, error) {
	rows, err := s.db.Query(
		`SELECT v.book_id, p.name, v.credits
		 FROM votes v
		 JOIN participants p ON p.id = v.participant_id`,
	)
	if err != nil {
		return nil, fmt.Errorf("get all votes: %w", err)
	}
	defer func() { _ = rows.Close() }()

	type bookData struct {
		score float64
		votes []model.VoteDetail
	}
	dataMap := make(map[int]*bookData)

	for rows.Next() {
		var bookID, credits int
		var participantName string
		if err := rows.Scan(&bookID, &participantName, &credits); err != nil {
			return nil, fmt.Errorf("scan vote: %w", err)
		}
		if _, ok := dataMap[bookID]; !ok {
			dataMap[bookID] = &bookData{}
		}
		dataMap[bookID].score += math.Sqrt(float64(credits))
		dataMap[bookID].votes = append(dataMap[bookID].votes, model.VoteDetail{
			ParticipantName: participantName,
			Credits:         credits,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	scores := make([]model.BookScore, 0, len(dataMap))
	for bookID, data := range dataMap {
		scores = append(scores, model.BookScore{
			BookID: bookID,
			Score:  math.Round(data.score*100) / 100,
			Votes:  data.votes,
		})
	}
	return scores, nil
}

// CountOverBudget returns the number of participants whose total credits exceed the given budget.
func (s *VoteStore) CountOverBudget(budget int) (int, error) {
	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM (SELECT participant_id FROM votes GROUP BY participant_id HAVING SUM(credits) > ?)",
		budget,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count over-budget participants: %w", err)
	}
	return count, nil
}

// ClearOverBudget deletes all votes for participants whose total credits exceed the given budget.
// Returns the number of affected participants.
func (s *VoteStore) ClearOverBudget(budget int) (int, error) {
	rows, err := s.db.Query(
		"SELECT participant_id FROM votes GROUP BY participant_id HAVING SUM(credits) > ?",
		budget,
	)
	if err != nil {
		return 0, fmt.Errorf("find over-budget participants: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var pids []int
	for rows.Next() {
		var pid int
		if err := rows.Scan(&pid); err != nil {
			return 0, fmt.Errorf("scan participant_id: %w", err)
		}
		pids = append(pids, pid)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	for _, pid := range pids {
		if _, err := s.db.Exec("DELETE FROM votes WHERE participant_id = ?", pid); err != nil {
			return 0, fmt.Errorf("clear votes for participant %d: %w", pid, err)
		}
	}

	return len(pids), nil
}

// AllTotalCredits returns a map of participant_id -> total credits used.
func (s *VoteStore) AllTotalCredits() (map[int]int, error) {
	rows, err := s.db.Query("SELECT participant_id, SUM(credits) FROM votes GROUP BY participant_id")
	if err != nil {
		return nil, fmt.Errorf("all total credits: %w", err)
	}
	defer func() { _ = rows.Close() }()
	totals := make(map[int]int)
	for rows.Next() {
		var pid, total int
		if err := rows.Scan(&pid, &total); err != nil {
			return nil, fmt.Errorf("scan totals: %w", err)
		}
		totals[pid] = total
	}
	return totals, rows.Err()
}

// ClearByParticipant deletes all votes for a participant.
func (s *VoteStore) ClearByParticipant(participantID int) error {
	_, err := s.db.Exec("DELETE FROM votes WHERE participant_id = ?", participantID)
	if err != nil {
		return fmt.Errorf("clear votes for participant %d: %w", participantID, err)
	}
	return nil
}
