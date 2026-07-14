-- Phase 16.3: split candidate provenance across AutoScan and Source Discovery runs.
PRAGMA foreign_keys=OFF;
CREATE TABLE source_candidates_v17 (
  id TEXT PRIMARY KEY, normalized_url TEXT NOT NULL UNIQUE, host TEXT NOT NULL,
  discovered_from_source_id TEXT, discovered_from_autoscan_run_id TEXT, discovered_from_discovery_run_id TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count >= 0), mega_links_found INTEGER NOT NULL DEFAULT 0 CHECK(mega_links_found >= 0),
  successful_fetches INTEGER NOT NULL DEFAULT 0 CHECK(successful_fetches >= 0), failed_fetches INTEGER NOT NULL DEFAULT 0 CHECK(failed_fetches >= 0),
  confidence REAL NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'candidate', promoted_source_id TEXT,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, last_error TEXT, pages_tested INTEGER NOT NULL DEFAULT 0,
  novel_links_found INTEGER NOT NULL DEFAULT 0, alive_links_found INTEGER NOT NULL DEFAULT 0, duplicate_links_found INTEGER NOT NULL DEFAULT 0,
  average_latency REAL NOT NULL DEFAULT 0, quality_grade TEXT NOT NULL DEFAULT 'C', family TEXT NOT NULL DEFAULT 'unknown', rejection_reason TEXT,
  FOREIGN KEY(discovered_from_source_id) REFERENCES sources(id) ON DELETE SET NULL,
  FOREIGN KEY(discovered_from_autoscan_run_id) REFERENCES runs(id) ON DELETE SET NULL,
  FOREIGN KEY(discovered_from_discovery_run_id) REFERENCES source_discovery_runs(id) ON DELETE SET NULL,
  FOREIGN KEY(promoted_source_id) REFERENCES sources(id) ON DELETE SET NULL
);
INSERT INTO source_candidates_v17(id,normalized_url,host,discovered_from_source_id,discovered_from_autoscan_run_id,discovered_from_discovery_run_id,evidence_count,mega_links_found,successful_fetches,failed_fetches,confidence,state,promoted_source_id,first_seen_at,last_seen_at,last_error,pages_tested,novel_links_found,alive_links_found,duplicate_links_found,average_latency,quality_grade,family,rejection_reason)
SELECT sc.id,sc.normalized_url,sc.host,sc.discovered_from_source_id,
CASE WHEN EXISTS(SELECT 1 FROM runs r WHERE r.id=sc.discovered_from_run_id) THEN sc.discovered_from_run_id ELSE NULL END,
CASE WHEN EXISTS(SELECT 1 FROM source_discovery_runs sr WHERE sr.id=sc.discovered_from_run_id) THEN sc.discovered_from_run_id ELSE NULL END,
sc.evidence_count,sc.mega_links_found,sc.successful_fetches,sc.failed_fetches,sc.confidence,sc.state,sc.promoted_source_id,sc.first_seen_at,sc.last_seen_at,sc.last_error,sc.pages_tested,sc.novel_links_found,sc.alive_links_found,sc.duplicate_links_found,sc.average_latency,sc.quality_grade,sc.family,sc.rejection_reason FROM source_candidates sc;
DROP TABLE source_candidates;
ALTER TABLE source_candidates_v17 RENAME TO source_candidates;
CREATE INDEX idx_source_candidates_state ON source_candidates(state,confidence DESC,last_seen_at DESC);
CREATE INDEX idx_source_candidates_host ON source_candidates(host,state);
CREATE INDEX idx_source_candidates_autoscan_run ON source_candidates(discovered_from_autoscan_run_id,last_seen_at DESC);
CREATE INDEX idx_source_candidates_discovery_run ON source_candidates(discovered_from_discovery_run_id,last_seen_at DESC);
PRAGMA foreign_keys=ON;
