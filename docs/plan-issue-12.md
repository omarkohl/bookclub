# Plan: User Sessions and Optional Passwords (Issue #12)

## Goal

Establish server-side sessions for all users (even without passwords), let users optionally set a PIN, and let the admin require PINs globally. This replaces the current trust-based `participant_id`-in-request-body model and is a prerequisite for scoping data access (#11).

> **Note:** This plan supersedes the session and authentication sections in `docs/design.md` (specifically "PIN Authentication", "Identity Without PINs", and the `sessions` table schema). `docs/design.md` will be deleted after this work is complete.

## Current State

- **Identity**: Client stores `participant_id` in localStorage, sends it in request bodies. Server trusts it blindly.
- **DB schema**: `settings.pins_enabled`, `settings.admin_pin_hash`, `participants.pin_hash` columns exist but are unused.
- **Sessions table**: Not created yet (design doc specifies it).
- **Middleware**: None exists.
- **Frontend**: `UserPage.tsx` has a participant picker that writes to localStorage.

## Design Decisions

### Sessions always, PINs optional per-user

`settings.pins_enabled` controls whether the admin **forces** all users to have PINs. But any user can always choose to set a PIN for their own account, regardless of this flag. This is a personal convenience-vs-security tradeoff.

| | PINs not forced (default) | PINs forced by admin |
|---|---|---|
| **User login (no PIN set)** | Select name → session created immediately | Select name → must set PIN first → session created |
| **User login (PIN set)** | Select name → enter PIN → session created | Select name → enter PIN → session created |
| **Admin login (no admin PIN)** | Navigate to admin URL → session created immediately | Navigate to admin URL → must set admin PIN first → session created |
| **Admin login (admin PIN set)** | Navigate to admin URL → enter admin PIN → session created | Navigate to admin URL → enter admin PIN → session created |
| **Session cookies** | `bookclub_session` + `bookclub_admin_session` | Same two cookies |
| **Server trusts** | Session token → participant_id | Session token → participant_id |
| **participant_id in body** | Ignored — derived from session | Ignored — derived from session |

The key rule: if a user has a `pin_hash`, their PIN is always checked at login — regardless of `pins_enabled`. The flag only controls whether users *without* a PIN are forced to set one.

Even in "no PIN" mode, the server never trusts client-supplied `participant_id`. Identity always comes from the session. This supersedes the design doc's "Identity Without PINs" section, which described trusting client-supplied `participant_id` with no auth middleware.

### Separate cookies for user and admin

Two cookies, because the admin is also a regular participant and needs both sessions simultaneously:

- **`bookclub_session`** — user session, `Path: /{club_secret}/`
- **`bookclub_admin_session`** — admin session, `Path: /{club_secret}/admin/{admin_secret}/`

Both are `HttpOnly`, `SameSite=Strict`, `Path=/`. `Secure` set dynamically based on `r.TLS` or `X-Forwarded-Proto`. Expiry: 7 days, refreshed on use. `Path=/` is necessary because the SPA (`/{club_secret}/`) and API (`/api/{club_secret}/`) don't share a path prefix. This is safe: single-tenant deployment, cookie values are opaque random tokens.

### When the user sees a PIN prompt

| Situation | PINs not forced | PINs forced |
|---|---|---|
| User selects name, no PIN set | No prompt, session created | Prompt to **set** a new PIN, then session created |
| User selects name, PIN set | PIN prompt shown | PIN prompt shown |
| Admin opens admin page, no admin PIN | No prompt, session created | Prompt to **set** admin PIN before anything else |
| Admin opens admin page, admin PIN set | Admin PIN prompt shown | Admin PIN prompt shown |
| User visits with existing valid session cookie | No prompt, straight to app | No prompt, straight to app |
| Session expired, no PIN set | Back to name picker | Back to name picker + set PIN prompt |
| Session expired, PIN set | Back to name picker + PIN prompt | Back to name picker + PIN prompt |

### PIN reset flow

When a user forgets their PIN, the admin clears their PIN via the admin UI. The user's existing sessions are invalidated. On next visit, the server returns `pin_setup_required` and the user sets a new PIN themselves.

## Implementation Steps

### Step 1: Migration — sessions table

New migration `004_sessions.sql`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
```

Admin sessions have `is_admin=TRUE` and `participant_id=NULL`. User sessions have `is_admin=FALSE` and a non-NULL `participant_id`.

### Step 2: Session store (`internal/store/sessions.go`)

- `Create(participantID *int, isAdmin bool, ttl time.Duration) (token, error)` — generates a `crypto/rand` token (32 bytes, hex-encoded), inserts row, returns token.
- `Get(token string) (*Session, error)` — returns session if not expired.
- `Touch(token string, ttl time.Duration) error` — refresh expiry.
- `Delete(token string) error` — logout.
- `DeleteExpired() (int, error)` — cleanup.
- `DeleteByParticipant(participantID int) error` — invalidate all sessions for a user (used on PIN reset).

Session model in `internal/model/model.go`:

```go
type Session struct {
    Token         string    `json:"token"`
    ParticipantID *int      `json:"participant_id"`
    IsAdmin       bool      `json:"is_admin"`
    CreatedAt     time.Time `json:"created_at"`
    ExpiresAt     time.Time `json:"expires_at"`
}
```

### Step 3: Auth middleware (`internal/handler/middleware.go`)

**`userSessionMiddleware(next http.Handler) http.Handler`**:
1. Read `bookclub_session` cookie.
2. Look up session in DB, check not expired.
3. If valid: refresh expiry, set `participant_id` in request context via `context.WithValue`, proceed.
4. If invalid/missing: return 401 `{"error": "not authenticated"}`.

**`adminSessionMiddleware(next http.Handler) http.Handler`**:
1. Read `bookclub_admin_session` cookie.
2. Look up session in DB, check not expired, check `is_admin = TRUE`.
3. If valid: refresh expiry, proceed.
4. If invalid/missing: return 401.

Both middlewares are always enforced (regardless of `pins_enabled`). The difference is only in how sessions are *created* (with or without PIN verification).

Context helper: `func getParticipantID(r *http.Request) int` extracts from context.

**Public endpoints** (no session required):
- `POST /api/{club}/login` — creates user sessions
- `POST /api/{club}/logout` — clears user session cookie
- `GET /api/{club}/participants` — needed for the name picker before login
- `POST /api/{club}/admin/{admin}/login` — creates admin sessions
- `POST /api/{club}/admin/{admin}/logout` — clears admin session cookie

All other endpoints go behind `userSessionMiddleware` or `adminSessionMiddleware`.

### Step 4: Login/logout endpoints

**User login — `POST /api/{club}/login`**:

The frontend always starts by sending just `{ "participant_id": N }`. The server response tells the frontend what to do next:

| Situation | Request | Response |
|---|---|---|
| No PIN set, PINs not forced | `{ "participant_id": 1 }` | `200` — session created, sets cookie. Body: `{ "participant": { "id": 1, "name": "Alice" } }` |
| No PIN set, PINs forced | `{ "participant_id": 1 }` | `401 { "error": "pin_setup_required" }` |
| PIN set (regardless of flag) | `{ "participant_id": 1 }` | `401 { "error": "pin_required" }` |
| PIN submitted | `{ "participant_id": 1, "pin": "1234" }` | `200` — session created |
| New PIN submitted | `{ "participant_id": 1, "new_pin": "1234" }` | `200` — PIN saved, session created |
| Wrong PIN | `{ "participant_id": 1, "pin": "wrong" }` | `401 { "error": "invalid_pin" }` |
| Locked out (5 failures) | `{ "participant_id": 1, "pin": "..." }` | `423 { "error": "locked_out", "retry_after": 60 }` |

Logic:
1. Validate participant exists.
2. If user has `pin_hash`: require PIN (go to step 5). If user has no `pin_hash` and `pins_enabled`: require PIN setup (return `pin_setup_required`). If user has no `pin_hash` and `!pins_enabled`: create session immediately.
3. If `new_pin` provided (user has no `pin_hash`): hash with bcrypt (cost 12), save to `participants.pin_hash`, create session.
4. If `pin` provided: verify with bcrypt. On failure: track attempt in memory (map + mutex), return 401. After 5 consecutive failures: return 423 with 1-minute lockout.
5. Set `bookclub_session` cookie, return participant info.

**User logout — `POST /api/{club}/logout`**:
Delete session from DB, clear `bookclub_session` cookie.

**User session check — `GET /api/{club}/me`**:
Return current participant info from session, or 401.

**Admin login — `POST /api/{club}/admin/{admin}/login`**:

Same two-phase pattern as user login. Frontend sends `{}` first:

| Situation | Request | Response |
|---|---|---|
| No admin PIN set, PINs not forced | `{}` | `200` — session created |
| No admin PIN set, PINs forced | `{}` | `401 { "error": "pin_setup_required" }` |
| Admin PIN set (regardless of flag) | `{}` | `401 { "error": "pin_required" }` |
| PIN submitted | `{ "pin": "admin-pin" }` | `200` — session created |
| New PIN submitted | `{ "new_pin": "admin-pin" }` | `200` — PIN saved, session created |

Same logic as user login: if `admin_pin_hash` exists, always require it. If not and `pins_enabled`, require setup. If not and `!pins_enabled`, create session immediately. Verifies against `settings.admin_pin_hash`, creates session with `participant_id=NULL` and `is_admin=TRUE`. Same brute-force protection as user login.

**Admin logout — `POST /api/{club}/admin/{admin}/logout`**:
Delete session, clear `bookclub_admin_session` cookie.

**Admin session check — `GET /api/{club}/admin/{admin}/me`**:
Return 200 if valid admin session, 401 otherwise.

### Step 5: PIN management endpoints

**User changes own PIN — `POST /api/{club}/pin`** (requires user session):
```json
{ "current_pin": "old", "new_pin": "new" }
```
If user has no PIN yet: `current_pin` is not required, just set the new PIN.
If user has a PIN: verify `current_pin`, hash `new_pin`, update `participants.pin_hash`.
If `new_pin` is empty and `pins_enabled=false`: clears the PIN (user opts out of PIN protection). If `pins_enabled=true`: clearing is not allowed (return 400).

**Admin sets own PIN — `POST /api/{club}/admin/{admin}/admin-pin`** (requires admin session):
```json
{ "current_pin": "old", "new_pin": "new" }
```
Updates `settings.admin_pin_hash`.

**Admin clears a participant's PIN — `POST /api/{club}/admin/{admin}/participants/{id}/clear-pin`** (requires admin session):
No request body. Sets `participants.pin_hash = NULL` and invalidates all sessions for that participant. On next login, the user is prompted to set a new PIN (`pin_setup_required` flow).

**`PUT /api/{club}/admin/{admin}/settings`** (extended):
When toggling `pins_enabled` (either direction):
- Invalidate all sessions (user and admin). Everyone re-logs in the new mode.

When enabling specifically:
- Validate admin PIN is already set, return 400 if not.

### Step 6: Refactor handlers — derive identity from session

All user endpoints stop accepting `participant_id` in request bodies/query params. Instead, use `getParticipantID(r)` from context:

- `POST /api/{club}/books` — nomination
- `POST /api/{club}/books/nominate-from-backlog`
- `POST /api/{club}/books/{id}/move-to-backlog`
- `PUT /api/{club}/books/{id}` — edit book
- `DELETE /api/{club}/books/{id}` — delete own nomination
- `GET /api/{club}/votes` — get own votes (no query param needed)
- `POST /api/{club}/votes` — submit votes

Admin endpoints still accept `participant_id` in body where they act on behalf of a user (e.g., `nominate-for-user`).

### Step 7: Periodic session cleanup

In `main.go`, start a goroutine with `time.Ticker` (1 hour interval) that calls `sessionStore.DeleteExpired()`. Stops on context cancellation (graceful shutdown).

### Step 8: Frontend — session-based login flow

**`api.ts`**:
- Add `login()`, `logout()`, `getMe()`, `adminLogin()`, `adminLogout()`, `adminGetMe()`.
- Add `changePin()`, `adminClearParticipantPin()`.
- All `fetch` calls: `credentials: 'same-origin'`.
- Remove `participant_id` from all user-facing request bodies.
- Global 401 handler: on any 401 response, clear React state and show login screen.

**`UserPage.tsx`**:
1. On mount: `GET /me`.
   - 200 → user is logged in, show app.
   - 401 → show participant picker.
2. User selects name → `POST /login { participant_id }`.
   - 200 → logged in (PINs disabled), done.
   - 401 `pin_required` → show "enter your PIN" input inline below the name list.
   - 401 `pin_setup_required` → show "set your PIN" form inline below the name list.
3. User submits PIN → `POST /login { participant_id, pin }` or `{ participant_id, new_pin }`.
   - 200 → logged in, done.
   - 401 `invalid_pin` → show error, let user retry.
   - 423 `locked_out` → show lockout message with countdown.
4. On login success: store participant info in React state (no localStorage needed).
5. Logout button: `POST /logout`, clear state → back to picker.

**`AdminPage.tsx`**:
1. On mount: `GET /admin/{admin}/me`.
   - 200 → admin is authenticated, show admin panel.
   - 401 → show admin login.
2. Admin login: `POST /admin/{admin}/login {}`.
   - 200 → logged in (PINs disabled), done.
   - 401 `pin_required` → show admin PIN input.
   - 401 `pin_setup_required` → show "set admin PIN" form.
   - Submit PIN → same flow as user login.
3. Admin panel additions:
   - "Reset PIN" button next to each participant (when PINs enabled).
   - Admin PIN management section.

**Remove localStorage usage**: `bookclub_participant_id` is no longer used. Session cookie replaces it entirely.

### Step 9: Frontend — PIN settings UI

**User profile/settings area** (accessible when logged in):
- Always visible. Users can set/change their PIN at any time, regardless of `pins_enabled`.
- If user has no PIN: "Set PIN" form (new PIN only).
- If user has a PIN: "Change PIN" form (current + new PIN). If `pins_enabled=false`, also a "Remove PIN" option.
- Brief explanation: "Setting a PIN prevents others from logging in as you."

**Admin settings panel** (additions):
- "Enable PINs" toggle with pre-flight check: warns which participants don't have PINs yet, and verifies admin PIN is set.
- "Change admin PIN" form.
- Per-participant "Clear PIN" button: clears the user's PIN so they can set a new one on next login.

## Migration Path

Breaking change to the API contract. Acceptable since this is a small self-hosted app with no external consumers.

Existing data is preserved. After upgrade, all users must "log in" again (select name, enter PIN if enabled). Old localStorage values are ignored.

## Testing Strategy

- **Go integration tests**: Login flows (with/without PINs), session creation/validation/expiry, middleware 401 rejection, PIN brute-force lockout (5 attempts + 1-min cooldown), PIN set/change/reset, admin session flow, session cleanup goroutine.
- **Playwright e2e**: Full user journey with sessions (select name → nominate → vote), PIN-enabled flow (login with PIN, change PIN), admin clears user PIN → user sets new PIN, session expiry forces re-login, admin enables/disables PINs.
