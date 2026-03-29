# Project Guidelines

## Version Control

- Use `jj` (jujutsu) if available, otherwise `git`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Each commit is a single coherent change
- Commit messages: short, focus on why

## Code Quality

- Strict linting and formatting enforced
- Go: `golangci-lint`, `gofmt`
- Frontend: ESLint (strict config), Prettier
- No warnings allowed

## Testing

- Strict TDD: write a failing test first, then make it pass, then refactor
- Prefer integration/e2e tests over unit tests
- Go: integration tests with `httptest.Server` + real SQLite (temp file)
- Frontend: Playwright for e2e, Vitest only for complex UI logic
- Do not test internals — test behavior from the user's perspective

## Architecture

- See [docs/design.md](docs/design.md) for the full design
- Go backend: `internal/` packages (handler, service, store, model)
- Frontend: React 19 + Vite + TanStack Query
- SQLite with WAL mode via `modernc.org/sqlite`

## Pre-commit

Before committing, always run:
1. Linting
2. Formatting check
3. All tests
