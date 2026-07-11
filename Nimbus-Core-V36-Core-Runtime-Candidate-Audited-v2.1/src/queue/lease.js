import { nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";

export function leaseUntil(seconds = SYSTEM.taskLeaseSeconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function acquireLease(db, taskId, seconds = SYSTEM.taskLeaseSeconds) {
  const now = nowIso();
  const result = await db.prepare(`
    UPDATE run_tasks
    SET status='running',
        attempts=attempts+1,
        started_at=COALESCE(started_at,?),
        lease_until=?,
        updated_at=?
    WHERE id=? AND status IN ('dispatching','queued','pending','failed')
  `).bind(now, leaseUntil(seconds), now, taskId).run();
  return result.meta?.changes === 1;
}
