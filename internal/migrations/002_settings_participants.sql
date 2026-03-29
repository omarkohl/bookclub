-- Migration 002: settings and participants tables

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    credit_budget INTEGER NOT NULL DEFAULT 100,
    voting_state TEXT NOT NULL DEFAULT 'open' CHECK(voting_state IN ('open', 'revealed')),
    pins_enabled BOOLEAN NOT NULL DEFAULT 0,
    admin_pin_hash TEXT
);

-- Insert default settings row.
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK(length(name) <= 100 AND length(name) > 0),
    pin_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
