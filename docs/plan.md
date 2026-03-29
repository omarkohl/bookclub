# Implementation Plan

Thin end-to-end slices — each phase results in something a tester can interact with.

**Workflow per phase:** backend-first. Write Go integration tests → implement API → build UI → write Playwright e2e tests for the phase's user-facing behavior. When a phase is complete, check off its items in this doc and commit the update together with that phase.

## Phase 0: Skeleton & Dev Loop
- [x] Go module + Vite React app scaffold
- [x] TanStack Query setup with `refetchOnWindowFocus`
- [x] Go serves embedded SPA with SPA fallback routing (all non-API/non-asset paths under `/{club_secret}/` return `index.html`; auth only at API layer, not SPA serving)
- [x] Frontend derives base path and secrets from URL at runtime (no server-side injection); Vite builds with `base: './'` for relative asset paths
- [x] SQLite connection with WAL mode + migration runner (empty schema)
- [x] `Makefile`: build, lint, fmt, test
- [x] Docker multi-stage build (serves hello world)

**Testable:** Visit the URL, see the React app. Docker works.

## Phase 1: Participants & Identity Selection
- [x] Migration: `settings` + `participants` tables; settings migration inserts default row (credit_budget=100, voting_state='open', pins_enabled=false)
- [x] Admin API: CRUD participants, get/update settings
- [x] Admin UI: bare-bones page at `/{club}/admin/{admin}/` — add/remove participants, see list
- [x] User UI: participant picker on `/{club}/` — select who you are, persist in localStorage
- [x] Playwright: admin adds participants, user picks their name

**Testable:** Admin adds participants, user visits and picks their name.

## Phase 2: Nominations
- [ ] Migration: `books` table
- [ ] API: nominate a book (title, authors, description, link), list nominations
- [ ] API: delete own nomination (permanent deletion; move-to-backlog added in Phase 7)
- [ ] UI: nomination form, book list showing current nominations
- [ ] UI: empty state message when no nominations exist, encouraging user to nominate and tell others
- [ ] One-active-nomination-per-user enforcement (replacing old nomination deletes the old one and its votes)
- [ ] Playwright: user nominates, sees nominations, replaces nomination, deletes nomination

**Testable:** Users nominate books and see each other's nominations.

## Phase 3: Voting (Quadratic)
- [ ] Migration: `votes` table
- [ ] API: submit votes (credit distribution), get own votes
- [ ] API: compute QV scores (`SUM(sqrt(credits))`) — only returned when revealed
- [ ] UI: credit distribution interface with prominent remaining-credits display (budget − sum of allocated, always visible)
- [ ] Users can vote on their own nominations
- [ ] Client-side validation (budget, non-negative) + server-side enforcement
- [ ] Playwright: user distributes credits, sees own allocation, remaining credits update live

**Testable:** Users distribute credits across books, see their own allocation. Remaining credits always clearly visible.

## Phase 4: Voting State & Results
- [ ] API: toggle voting state (open ↔ revealed)
- [ ] Freeze nominations when results revealed (reject nominate/delete/replace)
- [ ] User UI: when revealed — show scores & ranking, lock voting; when open — hide scores, allow voting
- [ ] Admin UI: toggle button
- [ ] Playwright: full cycle — nominate → vote → admin reveals → see winner → admin re-opens

**Testable:** Full cycle: nominate → vote → admin reveals → see winner → admin re-opens.

## Phase 5: Credit Budget Management
- [ ] API: set credit budget; return affected-user count (users whose spent credits exceed new budget)
- [ ] Decreasing budget clears all votes for over-budget users — they re-vote on next visit
- [ ] Admin UI: credit budget config with confirmation warning showing affected-user count
- [ ] Playwright: admin changes budget, over-budget user's votes are cleared

**Testable:** Admin adjusts credit budget, affected users' votes are reset.

## Phase 6: Admin Participant & Book Management
- [ ] API: remove participant (transaction: delete their nomination + its votes, then delete participant; cascade handles their own votes and sessions)
- [ ] API: admin delete any book permanently
- [ ] API: admin set nomination for any user (replaces existing nomination, deleting old one + its votes)
- [ ] Admin UI: participant removal, book deletion, set nomination for user
- [ ] Playwright: admin removes participant, deletes book, sets nomination for user

**Testable:** Admin manages participants and books with proper cascade behavior.

## Phase 7: Backlog
- [ ] API: add to backlog, list/search backlog, delete from backlog
- [ ] API: nominate from backlog (user for self, admin for anyone)
- [ ] Retrofit nomination deletion/replacement: move to backlog is now also an option in addition to permanent delete
- [ ] UI: backlog view with search, "nominate this" action
- [ ] Playwright: add to backlog, nominate from backlog, search, replaced nomination appears in backlog

**Testable:** Users manage a shared reading list and nominate from it. Replaced nominations move to backlog.

## Phase 8: Optional PIN Authentication
- [ ] Migration: `sessions` table, `pin_hash` columns
- [ ] API: enable/disable PINs, set admin PIN, set user PINs
- [ ] API: PIN login → session cookie, session middleware
- [ ] Brute-force lockout (in-memory, 5 attempts / 1 min)
- [ ] UI: PIN entry screen, admin PIN management
- [ ] Playwright: enable PINs, login with PIN, lockout after failed attempts

**Testable:** Admin enables PINs, users must enter PIN to access.

## Phase 9: Polish & Production Readiness
- [ ] Mobile-responsive layout pass
- [ ] Accessibility audit (keyboard nav, ARIA)
- [ ] Book detail expand/collapse in list
- [ ] QV info/explainer box
- [ ] README with deployment instructions

**Testable:** Complete, polished app ready for real use.
