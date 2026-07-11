import { nowIso } from "../db/queries.js";

export async function recoverTasks(db, runId = null, queuedStaleSeconds = 300) {
  const now = nowIso();
  const queuedBefore = new Date(Date.now() - queuedStaleSeconds * 1000).toISOString();
  const scope = runId ? " AND run_id=?" : "";

  const dispatchingParams = runId ? [now, runId] : [now];
  const dispatching = await db.prepare(`
    UPDATE run_tasks
    SET status='pending',lease_until=NULL,last_error='recovered_dispatching',updated_at=?
    WHERE status='dispatching'${scope}
  `).bind(...dispatchingParams).run();

  const leaseParams = runId ? [now, now, runId] : [now, now];
  const leases = await db.prepare(`
    UPDATE run_tasks
    SET status='pending',lease_until=NULL,last_error='recovered_expired_lease',updated_at=?
    WHERE status='running' AND lease_until IS NOT NULL AND lease_until<?${scope}
  `).bind(...leaseParams).run();

  const queuedParams = runId ? [now, queuedBefore, runId] : [now, queuedBefore];
  const queued = await db.prepare(`
    UPDATE run_tasks
    SET status='pending',last_error='recovered_stale_queue',updated_at=?
    WHERE status='queued' AND queued_at IS NOT NULL AND queued_at<?${scope}
  `).bind(...queuedParams).run();

  return {
    dispatchingRecovered: dispatching.meta?.changes || 0,
    leasesRecovered: leases.meta?.changes || 0,
    queuedRecovered: queued.meta?.changes || 0
  };
}
