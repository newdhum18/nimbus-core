-- Nimbus Core V36 Zero Foundation: complete source-discovery hardening.
ALTER TABLE source_discovery_tasks ADD COLUMN origin_source_id TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN origin_host TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN input_fingerprint TEXT;
ALTER TABLE source_discovery_tasks ADD COLUMN evidence_url TEXT;
ALTER TABLE source_graph_edges ADD COLUMN from_source_id TEXT;
CREATE INDEX IF NOT EXISTS idx_source_graph_from_source ON source_graph_edges(from_source_id,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_graph_fingerprint ON source_graph_edges(mega_fingerprint,evidence_count DESC,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_discovery_fingerprint ON source_discovery_tasks(input_fingerprint,run_id);
