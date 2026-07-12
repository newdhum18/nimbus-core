import { nowIso } from "../db/queries.js";
import { completeRun } from "./lifecycle.js";

export async function syncRunProgress(db, runId) {
  const counts = await db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,SUM(CASE WHEN status IN ('dead','failed') THEN 1 ELSE 0 END) failed,SUM(CASE WHEN status IN ('completed','dead','cancelled') THEN 1 ELSE 0 END) terminal FROM run_tasks WHERE run_id=?`).bind(runId).first();
  const total = Number(counts?.total || 0), completed = Number(counts?.completed || 0), failed = Number(counts?.failed || 0), terminal = Number(counts?.terminal || 0);
  const progress = total === 0 ? 0 : Math.min(100, (terminal * 100) / total);
  const linksFound = Number((await db.prepare("SELECT COUNT(*) total FROM links WHERE run_id=?").bind(runId).first())?.total || 0);
  const run = await db.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  await db.prepare(`UPDATE runs SET total_tasks=?,completed_tasks=?,failed_tasks=?,progress=?,links_found=?,updated_at=? WHERE id=?`).bind(total, completed, failed, progress, linksFound, nowIso(), runId).run();
  let status = run?.status;
  if (status === "running" && total > 0 && terminal === total) status = (await completeRun(db, runId)).status;
  return { total, completed, failed, terminal, progress, linksFound, status };
}
