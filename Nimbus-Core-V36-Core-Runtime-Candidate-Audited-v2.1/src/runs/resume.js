import { nowIso } from "../db/queries.js";
import { dispatchPending } from "../queue/producer.js";

export async function resumeRun(env, runId) {
  const now = nowIso();

  await env.DB.prepare(`
    UPDATE run_tasks
    SET status='pending',lease_until=NULL,last_error='expired_lease_recovered',updated_at=?
    WHERE run_id=? AND status='running' AND lease_until IS NOT NULL AND lease_until<?
  `).bind(now, runId, now).run();

  await env.DB.prepare(`
    UPDATE run_tasks
    SET status='pending',last_error='dispatch_recovered',updated_at=?
    WHERE run_id=? AND status='dispatching'
  `).bind(now, runId).run();

  const result = await env.DB.prepare(`
    UPDATE runs
    SET status='running',paused_at=NULL,updated_at=?
    WHERE id=? AND status IN ('paused','recovering')
  `).bind(now, runId).run();

  if (result.meta?.changes !== 1) return false;
  const dispatch = await dispatchPending(env, runId, 20);
  return { resumed: true, dispatch };
}
