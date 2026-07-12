import { uid, nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";
import { syncRunProgress } from "../runs/progress.js";

function deadPayload(task) {
  return JSON.stringify({
    schema: "nimbus.dead-task.v1",
    task_id: task.id,
    run_id: task.run_id,
    source_id: task.source_id ?? null,
    task_type: task.task_type,
    url: task.url
  });
}

export async function failOrDead(db, task, error, maxAttempts = SYSTEM.maxTaskAttempts) {
  const message = error instanceof Error ? error.message : String(error);
  const now = nowIso();
  const attempts = Number(task.attempts || 0);

  if (attempts >= maxAttempts) {
    await db.prepare(`
      UPDATE run_tasks
      SET status='dead',completed_at=?,lease_until=NULL,last_error=?,updated_at=?
      WHERE id=? AND status='running'
    `).bind(now, message, now, task.id).run();

    await db.prepare(`
      INSERT INTO dead_tasks(id,original_task_id,run_id,payload_json,attempts,final_error,created_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(original_task_id) DO UPDATE SET
        payload_json=excluded.payload_json,attempts=excluded.attempts,
        final_error=excluded.final_error,created_at=excluded.created_at
    `).bind(uid("dead"), task.id, task.run_id, deadPayload(task), attempts, message, now).run();

    await syncRunProgress(db, task.run_id);
    return "dead";
  }

  await db.prepare(`
    UPDATE run_tasks
    SET status='failed',lease_until=NULL,last_error=?,updated_at=?
    WHERE id=? AND status='running'
  `).bind(message, now, task.id).run();
  return "retry";
}
