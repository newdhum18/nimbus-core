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
    WHERE id=?
      AND (
        status IN ('dispatching','queued','pending','failed')
        OR (status='running' AND lease_until IS NOT NULL AND lease_until<=?)
      )
  `).bind(now, leaseUntil(seconds), now, taskId, now).run();
  return result.meta?.changes === 1;
}

export async function releaseExpiredLeases(db, runId = null) {
  const now = nowIso();
  const whereRun = runId ? " AND run_id=?" : "";
  const statement = db.prepare(`
    UPDATE run_tasks
    SET status='pending', lease_until=NULL, last_error='expired_lease_recovered', updated_at=?
    WHERE status='running' AND lease_until IS NOT NULL AND lease_until<=?${whereRun}
  `);
  const result = runId ? await statement.bind(now, now, runId).run() : await statement.bind(now, now).run();
  return Number(result.meta?.changes || 0);
}
