package store_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/omar/bookclub/internal/store"
)

func TestNew_CreatesDatabase(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	db, err := store.New(dbPath)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer db.Close()

	// Verify DB file was created.
	if _, err := os.Stat(dbPath); err != nil {
		t.Fatalf("database file not created: %v", err)
	}

	// Verify schema_migrations table exists.
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count)
	if err != nil {
		t.Fatalf("schema_migrations query error: %v", err)
	}

	// Verify WAL mode is set.
	var journalMode string
	err = db.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err != nil {
		t.Fatalf("PRAGMA journal_mode error: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected WAL mode, got %q", journalMode)
	}

	// Verify foreign keys are enabled.
	var fkEnabled int
	err = db.QueryRow("PRAGMA foreign_keys").Scan(&fkEnabled)
	if err != nil {
		t.Fatalf("PRAGMA foreign_keys error: %v", err)
	}
	if fkEnabled != 1 {
		t.Error("foreign keys not enabled")
	}
}

func TestNew_MigrationsAreIdempotent(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	// Open twice — second open should not fail.
	db1, err := store.New(dbPath)
	if err != nil {
		t.Fatalf("first New() error: %v", err)
	}
	db1.Close()

	db2, err := store.New(dbPath)
	if err != nil {
		t.Fatalf("second New() error: %v", err)
	}
	db2.Close()
}
