import { nowIso } from "../db/queries.js";

export async function pauseRun(db, runId) {
  const now = nowIso();
  const result = await db.prepare(`
    UPDATE runs
    SET status='paused',paused_at=?,updated_at=?
    WHERE id=? AND status='running'
  `).bind(now, now, runId).run();
  return result.meta?.changes === 1;
}
