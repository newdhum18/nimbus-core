-- V36.19 Step 3: make PasteToday a first-class source type and persist extraction recovery evidence.
PRAGMA foreign_keys=OFF;

CREATE TABLE sources_v19 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('html','rss','json','custom','pastetoday')),
  template_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  default_enabled INTEGER NOT NULL DEFAULT 0 CHECK(default_enabled IN (0,1)),
  priority INTEGER NOT NULL DEFAULT 50,
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO sources_v19 SELECT id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at FROM sources;
DROP TABLE sources;
ALTER TABLE sources_v19 RENAME TO sources;
CREATE INDEX idx_sources_enabled_priority ON sources(enabled,priority DESC,id ASC);
CREATE UNIQUE INDEX idx_sources_template_url ON sources(template_url);

CREATE TABLE IF NOT EXISTS extraction_recovery (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES run_tasks(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  host TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','ignored')),
  http_status INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  dynamic INTEGER NOT NULL DEFAULT 0 CHECK(dynamic IN (0,1)),
  encoded_target INTEGER NOT NULL DEFAULT 0 CHECK(encoded_target IN (0,1)),
  embed_detected INTEGER NOT NULL DEFAULT 0 CHECK(embed_detected IN (0,1)),
  markers_json TEXT,
  evidence_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(run_id,normalized_url,reason)
);
CREATE INDEX IF NOT EXISTS idx_extraction_recovery_status ON extraction_recovery(status,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_recovery_source ON extraction_recovery(source_id,last_seen_at DESC);

PRAGMA foreign_keys=ON;
