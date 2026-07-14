PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('autoscan','keyword')),
  keyword TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('created','running','paused','completed','failed','cancelled','recovering')),
  total_tasks INTEGER NOT NULL DEFAULT 0 CHECK(total_tasks >= 0),
  completed_tasks INTEGER NOT NULL DEFAULT 0 CHECK(completed_tasks >= 0),
  failed_tasks INTEGER NOT NULL DEFAULT 0 CHECK(failed_tasks >= 0),
  links_found INTEGER NOT NULL DEFAULT 0 CHECK(links_found >= 0),
  progress REAL NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  created_at TEXT NOT NULL,
  started_at TEXT,
  paused_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  error_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_single_active
ON runs((1)) WHERE status IN ('running','paused','recovering');
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status_updated ON runs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('html','rss','json','custom')),
  template_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  default_enabled INTEGER NOT NULL DEFAULT 0 CHECK(default_enabled IN (0,1)),
  priority INTEGER NOT NULL DEFAULT 50,
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_enabled_priority ON sources(enabled, priority DESC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_template_url ON sources(template_url);

CREATE TABLE IF NOT EXISTS run_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','dispatching','queued','running','completed','failed','cancelled','dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  priority INTEGER NOT NULL DEFAULT 50,
  lease_until TEXT,
  queued_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  UNIQUE(run_id, source_id, url, task_type)
);
CREATE INDEX IF NOT EXISTS idx_tasks_run_status ON run_tasks(run_id, status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_lease ON run_tasks(status, lease_until);
CREATE INDEX IF NOT EXISTS idx_tasks_status_updated ON run_tasks(status, updated_at ASC);

CREATE TABLE IF NOT EXISTS source_metrics (
  source_id TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK(successes >= 0),
  failures INTEGER NOT NULL DEFAULT 0 CHECK(failures >= 0),
  timeouts INTEGER NOT NULL DEFAULT 0 CHECK(timeouts >= 0),
  blocks INTEGER NOT NULL DEFAULT 0 CHECK(blocks >= 0),
  links_found INTEGER NOT NULL DEFAULT 0 CHECK(links_found >= 0),
  valid_links INTEGER NOT NULL DEFAULT 0 CHECK(valid_links >= 0),
  yield_rate REAL NOT NULL DEFAULT 0 CHECK(yield_rate >= 0),
  average_latency REAL NOT NULL DEFAULT 0 CHECK(average_latency >= 0),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures >= 0),
  last_success_at TEXT,
  last_failure_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  status_code INTEGER,
  content_type TEXT,
  crawl_depth INTEGER NOT NULL DEFAULT 0 CHECK(crawl_depth >= 0),
  fetched_at TEXT NOT NULL,
  error_message TEXT,
  UNIQUE(run_id, normalized_url)
);
CREATE INDEX IF NOT EXISTS idx_pages_run ON pages(run_id, fetched_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pages_source ON pages(source_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK(link_type IN ('folder','legacy_folder')),
  has_key INTEGER NOT NULL CHECK(has_key IN (0,1)),
  validation_status TEXT NOT NULL CHECK(validation_status IN ('structurally_valid','valid','invalid','unchecked','unknown','dead','pending')),
  is_complete INTEGER NOT NULL CHECK(is_complete IN (0,1)),
  discovered_at TEXT NOT NULL,
  checked_at TEXT,
  UNIQUE(run_id, normalized_url)
);
CREATE INDEX IF NOT EXISTS idx_links_run ON links(run_id, discovered_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_links_normalized ON links(normalized_url);
CREATE INDEX IF NOT EXISTS idx_links_validation ON links(validation_status, checked_at ASC);

CREATE TABLE IF NOT EXISTS visited_urls (
  normalized_url TEXT PRIMARY KEY,
  first_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  last_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK(visit_count >= 1)
);
CREATE INDEX IF NOT EXISTS idx_visited_last_seen ON visited_urls(last_seen_at DESC, normalized_url ASC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES run_tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('debug','info','warning','error')),
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_recent ON events(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dead_tasks (
  id TEXT PRIMARY KEY,
  original_task_id TEXT NOT NULL UNIQUE,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0),
  final_error TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dead_tasks_run ON dead_tasks(run_id, created_at DESC, id DESC);
