import { nowIso } from "../db/queries.js";
import { beginRecovery } from "./lifecycle.js";
import { getRun } from "../db/repositories/runs.js";

export async function recoverTasks(db, runId = null, queuedStaleSeconds = 300) {
  if (runId) {
    const run = await getRun(db, runId);
    if (run && ["running", "paused"].includes(run.status)) await beginRecovery(db, runId);
  }
  const now = nowIso();
  const queuedBefore = new Date(Date.now() - queuedStaleSeconds * 1000).toISOString();
  const scope = runId ? " AND run_id=?" : "";
  const dispatching = await db.prepare(`UPDATE run_tasks SET status='pending',lease_until=NULL,last_error='recovered_dispatching',updated_at=? WHERE status='dispatching'${scope}`).bind(...(runId ? [now, runId] : [now])).run();
  const leases = await db.prepare(`UPDATE run_tasks SET status='pending',lease_until=NULL,last_error='recovered_expired_lease',updated_at=? WHERE status='running' AND lease_until IS NOT NULL AND lease_until<?${scope}`).bind(...(runId ? [now, now, runId] : [now, now])).run();
  const queued = await db.prepare(`UPDATE run_tasks SET status='pending',last_error='recovered_stale_queue',updated_at=? WHERE status='queued' AND queued_at IS NOT NULL AND queued_at<?${scope}`).bind(...(runId ? [now, queuedBefore, runId] : [now, queuedBefore])).run();
  return { dispatchingRecovered: dispatching.meta?.changes || 0, leasesRecovered: leases.meta?.changes || 0, queuedRecovered: queued.meta?.changes || 0 };
}
