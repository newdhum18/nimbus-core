import { nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";

export async function dispatchPending(env, runId, limit = SYSTEM.queueDispatchBatch) {
  const run = await env.DB.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  if (!run || run.status !== "running") return { queued: 0, skipped: "run_not_running" };

  const rows = await env.DB.prepare(`
    SELECT id
    FROM run_tasks
    WHERE run_id=? AND status='pending'
    ORDER BY priority DESC,created_at ASC
    LIMIT ?
  `).bind(runId, Math.min(limit, 100)).all();

  const tasks = rows.results || [];
  if (!tasks.length) return { queued: 0 };

  const now = nowIso();
  const markStatements = tasks.map((task) =>
    env.DB.prepare(`
      UPDATE run_tasks
      SET status='dispatching',updated_at=?
      WHERE id=? AND status='pending'
    `).bind(now, task.id)
  );
  const marked = await env.DB.batch(markStatements);
  const selected = tasks.filter((_, index) => marked[index]?.meta?.changes === 1);
  if (!selected.length) return { queued: 0 };

  try {
    await env.QUEUE.sendBatch(selected.map((task) => ({
      body: { type: "run_task", runId, taskId: task.id, queuedAt: now }
    })));

    const queuedAt = nowIso();
    await env.DB.batch(selected.map((task) =>
      env.DB.prepare(`
        UPDATE run_tasks
        SET status='queued',queued_at=?,updated_at=?
        WHERE id=? AND status='dispatching'
      `).bind(queuedAt, queuedAt, task.id)
    ));

    return { queued: selected.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.batch(selected.map((task) =>
      env.DB.prepare(`
        UPDATE run_tasks
        SET status='pending',last_error=?,updated_at=?
        WHERE id=? AND status='dispatching'
      `).bind(message, nowIso(), task.id)
    ));
    throw error;
  }
}
