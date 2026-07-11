import { nowIso } from "../db/queries.js";

export async function syncRunProgress(db, runId) {
  const counts = await db.prepare(`
    SELECT
      COUNT(*) total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
      SUM(CASE WHEN status='dead' THEN 1 ELSE 0 END) failed,
      SUM(CASE WHEN status IN ('completed','dead','cancelled') THEN 1 ELSE 0 END) terminal
    FROM run_tasks
    WHERE run_id=?
  `).bind(runId).first();

  const total = Number(counts?.total || 0);
  const completed = Number(counts?.completed || 0);
  const failed = Number(counts?.failed || 0);
  const terminal = Number(counts?.terminal || 0);
  const progress = total === 0 ? 0 : Math.min(100, (terminal * 100) / total);
  const linkRow = await db.prepare("SELECT COUNT(*) total FROM links WHERE run_id=?").bind(runId).first();
  const linksFound = Number(linkRow?.total || 0);
  const run = await db.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  const shouldComplete = run?.status === "running" && total > 0 && terminal === total;
  const status = shouldComplete ? "completed" : run?.status;
  const completedAt = shouldComplete ? nowIso() : null;

  await db.prepare(`
    UPDATE runs
    SET total_tasks=?,
        completed_tasks=?,
        failed_tasks=?,
        progress=?,
        links_found=?,
        status=?,
        completed_at=COALESCE(?,completed_at),
        updated_at=?
    WHERE id=?
  `).bind(total, completed, failed, progress, linksFound, status, completedAt, nowIso(), runId).run();

  return { total, completed, failed, terminal, progress, linksFound, status };
}
