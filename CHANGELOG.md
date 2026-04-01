# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-01

### Added

- Single Go binary serving a React SPA with embedded SQLite — no external dependencies
- Secret URL-based access control: separate club and admin URLs
- Participant management: admin can add and remove participants
- Book nominations: one active nomination per participant; replacing a nomination moves the old one to backlog
- Backlog: shared pool of books searchable by title, authors, or description; anyone can add or delete entries
- Admin can add books directly to the backlog and nominate any book for any participant
- Quadratic voting: configurable credit budget (default 100) distributed across nominated books; scores computed as `SUM(sqrt(credits))`
- Voting state toggle: admin switches between "Voting open" and "Results revealed"
- Per-participant credit breakdown visible in results view
- Book detail cards: title, authors, description, link, and nominator
- Credit budget management: admin can change the budget with a warning showing how many users will be affected
- Docker image with multi-stage build; SQLite database on a persistent volume
- Binaries published for Linux, macOS, and Windows (amd64 and arm64)

[0.1.0]: https://github.com/omarkohl/bookclub/releases/tag/v0.1.0
