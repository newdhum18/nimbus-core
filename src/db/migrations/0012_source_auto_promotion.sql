-- Phase 16.4: make autonomous sources executable and backfill safe promotion state.
UPDATE sources SET source_type='html' WHERE source_type='custom' AND id LIKE 'discovered_%';
CREATE INDEX IF NOT EXISTS idx_candidate_domains_promotion ON source_candidate_domains(state,successful_fetches,pages_tested,confidence,blocked_fetches,last_seen_at DESC);
