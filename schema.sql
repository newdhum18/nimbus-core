CREATE TABLE IF NOT EXISTS mega_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mega_url TEXT UNIQUE NOT NULL,
  canonical_url TEXT,
  source_url TEXT,
  source_host TEXT,
  title TEXT,
  link_type TEXT,
  confidence INTEGER DEFAULT 50,
  confidence_reason TEXT,
  first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  hit_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS manual_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT UNIQUE NOT NULL,
  source_host TEXT,
  title TEXT,
  reason TEXT,
  first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS scan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT,
  run_by TEXT,
  pages_collected INTEGER DEFAULT 0,
  pages_scanned INTEGER DEFAULT 0,
  mega_found INTEGER DEFAULT 0,
  new_links INTEGER DEFAULT 0,
  manual_sources INTEGER DEFAULT 0,
  engines TEXT,
  cursor_before INTEGER,
  cursor_after INTEGER,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scan_state (
  id TEXT PRIMARY KEY,
  cursor INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mega_last ON mega_links(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_last ON manual_sources(last_seen_at DESC);
