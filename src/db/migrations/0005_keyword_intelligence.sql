-- Phase 13.3 adaptive keyword discovery vocabulary.
CREATE TABLE IF NOT EXISTS search_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  term TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 1,
  hits INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(category,term)
);
CREATE INDEX IF NOT EXISTS idx_search_terms_category_score ON search_terms(category,enabled,score DESC,hits DESC);
