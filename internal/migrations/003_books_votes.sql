CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) <= 500 AND length(title) > 0),
    authors TEXT NOT NULL CHECK(length(authors) <= 500 AND length(authors) > 0),
    description TEXT CHECK(length(description) <= 5000),
    link TEXT CHECK(length(link) <= 2000),
    nominated_by INTEGER REFERENCES participants(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK(status IN ('nominated', 'backlog')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_nomination
    ON books(nominated_by) WHERE status = 'nominated';

CREATE TABLE IF NOT EXISTS votes (
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL CHECK(credits > 0),
    PRIMARY KEY (participant_id, book_id)
);
