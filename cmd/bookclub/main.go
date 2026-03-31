package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/omar/bookclub/internal/handler"
	"github.com/omar/bookclub/internal/store"
)

func main() {
	port := envOr("BOOKCLUB_PORT", "8080")
	clubSecret := envOr("BOOKCLUB_CLUB_SECRET", "club")
	adminSecret := envOr("BOOKCLUB_ADMIN_SECRET", "admin")
	dbPath := envOr("BOOKCLUB_DB_PATH", "bookclub.db")

	db, err := store.New(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer func() { _ = db.Close() }()

	h := handler.New(db, clubSecret, adminSecret)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("listening on %s (club=/%s/ admin=/%s/admin/%s/)", addr, clubSecret, clubSecret, adminSecret)
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
