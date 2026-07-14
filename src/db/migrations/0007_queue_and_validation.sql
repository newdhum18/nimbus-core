CREATE TABLE IF NOT EXISTS queue_usage (
  day TEXT PRIMARY KEY,
  writes INTEGER NOT NULL DEFAULT 0,
  reads INTEGER NOT NULL DEFAULT 0,
  deletes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
ALTER TABLE links ADD COLUMN validation_error TEXT;
ALTER TABLE links ADD COLUMN validated_at TEXT;
ALTER TABLE links ADD COLUMN validation_http_status INTEGER;
CREATE INDEX IF NOT EXISTS idx_links_validation ON links(validation_status, validated_at);
