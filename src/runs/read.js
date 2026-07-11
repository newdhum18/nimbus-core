import { AppError } from "../api/errors.js";

export async function getRun(db, runId) {
  const run = await db.prepare("SELECT * FROM runs WHERE id=?").bind(runId).first();
  if (!run) throw new AppError("RUN_NOT_FOUND", "Run was not found", "runs", 404, { run_id: runId });

  const taskCounts = await db.prepare(`
    SELECT status,COUNT(*) count
    FROM run_tasks
    WHERE run_id=?
    GROUP BY status
  `).bind(runId).all();

  return {
    run,
    task_counts: Object.fromEntries((taskCounts.results || []).map((row) => [row.status, row.count]))
  };
}

export async function listRuns(db, limit = 50) {
  const rows = await db.prepare(`
    SELECT * FROM runs
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return rows.results || [];
}
