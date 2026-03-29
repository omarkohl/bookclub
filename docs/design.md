# Bookclub App — Design Document

## Overview

A self-hosted book club voting app using quadratic voting. Single Go binary serving a React SPA with SQLite storage. One book club per deployment, no external dependencies.

## Tech Stack

- **Backend:** Go 1.24, stdlib `net/http` router, `modernc.org/sqlite`
- **Frontend:** React 19, Vite, TanStack Query, Zustand (if needed)
- **Testing:** Playwright (e2e), Vitest (frontend), Go `testing` + `httptest` (backend integration)
- **Deployment:** Single binary with `go:embed`, Docker with multi-stage build, SQLite on volume mount
- **Code quality:** Strict linting, formatting, and TDD (red-green-refactor)

## Architecture

Single Go binary serves the API and the embedded React SPA.

```
/clubsecret/                              → React SPA (user-facing)
/clubsecret/admin/adminsecret/            → React SPA (admin panel)
/api/clubsecret/...                       → JSON API (user endpoints)
/api/clubsecret/admin/adminsecret/...     → JSON API (admin endpoints)
```

### Env Vars

```
BOOKCLUB_CLUB_SECRET=asdf90871234
BOOKCLUB_ADMIN_SECRET=09hf98asdf66
BOOKCLUB_PORT=8080
BOOKCLUB_DB_PATH=/data/bookclub.db
```

Everything else (participants, credit budget, voting state) is configured through the admin UI and stored in SQLite.

### First-Time Setup

On first launch the database is empty. The admin navigates to the admin URL and adds participants before the club is usable. If PINs are enabled, the admin must set their own admin PIN and an initial PIN for each participant they create. Users can change their PINs afterward.

## Security Model

Access is controlled via secret URL path segments:

- **Club access:** `example.com/{club_secret}/`
- **Admin access:** `example.com/{club_secret}/admin/{admin_secret}/`

The admin is a regular participant — they nominate and vote like anyone else. Admin privileges come from knowing the admin URL, not from a separate account.

Optional PINs per user and for the admin can be enabled. Disabled by default.

### PIN Authentication

When PINs are enabled, all participants must have a PIN set, and the admin must have an admin PIN. Users must enter their PIN after selecting their name.

- PINs are hashed with bcrypt (cost 12) before storage. Plaintext PINs are never persisted.
- On successful PIN entry, the server issues a session cookie (`HttpOnly`, `SameSite=Strict`). The `Secure` flag is set dynamically based on the request (check `r.TLS` or `X-Forwarded-Proto` header), so it works automatically in both local dev (HTTP) and production (HTTPS behind a reverse proxy).
- Sessions are stored server-side in a `sessions` table with an expiry (e.g., 7 days). Expired sessions are cleaned up periodically.
- Brute-force protection: after 5 failed attempts for a given participant, enforce a 1-minute lockout. Track attempts in memory (not persisted — resets on restart, which is acceptable).

### Identity Without PINs

When PINs are disabled (the default), the server has no way to verify user identity. The client sends a `participant_id` with each API request and the server trusts it as-is. There is no auth middleware in this path. This is acceptable for a small trusted group.

### Documented Limitations

- URLs appear in browser history, server logs, referrer headers, and shared screenshots.
- Anyone with the club URL can impersonate any participant by selecting their name (unless PINs are enabled).
- The admin URL contains the club secret, so anyone who sees it also has user access.
- The admin can peek at results by toggling to "revealed" and back — this is by design for a small trusted group.
- For higher security, enable PINs.

## Data Model (SQLite)

SQLite with WAL mode enabled. Key PRAGMAs: `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`.

Schema is auto-migrated on startup. Migrations are embedded in the Go binary and run sequentially. Each migration is idempotent and forward-only (no rollbacks).

### Tables

**settings** — single row enforced by `id INTEGER PRIMARY KEY CHECK(id = 1)`
- `credit_budget` (integer, default: 100)
- `voting_state` (text, CHECK: `open` | `revealed`, default: `open`)
- `pins_enabled` (boolean, default: false)
- `admin_pin_hash` (text, nullable)

**participants**
- `id` (integer, PK)
- `name` (text, unique, max 100 chars)
- `pin_hash` (text, nullable)
- `created_at` (timestamp)

**books**
- `id` (integer, PK)
- `title` (text, max 500 chars)
- `authors` (text, max 500 chars)
- `description` (text, nullable, max 5000 chars)
- `link` (text, nullable, max 2000 chars)
- `nominated_by` (FK → participants, nullable, ON DELETE RESTRICT) — nullable because backlog books have no nominator; RESTRICT ensures the app must move the book to backlog before deleting the participant, failing loudly if it doesn't
- `status` (text, CHECK: `nominated` | `backlog`)
- `created_at` (timestamp)

**votes**
- `participant_id` (FK → participants, ON DELETE CASCADE)
- `book_id` (FK → books, ON DELETE CASCADE)
- `credits` (integer, CHECK: > 0) — credits assigned by this user to this book; row is deleted when credits reach 0
- Primary key on `(participant_id, book_id)`

