-- Phase 16.1: background source discovery runtime and domain-level intelligence.
CREATE TABLE IF NOT EXISTS source_candidate_domains (
  host TEXT PRIMARY KEY,
  root_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'candidate' CHECK(state IN ('candidate','testing','sandbox','promoted','rejected','blocked','duplicate','dormant','quarantined')),
  family TEXT NOT NULL DEFAULT 'unknown',
  quality_grade TEXT NOT NULL DEFAULT 'C' CHECK(quality_grade IN ('A','B','C','D')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  pages_tested INTEGER NOT NULL DEFAULT 0,
  extracted_links INTEGER NOT NULL DEFAULT 0,
  novel_links INTEGER NOT NULL DEFAULT 0,
  alive_links INTEGER NOT NULL DEFAULT 0,
  dead_links INTEGER NOT NULL DEFAULT 0,
  unknown_links INTEGER NOT NULL DEFAULT 0,
  duplicate_links INTEGER NOT NULL DEFAULT 0,
  successful_fetches INTEGER NOT NULL DEFAULT 0,
  failed_fetches INTEGER NOT NULL DEFAULT 0,
  blocked_fetches INTEGER NOT NULL DEFAULT 0,
  average_latency REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  promoted_source_id TEXT,
  rejection_reason TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_tested_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_candidate_domains_state ON source_candidate_domains(state,quality_grade,confidence DESC,last_seen_at DESC);

ALTER TABLE source_discovery_tasks ADD COLUMN message_id TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN queued_at TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN lease_until TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN result_json TEXT;
ALTER TABLE source_discovery_runs ADD COLUMN queue_messages INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_discovery_runs ADD COLUMN current_strategy TEXT;
ALTER TABLE source_discovery_runs ADD COLUMN outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','success','partial','failure'));
CREATE INDEX IF NOT EXISTS idx_source_discovery_dispatch ON source_discovery_tasks(run_id,status,lease_until,priority DESC,created_at ASC);
