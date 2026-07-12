import { all, run, nowIso, uid } from "../queries.js";
import { requireDb, pageLimit } from "./base.js";

export async function appendEvent(db, event) {
  requireDb(db);
  const id = event.id || uid("event");
  await run(db, `INSERT INTO events(id,run_id,task_id,event_type,level,message,details_json,created_at) VALUES(?,?,?,?,?,?,?,?)`, [id,event.run_id ?? null,event.task_id ?? null,event.event_type,event.level ?? "info",event.message,event.details_json ? JSON.stringify(event.details_json) : null,event.created_at ?? nowIso()]);
  return id;
}

export async function listEvents(db, { runId, taskId, limit = 50, offset = 0 } = {}) {
  requireDb(db);
  limit = pageLimit(limit);
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  const clauses=[]; const params=[];
  if (runId) { clauses.push("run_id=?"); params.push(runId); }
  if (taskId) { clauses.push("task_id=?"); params.push(taskId); }
  const where=clauses.length?`WHERE ${clauses.join(" AND ")}`:"";
  params.push(limit,offset);
  return (await all(db,`SELECT * FROM events ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,params)).results || [];
}
