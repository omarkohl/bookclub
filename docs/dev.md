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
make dev            # Start Vite dev server (frontend HMR)
```

## Running Locally

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
