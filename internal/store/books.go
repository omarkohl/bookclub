package store

import (
	"database/sql"
	"fmt"

	"github.com/omar/bookclub/internal/model"
)

type BookStore struct {
	db *sql.DB
}

func NewBookStore(db *sql.DB) *BookStore {
	return &BookStore{db: db}
}

func (s *BookStore) Create(book *model.Book) (*model.Book, error) {
	result, err := s.db.Exec(
		`INSERT INTO books (title, authors, description, link, nominated_by, status)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		book.Title, book.Authors, book.Description, book.Link, book.NominatedBy, book.Status,
	)
	if err != nil {
		return nil, fmt.Errorf("insert book: %w", err)
	}
	id, _ := result.LastInsertId()
	return s.GetByID(int(id))
}

func (s *BookStore) GetByID(id int) (*model.Book, error) {
	b := &model.Book{}
	err := s.db.QueryRow(
		`SELECT id, title, authors, COALESCE(description,''), COALESCE(link,''),
		        nominated_by, status, created_at
		 FROM books WHERE id = ?`, id,
	).Scan(&b.ID, &b.Title, &b.Authors, &b.Description, &b.Link,
		&b.NominatedBy, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get book %d: %w", id, err)
	}
	return b, nil
}

func (s *BookStore) ListNominated() ([]model.Book, error) {
	return s.listByStatus("nominated")
}

func (s *BookStore) ListBacklog() ([]model.Book, error) {
	return s.listByStatus("backlog")
}

func (s *BookStore) listByStatus(status string) ([]model.Book, error) {
	rows, err := s.db.Query(
		`SELECT id, title, authors, COALESCE(description,''), COALESCE(link,''),
		        nominated_by, status, created_at
		 FROM books WHERE status = ? ORDER BY created_at DESC`, status,
	)
	if err != nil {
		return nil, fmt.Errorf("list books (status=%s): %w", status, err)
	}
	defer rows.Close()

	var books []model.Book
	for rows.Next() {
		var b model.Book
		if err := rows.Scan(&b.ID, &b.Title, &b.Authors, &b.Description, &b.Link,
			&b.NominatedBy, &b.Status, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan book: %w", err)
		}
		books = append(books, b)
	}
	return books, rows.Err()
}

func (s *BookStore) ListAll() ([]model.Book, error) {
	rows, err := s.db.Query(
		`SELECT id, title, authors, COALESCE(description,''), COALESCE(link,''),
		        nominated_by, status, created_at
		 FROM books ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("list all books: %w", err)
	}
	defer rows.Close()

	var books []model.Book
	for rows.Next() {
		var b model.Book
		if err := rows.Scan(&b.ID, &b.Title, &b.Authors, &b.Description, &b.Link,
			&b.NominatedBy, &b.Status, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan book: %w", err)
		}
		books = append(books, b)
	}
	return books, rows.Err()
}

func (s *BookStore) MoveToBacklog(id int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Delete votes on this book
	if _, err := tx.Exec("DELETE FROM votes WHERE book_id = ?", id); err != nil {
		return fmt.Errorf("delete votes for book %d: %w", id, err)
	}

	result, err := tx.Exec(
		"UPDATE books SET status = 'backlog', nominated_by = NULL WHERE id = ?", id,
	)
	if err != nil {
		return fmt.Errorf("move book %d to backlog: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}

func (s *BookStore) Delete(id int) error {
	result, err := s.db.Exec("DELETE FROM books WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete book %d: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *BookStore) GetNominationByParticipant(participantID int) (*model.Book, error) {
	b := &model.Book{}
	err := s.db.QueryRow(
		`SELECT id, title, authors, COALESCE(description,''), COALESCE(link,''),
		        nominated_by, status, created_at
		 FROM books WHERE nominated_by = ? AND status = 'nominated'`, participantID,
	).Scan(&b.ID, &b.Title, &b.Authors, &b.Description, &b.Link,
		&b.NominatedBy, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get nomination by participant %d: %w", participantID, err)
	}
	return b, nil
}

// NominateFromBacklog moves a backlog book to nominated status for a participant.
// If the participant already has a nomination, the old one is moved to backlog first.
func (s *BookStore) NominateFromBacklog(bookID, participantID int) (*model.Book, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Move existing nomination to backlog if any
	if _, err := tx.Exec("DELETE FROM votes WHERE book_id IN (SELECT id FROM books WHERE nominated_by = ? AND status = 'nominated')", participantID); err != nil {
		return nil, fmt.Errorf("delete votes for old nomination: %w", err)
	}
	if _, err := tx.Exec(
		"UPDATE books SET status = 'backlog', nominated_by = NULL WHERE nominated_by = ? AND status = 'nominated'",
		participantID,
	); err != nil {
		return nil, fmt.Errorf("move old nomination to backlog: %w", err)
	}

	// Move backlog book to nominated
	result, err := tx.Exec(
		"UPDATE books SET status = 'nominated', nominated_by = ? WHERE id = ? AND status = 'backlog'",
		participantID, bookID,
	)
	if err != nil {
		return nil, fmt.Errorf("nominate from backlog: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sql.ErrNoRows
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}
	return s.GetByID(bookID)
}
