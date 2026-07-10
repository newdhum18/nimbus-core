-- Nimbus Core V34 canonical D1 schema.
-- Apply with: npx wrangler d1 execute nimbus-db --file=schema.sql
CREATE TABLE IF NOT EXISTS nimbus_v27sb_runs(
 id TEXT PRIMARY KEY, mode TEXT NOT NULL, keyword TEXT, status TEXT NOT NULL DEFAULT 'running',
 started_at TEXT NOT NULL, finished_at TEXT, elapsed_ms INTEGER DEFAULT 0,
 pages_scanned INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, links_alive INTEGER DEFAULT 0,
 links_dead INTEGER DEFAULT 0, links_unknown INTEGER DEFAULT 0, sources_used INTEGER DEFAULT 0, notes TEXT,
 current_stage TEXT DEFAULT 'discovery', last_heartbeat TEXT, source_cursor INTEGER DEFAULT 0, query_cursor INTEGER DEFAULT 0, planned_sources INTEGER DEFAULT 0, seeded_sources INTEGER DEFAULT 0, total_tasks INTEGER DEFAULT 0,
 completed_tasks INTEGER DEFAULT 0, failed_tasks INTEGER DEFAULT 0, progress_percent REAL DEFAULT 0, resume_count INTEGER DEFAULT 0, stop_reason TEXT, sources_exhausted INTEGER DEFAULT 0, progress_floor REAL DEFAULT 0, orchestrator TEXT DEFAULT 'queue_or_cron'
);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_pages(
 id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, source TEXT, url TEXT, title TEXT, status INTEGER DEFAULT 0,
 depth INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, scanned_at TEXT NOT NULL, error TEXT, UNIQUE(run_id,url)
);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_links(
 id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, keyword TEXT, keyword_key TEXT NOT NULL DEFAULT '', link TEXT NOT NULL,
 normalized TEXT NOT NULL, type TEXT, source TEXT, page_url TEXT, title TEXT, snippet TEXT, score INTEGER DEFAULT 0,
 health TEXT DEFAULT 'unknown', health_checked_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
 UNIQUE(mode,normalized,keyword_key)
);
CREATE TABLE IF NOT EXISTS nimbus_v28_archive_links(
 normalized TEXT PRIMARY KEY, link TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'folder', source TEXT, sources TEXT DEFAULT '[]',
 page_url TEXT, keyword TEXT DEFAULT '', first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, seen_count INTEGER DEFAULT 1,
 score INTEGER DEFAULT 0, health TEXT DEFAULT 'folder', snippet TEXT
);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_queue(
 id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, kind TEXT NOT NULL, url TEXT, keyword TEXT, source TEXT, priority INTEGER DEFAULT 50,
 status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, available_at TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT, lease_id TEXT, lease_until TEXT, worker_id TEXT
);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_cache(key TEXT PRIMARY KEY,value TEXT,status INTEGER DEFAULT 0,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,hits INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_events(id TEXT PRIMARY KEY,level TEXT,message TEXT,meta TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,enabled INTEGER DEFAULT 1,priority INTEGER DEFAULT 50,template TEXT NOT NULL,config TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nimbus_v27sb_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nimbus_v32_source_metrics(
 source_id TEXT PRIMARY KEY, source_name TEXT, requests INTEGER DEFAULT 0, successes INTEGER DEFAULT 0, blocked INTEGER DEFAULT 0,
 errors INTEGER DEFAULT 0, pages INTEGER DEFAULT 0, candidates INTEGER DEFAULT 0, valid_links INTEGER DEFAULT 0,
 total_response_ms INTEGER DEFAULT 0, last_status INTEGER DEFAULT 0, last_success_at TEXT, last_error TEXT, updated_at TEXT NOT NULL, consecutive_failures INTEGER DEFAULT 0, cooldown_until TEXT
);
CREATE TABLE IF NOT EXISTS nimbus_v32_schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_v32_queue_status ON nimbus_v27sb_queue(status,priority DESC,available_at);
CREATE INDEX IF NOT EXISTS idx_v32_queue_lease ON nimbus_v27sb_queue(status,lease_until);
CREATE INDEX IF NOT EXISTS idx_v32_links_run ON nimbus_v27sb_links(run_id);
CREATE INDEX IF NOT EXISTS idx_v32_archive_last ON nimbus_v28_archive_links(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_v32_source_yield ON nimbus_v32_source_metrics(valid_links DESC,successes DESC);

CREATE TABLE IF NOT EXISTS nimbus_v33_visited_urls(
 url_hash TEXT PRIMARY KEY,url TEXT NOT NULL,source TEXT,first_scanned_at TEXT NOT NULL,last_scanned_at TEXT NOT NULL,
 last_status INTEGER DEFAULT 0,links_found INTEGER DEFAULT 0,content_hash TEXT,scan_count INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS nimbus_v33_run_tasks(
 id TEXT PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT,source_name TEXT,query TEXT,status TEXT DEFAULT 'planned',
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(run_id,source_id,query)
);
CREATE INDEX IF NOT EXISTS idx_v34_visited_last ON nimbus_v33_visited_urls(last_scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_v34_run_tasks_run ON nimbus_v33_run_tasks(run_id,status);
