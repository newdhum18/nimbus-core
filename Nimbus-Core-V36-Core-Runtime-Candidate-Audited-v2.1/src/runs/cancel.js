import { nowIso } from "../db/queries.js";
import { syncRunProgress } from "./progress.js";

export async function cancelRun(db, runId) {
  const now = nowIso();
  await db.prepare(`
    UPDATE run_tasks
    SET status='cancelled',completed_at=?,lease_until=NULL,updated_at=?
    WHERE run_id=? AND status NOT IN ('completed','dead','cancelled')
  `).bind(now, now, runId).run();

  const result = await db.prepare(`
    UPDATE runs
    SET status='cancelled',completed_at=?,updated_at=?
    WHERE id=? AND status NOT IN ('completed','cancelled')
  `).bind(now, now, runId).run();

  if (result.meta?.changes === 1) await syncRunProgress(db, runId);
  return result.meta?.changes === 1;
}
