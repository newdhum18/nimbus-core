import { first, all, run, nowIso, uid } from "../queries.js";
import { requireDb, pageLimit } from "./base.js";

export async function createTask(db, input) {
  requireDb(db);
  const now = nowIso();
  const id = input.id || uid("task");
  await run(db, `
    INSERT INTO run_tasks(id,run_id,source_id,url,task_type,status,attempts,priority,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(run_id,source_id,url,task_type) DO NOTHING
  `, [id, input.run_id, input.source_id ?? null, input.url, input.task_type, input.status ?? "pending", input.attempts ?? 0, input.priority ?? 50, now, now]);
  return first(db, "SELECT * FROM run_tasks WHERE run_id=? AND source_id IS ? AND url=? AND task_type=?", [input.run_id, input.source_id ?? null, input.url, input.task_type]);
}

export async function getTask(db, id) {
  requireDb(db);
  return first(db, "SELECT * FROM run_tasks WHERE id=?", [id]);
}

export async function listTasks(db, { runId, status, limit = 50, offset = 0 } = {}) {
  requireDb(db);
  limit = pageLimit(limit);
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  const clauses = [];
  const params = [];
  if (runId) { clauses.push("run_id=?"); params.push(runId); }
  if (status) { clauses.push("status=?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit, offset);
  return (await all(db, `SELECT * FROM run_tasks ${where} ORDER BY priority DESC,created_at ASC,id ASC LIMIT ? OFFSET ?`, params)).results || [];
}

export async function setTaskState(db, id, status, fields = {}) {
  requireDb(db);
  const allowed = ["attempts","lease_until","queued_at","started_at","completed_at","last_error"];
  const assignments = ["status=?", "updated_at=?"];
  const params = [status, nowIso()];
  for (const key of allowed) {
    if (Object.hasOwn(fields, key)) { assignments.push(`${key}=?`); params.push(fields[key]); }
  }
  params.push(id);
  await run(db, `UPDATE run_tasks SET ${assignments.join(",")} WHERE id=?`, params);
  return getTask(db, id);
}
