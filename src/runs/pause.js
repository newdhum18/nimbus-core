import { transitionRun } from "./lifecycle.js";
export async function pauseRun(db, runId) {
  return transitionRun(db, runId, "paused", { from: "running" });
}
