import { nowIso } from "../db/queries.js";
import { dispatchPending } from "../queue/producer.js";
import { transitionRun } from "./lifecycle.js";
import { getRun } from "../db/repositories/runs.js";
import { AppError } from "../api/errors.js";

export async function resumeRun(env, runId) {
  const current = await getRun(env.DB, runId);
  if (!current) throw new AppError("RUN_NOT_FOUND", "Run was not found", "runs", 404, { run_id: runId });
  if (!["paused", "recovering"].includes(current.status)) throw new AppError("RUN_STATE_CONFLICT", `Cannot resume ${current.status} run`, "runs", 409, { run_id: runId, status: current.status });
  const now = nowIso();
  await env.DB.prepare(`UPDATE run_tasks SET status='pending',lease_until=NULL,last_error='expired_lease_recovered',updated_at=? WHERE run_id=? AND status='running' AND lease_until IS NOT NULL AND lease_until<?`).bind(now, runId, now).run();
  await env.DB.prepare(`UPDATE run_tasks SET status='pending',last_error='dispatch_recovered',updated_at=? WHERE run_id=? AND status='dispatching'`).bind(now, runId).run();
  const run = await transitionRun(env.DB, runId, "running", { from: current.status });
  const dispatch = await dispatchPending(env, runId, 20);
  return { resumed: true, run, dispatch };
}
