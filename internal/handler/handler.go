package handler

import (
	"database/sql"
	"embed"
	"errors"
	"io/fs"
	"net/http"
	"strings"

	"github.com/omar/bookclub/internal/model"
	"github.com/omar/bookclub/internal/store"
)

// parseIDFromPath extracts a numeric ID from the end of a URL path after a prefix.
func parseIDFromPath(path, prefix string) (int, bool) {
	idStr := strings.TrimPrefix(path, prefix)
	if idStr == "" {
		return 0, false
	}
	// Stop at first slash (for sub-paths like /books/1/move-to-backlog)
	if idx := strings.Index(idStr, "/"); idx >= 0 {
		idStr = idStr[:idx]
	}
	id := 0
	for _, c := range idStr {
		if c < '0' || c > '9' {
			return 0, false
		}
		id = id*10 + int(c-'0')
	}
	if id == 0 {
		return 0, false
	}
	return id, true
}

// Static holds the embedded frontend assets.
//
//go:embed all:frontend
var Static embed.FS

// New creates the root HTTP handler with API routes and SPA serving.
func New(db *sql.DB, clubSecret, adminSecret, version, buildDate string) http.Handler {
	mux := http.NewServeMux()

	ps := store.NewParticipantStore(db)
	ss := store.NewSettingsStore(db)
	bs := store.NewBookStore(db)
	vs := store.NewVoteStore(db)

	// Public version endpoint.
	mux.HandleFunc("/api/version", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"version": version,
			"date":    buildDate,
		})
	})

	// API routes.
	apiPrefix := "/api/" + clubSecret + "/"
	adminPrefix := apiPrefix + "admin/" + adminSecret + "/"

	mux.HandleFunc(apiPrefix+"health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// User API: list participants.
	mux.HandleFunc(apiPrefix+"participants", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		participants, err := ps.List()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list participants")
			return
		}
		if participants == nil {
			participants = []model.Participant{}
		}
		writeJSON(w, http.StatusOK, participants)
	})

	// Admin API: CRUD participants.
	mux.HandleFunc(adminPrefix+"participants", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			participants, err := ps.List()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to list participants")
				return
			}
			if participants == nil {
				participants = []model.Participant{}
			}
			writeJSON(w, http.StatusOK, participants)
		case http.MethodPost:
			var req struct {
				Name string `json:"name"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Name = strings.TrimSpace(req.Name)
			if req.Name == "" {
				writeError(w, http.StatusBadRequest, "name is required")
				return
			}
			if len(req.Name) > 100 {
				writeError(w, http.StatusBadRequest, "name too long (max 100 chars)")
				return
			}
			p, err := ps.Create(req.Name)
			if err != nil {
				if strings.Contains(err.Error(), "UNIQUE") {
					writeError(w, http.StatusConflict, "participant already exists")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to create participant")
				return
			}
			writeJSON(w, http.StatusCreated, p)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc(adminPrefix+"participants/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		id, ok := parseIDFromPath(r.URL.Path, adminPrefix+"participants/")
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid participant ID")
			return
		}
		err := ps.Delete(id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeError(w, http.StatusNotFound, "participant not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to delete participant")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Admin API: settings.
	mux.HandleFunc(adminPrefix+"settings", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			s, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			writeJSON(w, http.StatusOK, s)
		case http.MethodPut:
			var req model.Settings
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.VotingState != "open" && req.VotingState != "revealed" {
				writeError(w, http.StatusBadRequest, "voting_state must be 'open' or 'revealed'")
				return
			}
			if req.CreditBudget < 1 {
				writeError(w, http.StatusBadRequest, "credit_budget must be positive")
				return
			}
			// Check current budget to detect decrease
			current, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			if err := ss.Update(&req); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to update settings")
				return
			}
			affected := 0
			if req.CreditBudget < current.CreditBudget {
				affected, err = vs.ClearOverBudget(req.CreditBudget)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to clear over-budget votes")
					return
				}
			}
			s, _ := ss.Get()
			writeJSON(w, http.StatusOK, struct {
				model.Settings
				AffectedUsers int `json:"affected_users"`
			}{*s, affected})
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// Admin API: preview credit budget change.
	mux.HandleFunc(adminPrefix+"settings/budget-preview", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		budgetStr := r.URL.Query().Get("budget")
		if budgetStr == "" {
			writeError(w, http.StatusBadRequest, "budget query param is required")
			return
		}
		budget := 0
		for _, c := range budgetStr {
			if c < '0' || c > '9' {
				writeError(w, http.StatusBadRequest, "invalid budget")
				return
			}
			budget = budget*10 + int(c-'0')
		}
		if budget < 1 {
			writeError(w, http.StatusBadRequest, "budget must be positive")
			return
		}
		count, err := vs.CountOverBudget(budget)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to count affected users")
			return
		}
		writeJSON(w, http.StatusOK, struct {
			AffectedUsers int `json:"affected_users"`
		}{count})
	})

	// User API: books (nominated).
	mux.HandleFunc(apiPrefix+"books", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			books, err := bs.ListNominated()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to list books")
				return
			}
			if books == nil {
				books = []model.Book{}
			}
			writeJSON(w, http.StatusOK, books)
		case http.MethodPost:
			settings, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			if settings.VotingState == "revealed" {
				writeError(w, http.StatusConflict, "nominations are closed while votes are revealed")
				return
			}
			var req struct {
				Title         string `json:"title"`
				Authors       string `json:"authors"`
				Description   string `json:"description"`
				Link          string `json:"link"`
				ParticipantID int    `json:"participant_id"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Title = strings.TrimSpace(req.Title)
			req.Authors = strings.TrimSpace(req.Authors)
			if req.Title == "" {
				writeError(w, http.StatusBadRequest, "title is required")
				return
			}
			if req.Authors == "" {
				writeError(w, http.StatusBadRequest, "authors is required")
				return
			}
			if req.ParticipantID == 0 {
				writeError(w, http.StatusBadRequest, "participant_id is required")
				return
			}
			// If user already has a nomination, move it to backlog first
			existing, err := bs.GetNominationByParticipant(req.ParticipantID)
			if err == nil && existing != nil {
				if err := bs.MoveToBacklog(existing.ID); err != nil {
					writeError(w, http.StatusInternalServerError, "failed to move old nomination to backlog")
					return
				}
			}
			book, err := bs.Create(&model.Book{
				Title:       req.Title,
				Authors:     req.Authors,
				Description: req.Description,
				Link:        req.Link,
				NominatedBy: &req.ParticipantID,
				Status:      "nominated",
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to create nomination")
				return
			}
			writeJSON(w, http.StatusCreated, book)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// User API: book detail, edit, delete, move-to-backlog.
	mux.HandleFunc(apiPrefix+"books/", func(w http.ResponseWriter, r *http.Request) {
		// Handle /books/nominate-from-backlog specially
		if strings.HasSuffix(r.URL.Path, "/nominate-from-backlog") {
			if r.Method != http.MethodPost {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			settings, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			if settings.VotingState == "revealed" {
				writeError(w, http.StatusConflict, "nominations are closed while votes are revealed")
				return
			}
			var req struct {
				BookID        int `json:"book_id"`
				ParticipantID int `json:"participant_id"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.BookID == 0 || req.ParticipantID == 0 {
				writeError(w, http.StatusBadRequest, "book_id and participant_id are required")
				return
			}
			book, err := bs.NominateFromBacklog(req.BookID, req.ParticipantID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found in backlog")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to nominate from backlog")
				return
			}
			writeJSON(w, http.StatusOK, book)
			return
		}

		id, ok := parseIDFromPath(r.URL.Path, apiPrefix+"books/")
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid book ID")
			return
		}

		// Handle /books/{id}/move-to-backlog (user can move own nomination)
		if strings.HasSuffix(r.URL.Path, "/move-to-backlog") {
			if r.Method != http.MethodPost {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			var req struct {
				ParticipantID int `json:"participant_id"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.ParticipantID == 0 {
				writeError(w, http.StatusBadRequest, "participant_id is required")
				return
			}
			book, err := bs.GetByID(id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to get book")
				return
			}
			if book.NominatedBy == nil || *book.NominatedBy != req.ParticipantID {
				writeError(w, http.StatusForbidden, "only the nominator can move their nomination to backlog")
				return
			}
			if err := bs.MoveToBacklog(id); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to move to backlog")
				return
			}
			moved, _ := bs.GetByID(id)
			writeJSON(w, http.StatusOK, moved)
			return
		}

		switch r.Method {
		case http.MethodGet:
			book, err := bs.GetByID(id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to get book")
				return
			}
			writeJSON(w, http.StatusOK, book)
		case http.MethodPut:
			var req struct {
				Title         string `json:"title"`
				Authors       string `json:"authors"`
				Description   string `json:"description"`
				Link          string `json:"link"`
				ParticipantID int    `json:"participant_id"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Title = strings.TrimSpace(req.Title)
			req.Authors = strings.TrimSpace(req.Authors)
			if req.Title == "" {
				writeError(w, http.StatusBadRequest, "title is required")
				return
			}
			if req.Authors == "" {
				writeError(w, http.StatusBadRequest, "authors is required")
				return
			}
			// Check ownership for nominated books
			book, err := bs.GetByID(id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to get book")
				return
			}
			if book.Status == "nominated" && (book.NominatedBy == nil || *book.NominatedBy != req.ParticipantID) {
				writeError(w, http.StatusForbidden, "only the nominator can edit their nomination")
				return
			}
			updated, err := bs.Update(id, &model.Book{
				Title:       req.Title,
				Authors:     req.Authors,
				Description: req.Description,
				Link:        req.Link,
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to update book")
				return
			}
			writeJSON(w, http.StatusOK, updated)
		case http.MethodDelete:
			book, err := bs.GetByID(id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to get book")
				return
			}
			if book.Status == "nominated" {
				settings, err := ss.Get()
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to get settings")
					return
				}
				if settings.VotingState == "revealed" {
					writeError(w, http.StatusConflict, "cannot delete nominations while votes are revealed")
					return
				}
			}
			if err := bs.Delete(id); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to delete book")
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// User API: backlog.
	mux.HandleFunc(apiPrefix+"backlog", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			books, err := bs.ListBacklog()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to list backlog")
				return
			}
			if books == nil {
				books = []model.Book{}
			}
			writeJSON(w, http.StatusOK, books)
		case http.MethodPost:
			var req struct {
				Title       string `json:"title"`
				Authors     string `json:"authors"`
				Description string `json:"description"`
				Link        string `json:"link"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Title = strings.TrimSpace(req.Title)
			req.Authors = strings.TrimSpace(req.Authors)
			if req.Title == "" {
				writeError(w, http.StatusBadRequest, "title is required")
				return
			}
			if req.Authors == "" {
				writeError(w, http.StatusBadRequest, "authors is required")
				return
			}
			book, err := bs.Create(&model.Book{
				Title:       req.Title,
				Authors:     req.Authors,
				Description: req.Description,
				Link:        req.Link,
				Status:      "backlog",
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to add to backlog")
				return
			}
			writeJSON(w, http.StatusCreated, book)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// User API: settings (read-only).
	mux.HandleFunc(apiPrefix+"settings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s, err := ss.Get()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get settings")
			return
		}
		writeJSON(w, http.StatusOK, s)
	})

	// User API: votes.
	mux.HandleFunc(apiPrefix+"votes", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			pidStr := r.URL.Query().Get("participant_id")
			if pidStr == "" {
				writeError(w, http.StatusBadRequest, "participant_id query param is required")
				return
			}
			pid := 0
			for _, c := range pidStr {
				if c < '0' || c > '9' {
					writeError(w, http.StatusBadRequest, "invalid participant_id")
					return
				}
				pid = pid*10 + int(c-'0')
			}
			votes, err := vs.GetByParticipant(pid)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get votes")
				return
			}
			if votes == nil {
				votes = []model.Vote{}
			}
			writeJSON(w, http.StatusOK, votes)
		case http.MethodPost:
			settings, err := ss.Get()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get settings")
				return
			}
			if settings.VotingState != "open" {
				writeError(w, http.StatusConflict, "voting is not open")
				return
			}
			var req struct {
				ParticipantID int          `json:"participant_id"`
				Votes         []model.Vote `json:"votes"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.ParticipantID == 0 {
				writeError(w, http.StatusBadRequest, "participant_id is required")
				return
			}
			// Validate credits are non-negative and total within budget
			total := 0
			for _, v := range req.Votes {
				if v.Credits < 0 {
					writeError(w, http.StatusBadRequest, "credits must be non-negative")
					return
				}
				total += v.Credits
			}
			if total > settings.CreditBudget {
				writeError(w, http.StatusBadRequest, "total credits exceed budget")
				return
			}
			if err := vs.Set(req.ParticipantID, req.Votes); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to save votes")
				return
			}
			votes, _ := vs.GetByParticipant(req.ParticipantID)
			if votes == nil {
				votes = []model.Vote{}
			}
			writeJSON(w, http.StatusOK, votes)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// User API: scores (only when revealed).
	mux.HandleFunc(apiPrefix+"scores", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		settings, err := ss.Get()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get settings")
			return
		}
		if settings.VotingState != "revealed" {
			writeError(w, http.StatusConflict, "scores are only available when votes are revealed")
			return
		}
		scores, err := vs.Scores()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to compute scores")
			return
		}
		if scores == nil {
			scores = []model.BookScore{}
		}
		writeJSON(w, http.StatusOK, scores)
	})

	// Admin API: participant stats (credits used, nomination status).
	mux.HandleFunc(adminPrefix+"participant-stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		participants, err := ps.List()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list participants")
			return
		}
		creditTotals, err := vs.AllTotalCredits()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get credit totals")
			return
		}
		nominatedBooks, err := bs.ListNominated()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list nominations")
			return
		}
		nominatorIDs := make(map[int]bool)
		for _, b := range nominatedBooks {
			if b.NominatedBy != nil {
				nominatorIDs[*b.NominatedBy] = true
			}
		}
		stats := make([]model.ParticipantStat, len(participants))
		for i, p := range participants {
			stats[i] = model.ParticipantStat{
				ID:            p.ID,
				Name:          p.Name,
				CreditsUsed:   creditTotals[p.ID],
				HasNomination: nominatorIDs[p.ID],
			}
		}
		writeJSON(w, http.StatusOK, stats)
	})

	// Admin API: books (all).
	mux.HandleFunc(adminPrefix+"books", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			books, err := bs.ListAll()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to list books")
				return
			}
			if books == nil {
				books = []model.Book{}
			}
			writeJSON(w, http.StatusOK, books)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// Admin API: book operations (delete, move-to-backlog, nominate-for-user).
	mux.HandleFunc(adminPrefix+"books/", func(w http.ResponseWriter, r *http.Request) {
		// Handle /books/nominate-for-user
		if strings.HasSuffix(r.URL.Path, "/nominate-for-user") {
			if r.Method != http.MethodPost {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			var req struct {
				BookID        *int   `json:"book_id"`
				Title         string `json:"title"`
				Authors       string `json:"authors"`
				ParticipantID int    `json:"participant_id"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if req.ParticipantID == 0 {
				writeError(w, http.StatusBadRequest, "participant_id is required")
				return
			}
			// Move existing nomination to backlog
			existing, err := bs.GetNominationByParticipant(req.ParticipantID)
			if err == nil && existing != nil {
				if err := bs.MoveToBacklog(existing.ID); err != nil {
					writeError(w, http.StatusInternalServerError, "failed to move old nomination")
					return
				}
			}
			if req.BookID != nil {
				// Nominate existing book from backlog
				book, err := bs.NominateFromBacklog(*req.BookID, req.ParticipantID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to nominate from backlog")
					return
				}
				writeJSON(w, http.StatusOK, book)
			} else {
				// Create new nomination
				req.Title = strings.TrimSpace(req.Title)
				req.Authors = strings.TrimSpace(req.Authors)
				if req.Title == "" || req.Authors == "" {
					writeError(w, http.StatusBadRequest, "title and authors are required when book_id is not provided")
					return
				}
				book, err := bs.Create(&model.Book{
					Title:       req.Title,
					Authors:     req.Authors,
					NominatedBy: &req.ParticipantID,
					Status:      "nominated",
				})
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to create nomination")
					return
				}
				writeJSON(w, http.StatusCreated, book)
			}
			return
		}

		id, ok := parseIDFromPath(r.URL.Path, adminPrefix+"books/")
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid book ID")
			return
		}

		// Handle /books/{id}/move-to-backlog
		if strings.HasSuffix(r.URL.Path, "/move-to-backlog") {
			if r.Method != http.MethodPost {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			if err := bs.MoveToBacklog(id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to move to backlog")
				return
			}
			book, _ := bs.GetByID(id)
			writeJSON(w, http.StatusOK, book)
			return
		}

		switch r.Method {
		case http.MethodPut:
			var req struct {
				Title       string `json:"title"`
				Authors     string `json:"authors"`
				Description string `json:"description"`
				Link        string `json:"link"`
			}
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			req.Title = strings.TrimSpace(req.Title)
			req.Authors = strings.TrimSpace(req.Authors)
			if req.Title == "" {
				writeError(w, http.StatusBadRequest, "title is required")
				return
			}
			if req.Authors == "" {
				writeError(w, http.StatusBadRequest, "authors is required")
				return
			}
			updated, err := bs.Update(id, &model.Book{
				Title:       req.Title,
				Authors:     req.Authors,
				Description: req.Description,
				Link:        req.Link,
			})
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to update book")
				return
			}
			writeJSON(w, http.StatusOK, updated)
		case http.MethodDelete:
			if err := bs.Delete(id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusNotFound, "book not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to delete book")
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	// Serve embedded SPA for club paths.
	frontendFS, _ := fs.Sub(Static, "frontend")

	clubPrefix := "/" + clubSecret + "/"
	mux.HandleFunc(clubPrefix, func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, clubPrefix)

		// Try to serve as a static asset. The SPA is served at varying
		// depths (/{club}/, /{club}/admin/{admin}/), so relative asset
		// paths like ./assets/foo.js resolve to different URL prefixes.
		// We try the path as-is first, then strip leading directories
		// to find "assets/..." in the embedded FS.
		if path != "" {
			if serveStaticFile(w, frontendFS, path) {
				return
			}
			if idx := strings.Index(path, "assets/"); idx > 0 {
				if serveStaticFile(w, frontendFS, path[idx:]) {
					return
				}
			}
		}

		// SPA fallback: serve index.html.
		index, err := fs.ReadFile(frontendFS, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write(index)
	})

	return mux
}

// serveStaticFile tries to read and serve a file from the given FS.
// Returns true if the file was found and served.
func serveStaticFile(w http.ResponseWriter, fsys fs.FS, path string) bool {
	f, err := fs.ReadFile(fsys, path)
	if err != nil {
		return false
	}
	ct := "application/octet-stream"
	switch {
	case strings.HasSuffix(path, ".js"):
		ct = "application/javascript"
	case strings.HasSuffix(path, ".css"):
		ct = "text/css"
	case strings.HasSuffix(path, ".html"):
		ct = "text/html"
	case strings.HasSuffix(path, ".svg"):
		ct = "image/svg+xml"
	case strings.HasSuffix(path, ".png"):
		ct = "image/png"
	case strings.HasSuffix(path, ".ico"):
		ct = "image/x-icon"
	case strings.HasSuffix(path, ".json"):
		ct = "application/json"
	case strings.HasSuffix(path, ".woff2"):
		ct = "font/woff2"
	case strings.HasSuffix(path, ".woff"):
		ct = "font/woff"
	}
	w.Header().Set("Content-Type", ct)
	_, _ = w.Write(f)
	return true
}