**sessions** (only used when PINs are enabled)
- `token` (text, PK)
- `participant_id` (FK → participants, nullable, ON DELETE CASCADE)
- `is_admin` (boolean, default: false)
- `expires_at` (timestamp)

## Two States

| State              | Voting | Totals visible | Can change votes |
|--------------------|--------|----------------|------------------|
| **Voting open**    | Yes    | No             | Yes              |
| **Results revealed** | No   | Yes            | No               |

The admin toggles between these. Hiding results re-opens voting with all existing votes intact.

There is no formal "round" concept. After the group picks a book, the admin typically just deletes the winning book and re-opens voting. Existing nominations and votes carry over — users likely haven't changed their minds about what they want to read next.

## Quadratic Voting

Each user gets a configurable credit budget (default: 100). Users distribute integer credits across nominated books. Total credits assigned must not exceed the budget. A book's effective vote score is computed as `SUM(sqrt(credits))` across all users — this is the quadratic voting mechanism. Scores are computed dynamically, not stored.

- No negative credit assignments.
- Users are warned if they don't use all credits, but it's allowed.
- Server-side validation always enforced. Input constraints (max lengths, credit bounds, etc.) are validated at the API layer and return descriptive 400 errors — not left to DB constraint failures.
- Tie-breaking is out of scope — the group decides.
- An optional info box explains QV and why it's used.

## User Flow

1. Open club URL → select who you are (persisted in local storage, easy to switch).
2. If no active nomination → prompted to nominate (can skip).
3. Nominate: enter a new book or choose one from the backlog. One active nomination per user.
4. Vote: distribute credits across all nominated books.
5. See book list with total votes (when revealed) and own credit distribution.
6. Click a book to see details (title, authors, description, link, nominator).
7. Cannot see other users' credit distributions.

## Key Behaviors

### Nominations
- One active nomination per user at a time, enforced by a partial unique index: `CREATE UNIQUE INDEX idx_one_nomination ON books(nominated_by) WHERE status = 'nominated'`.
- Setting a new nomination for a user who already has one replaces it (the old nomination is moved to backlog and its votes deleted). Other users who voted on the replaced book lose those votes without notification — their credits are simply returned. This applies to both user self-service and admin actions.
- A user can nominate a new book or pick from the backlog.
- A user can move their nomination back to the backlog, or delete it entirely.
- When a nomination is removed (moved to backlog or deleted), all votes on that book are deleted and credits returned.
- After a book is deleted or moved to backlog, the user can nominate again.
- **Voting open:** users can nominate, modify, move to backlog, or delete their nomination freely.
- **Results revealed:** nominations are frozen — no nominating, modifying, moving, or deleting nominations.

### Backlog
- Anyone can add books to the backlog, and delete backlog entries, in either state (voting open or results revealed).
- Books are either nominated or in the backlog, never both.
- A user nominates from the backlog for themselves. The admin can do so for any user.
- Backlog is searchable by title, authors, and description.

### Admin Capabilities
- Configure the participant list (add/remove users).
- Set the credit budget.
- Toggle voting open / results revealed.
- Delete books permanently.
- Move nominations to the backlog.
- Set nominations for any user.

### Removing a Participant

Handled as a single transaction in application code:

1. Move their nominated book (if any) to backlog and delete all votes on it.
2. Delete the participant (cascades their own votes and sessions via FK constraints).

### Credit Budget Changes
- If the admin decreases the credit budget and a user's total spent exceeds the new budget, that user's votes are cleared entirely. The user re-votes on their next visit.
- The admin UI warns how many users will be affected before confirming the change.

## UI Requirements

- Mobile responsive (primary concern).
- Accessible and keyboard-navigable. Keyboard shortcuts where appropriate, made discoverable.
- Overview table stays uncluttered — click a book to expand details.
- Real-time updates not required — data refreshes on page load and on window focus.

## Testing Strategy

Strict TDD: write a failing test first, then implement.

- **Go integration tests:** `httptest.Server` with a temp SQLite file. Test full HTTP request/response cycles covering all API endpoints and business logic.
- **Playwright e2e:** full stack (Go server + built React app). Test complete user journeys — select user, nominate, vote, admin reveals, see results.
- **Vitest + React Testing Library:** only for complex UI logic (credit calculator, QV cost validation). Do not test every component in isolation.

## Docker

Multi-stage build: build frontend → build Go binary with embedded frontend → minimal Alpine runtime image.

```yaml
services:
  bookclub:
    image: bookclub
    ports: ["8080:8080"]
    volumes:
      - bookclub-data:/data
    environment:
      - BOOKCLUB_CLUB_SECRET=changeme
      - BOOKCLUB_ADMIN_SECRET=changeme
      - BOOKCLUB_DB_PATH=/data/bookclub.db

volumes:
  bookclub-data:
```

The SQLite database, WAL, and SHM files must all reside on the mounted volume — never on Docker's overlay filesystem.
