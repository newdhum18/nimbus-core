-- Phase 13: autonomous source intelligence and novelty metrics.
ALTER TABLE source_metrics ADD COLUMN novel_links INTEGER NOT NULL DEFAULT 0 CHECK(novel_links >= 0);
ALTER TABLE source_metrics ADD COLUMN duplicate_links INTEGER NOT NULL DEFAULT 0 CHECK(duplicate_links >= 0);
ALTER TABLE source_metrics ADD COLUMN zero_yield_runs INTEGER NOT NULL DEFAULT 0 CHECK(zero_yield_runs >= 0);
ALTER TABLE source_metrics ADD COLUMN last_novel_at TEXT;
ALTER TABLE source_metrics ADD COLUMN cooldown_until TEXT;
ALTER TABLE source_metrics ADD COLUMN intelligence_state TEXT NOT NULL DEFAULT 'explore';
CREATE INDEX IF NOT EXISTS idx_source_metrics_intelligence ON source_metrics(intelligence_state,novel_links DESC,updated_at DESC);
