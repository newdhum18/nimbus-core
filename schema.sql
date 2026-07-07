-- Nimbus Core V23 D1 schema. Worker also self-heals old databases.
CREATE TABLE IF NOT EXISTS mega_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mega_url TEXT NOT NULL UNIQUE,
  normalized_url TEXT,
  source_url TEXT,
  source_domain TEXT,
  title TEXT,
  source_type TEXT,
  confidence INTEGER,
  confidence_reason TEXT,
  discovered_at TEXT,
  last_seen_at TEXT,
  status TEXT,
  notes TEXT,
  query TEXT,
  region TEXT
);
CREATE TABLE IF NOT EXISTS manual_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  domain TEXT,
  reason TEXT,
  title TEXT,
  discovered_at TEXT,
  last_seen_at TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS scan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT,
  started_at TEXT,
  finished_at TEXT,
  patterns_checked INTEGER,
  pages_found INTEGER,
  pages_fetched INTEGER,
  links_found INTEGER,
  new_links INTEGER,
  manual_sources INTEGER,
  errors TEXT
);
CREATE TABLE IF NOT EXISTS scan_state (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
