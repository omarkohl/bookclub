# Bookclub

A self-hosted book club voting app. Members nominate books and vote using [quadratic voting](https://en.wikipedia.org/wiki/Quadratic_voting) to pick what to read next.

- Single binary, no external dependencies — Go backend with embedded React frontend and SQLite storage
- Quadratic voting lets members express how strongly they feel about each book
- Optional book backlog for collecting suggestions
- Simple deployment via Docker with a single volume mount
- Access controlled via secret URLs, with optional PINs

See [docs/design.md](docs/design.md) for the full design document.

## Installation

### Docker Compose (recommended)

1. Copy `.env.example` to `.env` and set your secrets:

   ```bash
   cp .env.example .env
   # edit .env — at minimum set BOOKCLUB_CLUB_SECRET and BOOKCLUB_ADMIN_SECRET
   ```

2. Start the service:

   ```bash
   docker compose up -d
   ```

The app is now running at `http://localhost:8080`. The database is persisted in a Docker volume.

- **Member UI:** `http://localhost:8080/{BOOKCLUB_CLUB_SECRET}/`
- **Admin UI:** `http://localhost:8080/{BOOKCLUB_CLUB_SECRET}/admin/{BOOKCLUB_ADMIN_SECRET}/`

### Pre-built binary

Download the binary for your platform from the [latest release](https://github.com/omarkohl/bookclub/releases/latest):

```bash
# Linux (amd64)
curl -L https://github.com/omarkohl/bookclub/releases/latest/download/bookclub-linux-amd64 -o bookclub
chmod +x bookclub

# Run
BOOKCLUB_CLUB_SECRET=mysecret BOOKCLUB_ADMIN_SECRET=myadmin ./bookclub
```

### From source

Requires Go 1.21+ and Node 22+.

```bash
git clone https://github.com/omarkohl/bookclub
cd bookclub
make build
./bin/bookclub
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `BOOKCLUB_PORT` | `8080` | HTTP port |
| `BOOKCLUB_CLUB_SECRET` | `club` | URL segment for member access |
| `BOOKCLUB_ADMIN_SECRET` | `admin` | URL segment for admin access |
| `BOOKCLUB_DB_PATH` | `bookclub.db` | SQLite database path |

The secrets form the URLs — pick something unguessable. There is no login page; access is granted by knowing the URL.

## Development

See [docs/dev.md](docs/dev.md).
