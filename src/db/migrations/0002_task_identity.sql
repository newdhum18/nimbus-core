-- Phase 06.1: close nullable source task uniqueness gap.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_identity
ON run_tasks(run_id, COALESCE(source_id, ''), url, task_type);
