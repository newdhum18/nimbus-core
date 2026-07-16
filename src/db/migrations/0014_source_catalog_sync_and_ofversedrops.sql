-- V36.19.2: synchronize required public sources and add the OfverseDrops adapter type.
PRAGMA foreign_keys=OFF;

CREATE TABLE sources_v192 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('html','rss','json','custom','pastetoday','ofversedrops')),
  template_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  default_enabled INTEGER NOT NULL DEFAULT 0 CHECK(default_enabled IN (0,1)),
  priority INTEGER NOT NULL DEFAULT 50,
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO sources_v192
SELECT id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at
FROM sources;
DROP TABLE sources;
ALTER TABLE sources_v192 RENAME TO sources;
CREATE INDEX idx_sources_enabled_priority ON sources(enabled,priority DESC,id ASC);
CREATE UNIQUE INDEX idx_sources_template_url ON sources(template_url);

INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at)
VALUES
('pastetoday_direct','PasteToday direct validation','paste','pastetoday','https://pastetoday.com/wic5vif7en',1,1,1475,88,datetime('now'),datetime('now')),
('pastetoday_search','PasteToday public discovery','paste','pastetoday','https://lite.duckduckgo.com/lite/?q=site%3Apastetoday.com%20{q}%20%22mega.nz%2Ffolder%22',1,1,1465,82,datetime('now'),datetime('now')),
('ofversedrops_search','OfverseDrops public search','mega-index','ofversedrops','https://ofversedrops.com/?s={q}',1,1,1480,85,datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  category=excluded.category,
  source_type=excluded.source_type,
  template_url=excluded.template_url,
  default_enabled=excluded.default_enabled,
  priority=excluded.priority,
  rank_score=excluded.rank_score,
  updated_at=excluded.updated_at;

PRAGMA foreign_keys=ON;
