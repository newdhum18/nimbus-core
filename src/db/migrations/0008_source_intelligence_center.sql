-- Phase 16: independent source-discovery runs and source graph intelligence.
CREATE TABLE IF NOT EXISTS source_discovery_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('created','running','paused','completed','failed','cancelled','recovering')),
  profile TEXT NOT NULL DEFAULT 'normal',
  rounds INTEGER NOT NULL DEFAULT 1 CHECK(rounds BETWEEN 1 AND 100),
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  domains_discovered INTEGER NOT NULL DEFAULT 0,
  candidates_created INTEGER NOT NULL DEFAULT 0,
  sources_tested INTEGER NOT NULL DEFAULT 0,
  promoted_sources INTEGER NOT NULL DEFAULT 0,
  rejected_sources INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  error_message TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_discovery_single_active
ON source_discovery_runs((1)) WHERE status IN ('running','paused','recovering');
CREATE INDEX IF NOT EXISTS idx_source_discovery_runs_recent ON source_discovery_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS source_discovery_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES source_discovery_runs(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL,
  seed_value TEXT,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','dispatching','queued','running','completed','failed','cancelled','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  UNIQUE(run_id,url,strategy)
);
CREATE INDEX IF NOT EXISTS idx_source_discovery_tasks_run ON source_discovery_tasks(run_id,status,priority DESC,created_at ASC);

CREATE TABLE IF NOT EXISTS source_graph_edges (
  id TEXT PRIMARY KEY,
  mega_fingerprint TEXT,
  from_host TEXT,
  to_host TEXT NOT NULL,
  discovery_method TEXT NOT NULL,
  evidence_url TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(mega_fingerprint,to_host,discovery_method)
);
CREATE INDEX IF NOT EXISTS idx_source_graph_host ON source_graph_edges(to_host,evidence_count DESC,last_seen_at DESC);

ALTER TABLE source_candidates ADD COLUMN pages_tested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_candidates ADD COLUMN novel_links_found INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_candidates ADD COLUMN alive_links_found INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_candidates ADD COLUMN duplicate_links_found INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_candidates ADD COLUMN average_latency REAL NOT NULL DEFAULT 0;
ALTER TABLE source_candidates ADD COLUMN quality_grade TEXT NOT NULL DEFAULT 'C';
ALTER TABLE source_candidates ADD COLUMN family TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE source_candidates ADD COLUMN rejection_reason TEXT;

-- Rebuild links so upgraded databases accept explicit structural/unknown states.
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS links_v16 (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL, source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL, normalized_url TEXT NOT NULL, link_type TEXT NOT NULL CHECK(link_type IN ('folder','legacy_folder')),
  has_key INTEGER NOT NULL CHECK(has_key IN (0,1)),
  validation_status TEXT NOT NULL CHECK(validation_status IN ('structurally_valid','valid','invalid','unchecked','unknown','dead','pending')),
  is_complete INTEGER NOT NULL CHECK(is_complete IN (0,1)), discovered_at TEXT NOT NULL, checked_at TEXT,
  validation_error TEXT, validated_at TEXT, validation_http_status INTEGER, UNIQUE(run_id,normalized_url)
);
INSERT OR IGNORE INTO links_v16 SELECT id,run_id,page_id,source_id,url,normalized_url,link_type,has_key,CASE WHEN validation_status='valid' THEN 'structurally_valid' ELSE validation_status END,is_complete,discovered_at,checked_at,validation_error,validated_at,validation_http_status FROM links;
DROP TABLE links;
ALTER TABLE links_v16 RENAME TO links;
CREATE INDEX IF NOT EXISTS idx_links_run ON links(run_id,discovered_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_links_normalized ON links(normalized_url);
CREATE INDEX IF NOT EXISTS idx_links_validation ON links(validation_status,validated_at);
PRAGMA foreign_keys=ON;
