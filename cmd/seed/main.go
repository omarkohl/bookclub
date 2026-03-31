// seed generates test data by calling the bookclub API.
//
// Usage:
//
//	go run ./cmd/seed [flags]
//
// Flags:
//
//	-base-url   Base URL of the running server (default: http://localhost:8080)
//	-club       Club secret (default: club)
//	-admin      Admin secret (default: admin)
//
// Example:
//
//	go run ./cmd/seed -base-url http://localhost:8080 -club myclub -admin myadmin
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

func main() {
	baseURL := flag.String("base-url", "http://localhost:8080", "base URL of the running server")
	clubSecret := flag.String("club", "club", "club secret")
	adminSecret := flag.String("admin", "admin", "admin secret")
	flag.Parse()

	s := &seeder{
		client:    &http.Client{},
		userBase:  fmt.Sprintf("%s/api/%s", *baseURL, *clubSecret),
		adminBase: fmt.Sprintf("%s/api/%s/admin/%s", *baseURL, *clubSecret, *adminSecret),
	}
	s.run()
}

type seeder struct {
	client    *http.Client
	userBase  string
	adminBase string
}

func (s *seeder) run() {
	// Participants
	participants := []string{
		"Alice", "Bob", "Carol", "Dave", "Eve",
	}
	participantIDs := make(map[string]int, len(participants))
	for _, name := range participants {
		id := s.createParticipant(name)
		participantIDs[name] = id
	}

	// Nominated books — one per participant (the unique-nomination constraint allows one active
	// nomination per participant).
	type book struct {
		nominatedBy string
		title       string
		authors     string
		description string
		link        string
	}
	nominatedBooks := []book{
		{
			nominatedBy: "Alice",
			title:       "The Pragmatic Programmer",
			authors:     "David Thomas, Andrew Hunt",
			description: "A landmark book in software craftsmanship that covers the full arc of a developer's career. It ranges from personal responsibility and career development to architectural techniques for keeping your code flexible and easy to adapt and reuse. The authors draw from their combined experience to present a collection of tips, tools, and philosophies — covering topics like the DRY principle, orthogonality, tracer bullets, and the importance of investing in your knowledge portfolio. Both the 1999 original and the 20th anniversary edition remain essential reading.",
			link:        "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
		},
		{
			nominatedBy: "Bob",
			title:       "Designing Data-Intensive Applications",
			authors:     "Martin Kleppmann",
			description: "A comprehensive guide to the principles, algorithms, and trade-offs underlying modern data systems. Kleppmann covers relational and NoSQL databases, replication, partitioning, transactions, consistency and consensus, stream processing, and batch processing — always tying theory back to real-world systems like Kafka, Cassandra, Zookeeper, and Flink. The book is notable for not advocating any single technology but instead giving readers the mental models to evaluate any data system on its own merits. An indispensable reference for engineers building anything that stores or processes data at scale.",
			link:        "https://dataintensive.net/",
		},
		{
			nominatedBy: "Carol",
			title:       "A Philosophy of Software Design",
			authors:     "John Ousterhout",
			description: "Ousterhout argues that the root cause of most software problems is complexity, and that the primary job of a designer is to create deep modules that hide complexity behind simple interfaces. The book challenges conventional wisdom — pushing back on practices like commenting every function, making classes small for their own sake, or splitting code purely for testability. It introduces concepts such as tactical vs. strategic programming, information hiding, and the danger of shallow abstractions. Slim but dense: each chapter rewards careful reading.",
		},
		{
			nominatedBy: "Dave",
			title:       "Staff Engineer: Leadership beyond the management track",
			authors:     "Will Larson",
			description: "Practical guide to operating effectively at and above the staff engineer level.",
			link:        "https://staffeng.com/book",
		},
		{
			nominatedBy: "Eve",
			title:       "An Elegant Puzzle: Systems of Engineering Management",
			authors:     "Will Larson",
			description: "Engineering management from someone who has grown multiple large organisations.",
		},
	}

	nominatedBookIDs := make([]int, 0, len(nominatedBooks))
	for _, b := range nominatedBooks {
		id := s.nominateBook(participantIDs[b.nominatedBy], b.title, b.authors, b.description, b.link)
		nominatedBookIDs = append(nominatedBookIDs, id)
	}

	// Backlog books (added by admin without a nominator)
	backlogBooks := []book{
		{title: "The Mythical Man-Month", authors: "Frederick P. Brooks Jr.", description: "Essays on software project management; the classic that coined Brooks's Law."},
		{title: "Clean Code", authors: "Robert C. Martin", description: "Opinionated guide to writing readable, maintainable code."},
		{title: "Accelerate", authors: "Nicole Forsgren, Jez Humble, Gene Kim", description: "Research-backed look at what makes high-performing software delivery teams."},
	}
	for _, b := range backlogBooks {
		s.addToBacklog(b.title, b.authors, b.description, b.link)
	}

	// Votes — each participant distributes up to 100 credits across nominated books
	// (they cannot vote on their own nomination in real usage, but the API does not
	// enforce that restriction, so this seed keeps it simple).
	votes := map[string][]voteEntry{
		"Alice": {
			{bookID: nominatedBookIDs[1], credits: 49}, // Bob's book
			{bookID: nominatedBookIDs[2], credits: 36}, // Carol's book
			{bookID: nominatedBookIDs[3], credits: 9},  // Dave's book
		},
		"Bob": {
			{bookID: nominatedBookIDs[0], credits: 64}, // Alice's book
			{bookID: nominatedBookIDs[4], credits: 25}, // Eve's book
		},
		"Carol": {
			{bookID: nominatedBookIDs[1], credits: 81}, // Bob's book
			{bookID: nominatedBookIDs[3], credits: 9},  // Dave's book
		},
		"Dave": {
			{bookID: nominatedBookIDs[0], credits: 25}, // Alice's book
			{bookID: nominatedBookIDs[2], credits: 49}, // Carol's book
			{bookID: nominatedBookIDs[4], credits: 16}, // Eve's book
		},
		"Eve": {
			{bookID: nominatedBookIDs[1], credits: 100}, // Bob's book
		},
	}
	for name, entries := range votes {
		s.saveVotes(participantIDs[name], entries)
	}

	fmt.Println("\nSeed complete.")
	fmt.Printf("  %d participants\n", len(participants))
	fmt.Printf("  %d nominated books\n", len(nominatedBooks))
	fmt.Printf("  %d backlog books\n", len(backlogBooks))
	fmt.Printf("  %d participants voted\n", len(votes))
}

