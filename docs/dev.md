# Development Guide

## Prerequisites

- Go 1.24+
- Node.js 22+
- Docker (optional)

## Setup

```sh
# Install frontend dependencies
cd frontend && npm install && cd ..
```

## Common Tasks

Run `make` to see all available targets.

```sh
make build          # Build frontend + Go binary → bin/bookclub
make test           # Run all tests
make lint           # Run all linters
make fmt            # Format all code
make dev-all        # Start backend + frontend with HMR
```

## Development (iterating on both frontend and backend)

```sh
make dev-all
```

This starts the Go backend on `:8080` and the Vite dev server on `:5173` with HMR. The Vite dev server proxies `/api/*` requests to the Go backend.

- User UI: `http://localhost:5173/club/`
- Admin UI: `http://localhost:5173/club/admin/admin/`

Uses the default secrets (`club`/`admin`). To use custom secrets:

```sh
BOOKCLUB_CLUB_SECRET=myclub BOOKCLUB_ADMIN_SECRET=myadmin make dev-backend
# In another terminal:
make dev
```

Then open `http://localhost:5173/myclub/` and `http://localhost:5173/myclub/admin/myadmin/`.

## Running a Production Build Locally

```sh
make build
BOOKCLUB_CLUB_SECRET=myclub BOOKCLUB_ADMIN_SECRET=myadmin ./bin/bookclub
```

Then open:
- User UI: `http://localhost:8080/myclub/`
- Admin UI: `http://localhost:8080/myclub/admin/myadmin/`

## Running with Docker

```sh
docker build -t bookclub .
docker run -p 8080:8080 \
  -e BOOKCLUB_CLUB_SECRET=myclub \
  -e BOOKCLUB_ADMIN_SECRET=myadmin \
  -v bookclub-data:/data \
  -e BOOKCLUB_DB_PATH=/data/bookclub.db \
  bookclub
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BOOKCLUB_PORT` | `8080` | Server port |
| `BOOKCLUB_CLUB_SECRET` | `club` | URL secret for club access |
| `BOOKCLUB_ADMIN_SECRET` | `admin` | URL secret for admin access |
| `BOOKCLUB_DB_PATH` | `bookclub.db` | SQLite database path |

## Seeding Test Data

With the server running, generate a realistic dataset (5 participants, 5 nominated books, 3 backlog books, votes):

```sh
go run ./cmd/seed
```

Custom server or secrets:

```sh
go run ./cmd/seed -base-url http://localhost:9090 -club myclub -admin myadmin
```

## Releasing

Push a version tag to trigger the [release workflow](../.github/workflows/release.yml):

```sh
git tag v1.2.3
git push origin v1.2.3
```

This builds:
- **Binaries** for Linux, macOS, and Windows (amd64 + arm64) — attached to a GitHub release with auto-generated notes
- **Docker image** (multi-arch amd64 + arm64) — pushed to Docker Hub as `omarkohl/bookclub:1.2.3`, `omarkohl/bookclub:1.2`, `omarkohl/bookclub:1`

Required GitHub repository secrets (**Settings → Secrets → Actions**):
- `DOCKERHUB_USERNAME` — Docker Hub username
- `DOCKERHUB_TOKEN` — Docker Hub access token (**Docker Hub → Account Settings → Security → Access Tokens**)

## Project Structure

```
cmd/bookclub/       Entry point
internal/
  handler/          HTTP handlers + embedded SPA
  store/            SQLite data access
  model/            Shared types
  migrations/       SQL migration files
frontend/           React + Vite app
docs/               Design doc + this guide
```
