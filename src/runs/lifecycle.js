import { AppError } from "../api/errors.js";
import { nowIso } from "../db/queries.js";
import { appendEvent } from "../db/repositories/events.js";
import { getRun } from "../db/repositories/runs.js";
import { assertRunTransition, transitionTimestamps } from "./state-machine.js";

const ALLOWED_FIELDS = new Set(["started_at", "paused_at", "completed_at", "error_message"]);

export async function transitionRun(db, runId, to, { from = null, errorMessage = undefined, eventDetails = null } = {}) {
  const current = await getRun(db, runId);
  if (!current) throw new AppError("RUN_NOT_FOUND", "Run was not found", "runs", 404, { run_id: runId });
  const expected = from || current.status;
  if (current.status !== expected) {
    throw new AppError("RUN_STATE_CONFLICT", `Expected ${expected} but run is ${current.status}`, "runs", 409, { run_id: runId, from: current.status, to });
  }
  assertRunTransition(current.status, to, runId);

  const now = nowIso();
  const fields = { ...transitionTimestamps(to, now) };
  if (errorMessage !== undefined) fields.error_message = errorMessage;
  if (to === "running" && current.started_at) delete fields.started_at;

  const assignments = ["status=?", "updated_at=?"];
  const params = [to, now];
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    assignments.push(`${key}=?`);
    params.push(value);
  }
  params.push(runId, current.status);
  const result = await db.prepare(`UPDATE runs SET ${assignments.join(",")} WHERE id=? AND status=?`).bind(...params).run();
  if (result.meta?.changes !== 1) {
    throw new AppError("RUN_STATE_CONFLICT", "Run changed while the transition was being applied", "runs", 409, { run_id: runId, from: current.status, to });
  }

  await appendEvent(db, {
    run_id: runId,
    event_type: "run_state_changed",
    level: to === "failed" ? "error" : "info",
    message: `Run transitioned from ${current.status} to ${to}`,
    details_json: { from: current.status, to, ...(eventDetails || {}) }
  });
  return getRun(db, runId);
}

export async function failRun(db, runId, error) {
  const message = error instanceof Error ? error.message : String(error);
  return transitionRun(db, runId, "failed", { errorMessage: message });
}

export async function completeRun(db, runId) {
  return transitionRun(db, runId, "completed");
}

export async function beginRecovery(db, runId) {
  const run = await getRun(db, runId);
  if (!run) throw new AppError("RUN_NOT_FOUND", "Run was not found", "runs", 404, { run_id: runId });
  if (run.status === "recovering") return run;
  return transitionRun(db, runId, "recovering");
}
