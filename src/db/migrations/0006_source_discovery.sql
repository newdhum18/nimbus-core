-- Phase 14: autonomous source discovery candidates and provenance.
CREATE TABLE IF NOT EXISTS source_candidates (
  id TEXT PRIMARY KEY,
  normalized_url TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  discovered_from_source_id TEXT,
  discovered_from_run_id TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count >= 0),
  mega_links_found INTEGER NOT NULL DEFAULT 0 CHECK(mega_links_found >= 0),
  successful_fetches INTEGER NOT NULL DEFAULT 0 CHECK(successful_fetches >= 0),
  failed_fetches INTEGER NOT NULL DEFAULT 0 CHECK(failed_fetches >= 0),
  confidence REAL NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'candidate',
  promoted_source_id TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_error TEXT,
  FOREIGN KEY(discovered_from_source_id) REFERENCES sources(id) ON DELETE SET NULL,
  FOREIGN KEY(discovered_from_run_id) REFERENCES runs(id) ON DELETE SET NULL,
  FOREIGN KEY(promoted_source_id) REFERENCES sources(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_source_candidates_state ON source_candidates(state, confidence DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_candidates_host ON source_candidates(host, state);
