import { releaseExpiredLeases } from "./lease.js";
import { dispatchPending } from "./producer.js";
import { SYSTEM } from "../config.js";

export async function recoverQueueRuntime(env, runId) {
  const run = await env.DB.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  if (!run) return { recovered: 0, queued: 0, skipped: "missing_run" };
  if (run.status !== "running") return { recovered: 0, queued: 0, skipped: "run_not_running" };
  const recovered = await releaseExpiredLeases(env.DB, runId);
  const dispatched = await dispatchPending(env, runId, SYSTEM.queueDispatchBatch);
  return { recovered, queued: dispatched.queued || 0 };
}
