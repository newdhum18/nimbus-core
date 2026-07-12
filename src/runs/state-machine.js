import { AppError } from "../api/errors.js";

export const RUN_STATES = Object.freeze([
  "created", "running", "paused", "recovering", "completed", "failed", "cancelled"
]);

export const TERMINAL_RUN_STATES = Object.freeze(["completed", "failed", "cancelled"]);

const TRANSITIONS = Object.freeze({
  created: new Set(["running", "failed", "cancelled"]),
  running: new Set(["paused", "recovering", "completed", "failed", "cancelled"]),
  paused: new Set(["running", "recovering", "cancelled"]),
  recovering: new Set(["running", "failed", "cancelled"]),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set()
});

export function isRunState(value) {
  return RUN_STATES.includes(value);
}

export function isTerminalRunState(value) {
  return TERMINAL_RUN_STATES.includes(value);
}

export function canTransitionRun(from, to) {
  return isRunState(from) && isRunState(to) && TRANSITIONS[from].has(to);
}

export function assertRunTransition(from, to, runId = null) {
  if (!isRunState(from) || !isRunState(to)) {
    throw new AppError("INVALID_RUN_STATE", `Invalid run state transition ${from} -> ${to}`, "runs", 500, { run_id: runId, from, to });
  }
  if (!canTransitionRun(from, to)) {
    throw new AppError("RUN_STATE_CONFLICT", `Cannot transition run from ${from} to ${to}`, "runs", 409, { run_id: runId, from, to });
  }
  return true;
}

export function transitionTimestamps(to, now) {
  if (to === "running") return { started_at: now, paused_at: null, completed_at: null };
  if (to === "paused") return { paused_at: now };
  if (TERMINAL_RUN_STATES.includes(to)) return { completed_at: now, paused_at: null };
  return {};
}
