-- Nimbus Core V27 Ultimate isolated schema
CREATE TABLE IF NOT EXISTS nimbus_v27_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mega_url TEXT NOT NULL UNIQUE,
  normalized_url TEXT,
  link_type TEXT,
  public_id TEXT,
  source_url TEXT,
  source_domain TEXT,
  title TEXT,
  source_type TEXT,
  confidence INTEGER,
  confidence_reason TEXT,
  health_status TEXT DEFAULT 'unchecked',
  health_reason TEXT,
  health_checked_at TEXT,
  discovered_at TEXT,
  last_seen_at TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS nimbus_v27_sources (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL UNIQUE,domain TEXT,reason TEXT,title TEXT,depth INTEGER DEFAULT 0,discovered_at TEXT,last_seen_at TEXT,status TEXT DEFAULT 'open');
CREATE TABLE IF NOT EXISTS nimbus_v27_queue (id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL UNIQUE,domain TEXT,priority INTEGER DEFAULT 50,depth INTEGER DEFAULT 0,status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,last_error TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE IF NOT EXISTS nimbus_v27_cache (cache_key TEXT PRIMARY KEY,cache_type TEXT,value TEXT,expires_at INTEGER,updated_at TEXT);
CREATE TABLE IF NOT EXISTS nimbus_v27_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,mode TEXT,started_at TEXT,finished_at TEXT,engines TEXT,queries_checked INTEGER,pages_found INTEGER,pages_fetched INTEGER,queue_added INTEGER,links_found INTEGER,new_links INTEGER,manual_sources INTEGER,health_checked INTEGER,errors TEXT);
CREATE TABLE IF NOT EXISTS nimbus_v27_state (name TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
CREATE INDEX IF NOT EXISTS idx_v27_links_domain ON nimbus_v27_links(source_domain);
CREATE INDEX IF NOT EXISTS idx_v27_links_time ON nimbus_v27_links(discovered_at);
CREATE INDEX IF NOT EXISTS idx_v27_links_health ON nimbus_v27_links(health_status);
CREATE INDEX IF NOT EXISTS idx_v27_queue_status ON nimbus_v27_queue(status, priority DESC, id ASC);