// --- API helpers ---

func (s *seeder) createParticipant(name string) int {
	body := map[string]string{"name": name}
	var result struct {
		ID int `json:"id"`
	}
	s.post(s.adminBase+"/participants", body, &result)
	log.Printf("created participant %q (id=%d)", name, result.ID)
	return result.ID
}

func (s *seeder) nominateBook(participantID int, title, authors, description, link string) int {
	body := map[string]any{
		"title":          title,
		"authors":        authors,
		"description":    description,
		"link":           link,
		"participant_id": participantID,
	}
	var result struct {
		ID int `json:"id"`
	}
	s.post(s.userBase+"/books", body, &result)
	log.Printf("nominated book %q (id=%d)", title, result.ID)
	return result.ID
}

func (s *seeder) addToBacklog(title, authors, description, link string) int {
	body := map[string]any{
		"title":       title,
		"authors":     authors,
		"description": description,
		"link":        link,
	}
	var result struct {
		ID int `json:"id"`
	}
	s.post(s.userBase+"/backlog", body, &result)
	log.Printf("added to backlog %q (id=%d)", title, result.ID)
	return result.ID
}

type voteEntry struct {
	bookID  int
	credits int
}

func (s *seeder) saveVotes(participantID int, entries []voteEntry) {
	type votePayload struct {
		BookID  int `json:"book_id"`
		Credits int `json:"credits"`
	}
	votes := make([]votePayload, len(entries))
	for i, e := range entries {
		votes[i] = votePayload{BookID: e.bookID, Credits: e.credits}
	}
	body := map[string]any{
		"participant_id": participantID,
		"votes":          votes,
	}
	s.post(s.userBase+"/votes", body, nil)
	log.Printf("saved %d vote(s) for participant id=%d", len(entries), participantID)
}

func (s *seeder) post(url string, body any, out any) {
	data, err := json.Marshal(body)
	must(err)
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(data))
	must(err)
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	must(err)
	if resp.StatusCode >= 300 {
		log.Fatalf("POST %s → %d: %s", trimBase(url), resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if out != nil && len(raw) > 0 {
		must(json.Unmarshal(raw, out))
	}
}

func trimBase(url string) string {
	// Keep only the path portion for cleaner error messages.
	if i := strings.Index(url, "/api/"); i >= 0 {
		return url[i:]
	}
	return url
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
