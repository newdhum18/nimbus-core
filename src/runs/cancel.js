import { nowIso } from "../db/queries.js";
import { getRun } from "../db/repositories/runs.js";
import { AppError } from "../api/errors.js";
import { transitionRun } from "./lifecycle.js";
import { isTerminalRunState } from "./state-machine.js";

export async function cancelRun(db, runId) {
  const run = await getRun(db, runId);
  if (!run) throw new AppError("RUN_NOT_FOUND", "Run was not found", "runs", 404, { run_id: runId });
  if (isTerminalRunState(run.status)) throw new AppError("RUN_STATE_CONFLICT", `Cannot cancel ${run.status} run`, "runs", 409, { run_id: runId, status: run.status });
  const now = nowIso();
  await db.prepare(`UPDATE run_tasks SET status='cancelled',completed_at=?,lease_until=NULL,updated_at=? WHERE run_id=? AND status NOT IN ('completed','dead','cancelled')`).bind(now, now, runId).run();
  return transitionRun(db, runId, "cancelled", { from: run.status });
}
