CREATE TABLE IF NOT EXISTS source_tombstones (
  source_id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'user_deleted'
);
CREATE INDEX IF NOT EXISTS idx_source_tombstones_deleted_at ON source_tombstones(deleted_at DESC);
