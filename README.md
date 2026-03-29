# Bookclub

A self-hosted book club voting app. Members nominate books and vote using [quadratic voting](https://en.wikipedia.org/wiki/Quadratic_voting) to pick what to read next.

- Single binary, no external dependencies — Go backend with embedded React frontend and SQLite storage
- Quadratic voting lets members express how strongly they feel about each book
- Optional book backlog for collecting suggestions
- Simple deployment via Docker with a single volume mount
- Access controlled via secret URLs, with optional PINs

See [docs/design.md](docs/design.md) for the full design document.
