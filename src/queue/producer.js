import { uid, nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";
import { makeTaskMessage } from "./contract.js";

export async function dispatchPending(env, runId, limit = SYSTEM.queueDispatchBatch) {
  const run = await env.DB.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  if (!run || run.status !== "running") return { queued: 0, skipped: "run_not_running" };

  const boundedLimit = Math.min(Math.max(Number(limit) || 1, 1), SYSTEM.sqlBatchMax);
  const rows = await env.DB.prepare(`
    SELECT id,attempts
    FROM run_tasks
    WHERE run_id=? AND status='pending'
    ORDER BY priority DESC,created_at ASC,id ASC
    LIMIT ?
  `).bind(runId, boundedLimit).all();

  const tasks = rows.results || [];
  if (!tasks.length) return { queued: 0 };

  const now = nowIso();
  const marked = await env.DB.batch(tasks.map((task) => env.DB.prepare(`
    UPDATE run_tasks SET status='dispatching',updated_at=?
    WHERE id=? AND run_id=? AND status='pending'
  `).bind(now, task.id, runId)));
  const selected = tasks.filter((_, index) => marked[index]?.meta?.changes === 1);
  if (!selected.length) return { queued: 0 };

  const messages = selected.map((task) => makeTaskMessage({
    messageId: uid("msg"), runId, taskId: task.id, attempt: Number(task.attempts || 0), enqueuedAt: now
  }));

  try {
    await env.QUEUE.sendBatch(messages.map((body) => ({ body })));
    const queuedAt = nowIso();
    await env.DB.batch(selected.map((task) => env.DB.prepare(`
      UPDATE run_tasks SET status='queued',queued_at=?,updated_at=?
      WHERE id=? AND run_id=? AND status='dispatching'
    `).bind(queuedAt, queuedAt, task.id, runId)));
    return { queued: selected.length, message_schema: messages[0]?.schema || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.batch(selected.map((task) => env.DB.prepare(`
      UPDATE run_tasks SET status='pending',last_error=?,updated_at=?
      WHERE id=? AND run_id=? AND status='dispatching'
    `).bind(message, nowIso(), task.id, runId)));
    throw error;
  }
}
