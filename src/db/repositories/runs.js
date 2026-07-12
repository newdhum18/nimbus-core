import { first, all, run, nowIso, uid } from "../queries.js";
import { requireDb, pageLimit } from "./base.js";

export async function createRun(db, { mode, keyword = "", status = "created", id = uid("run") }) {
  requireDb(db);
  const now = nowIso();
  await run(db, `
    INSERT INTO runs(id,mode,keyword,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?)
  `, [id, mode, keyword, status, now, now]);
  return getRun(db, id);
}

export async function getRun(db, id) {
  requireDb(db);
  return first(db, "SELECT * FROM runs WHERE id=?", [id]);
}

export async function getActiveRun(db) {
  requireDb(db);
  return first(db, `
    SELECT * FROM runs
    WHERE status IN ('running','paused','recovering')
    ORDER BY created_at ASC LIMIT 1
  `);
}

export async function updateRunStatus(db, id, status, fields = {}) {
  requireDb(db);
  const allowed = ["started_at", "paused_at", "completed_at", "error_message"];
  const assignments = ["status=?", "updated_at=?"];
  const params = [status, nowIso()];
  for (const key of allowed) {
    if (Object.hasOwn(fields, key)) {
      assignments.push(`${key}=?`);
      params.push(fields[key]);
    }
  }
  params.push(id);
  await run(db, `UPDATE runs SET ${assignments.join(",")} WHERE id=?`, params);
  return getRun(db, id);
}

export async function updateRunCounters(db, id, counters) {
  requireDb(db);
  const allowed = ["total_tasks", "completed_tasks", "failed_tasks", "links_found", "progress"];
  const assignments = [];
  const params = [];
  for (const key of allowed) {
    if (Object.hasOwn(counters, key)) {
      assignments.push(`${key}=?`);
      params.push(counters[key]);
    }
  }
  if (!assignments.length) return getRun(db, id);
  assignments.push("updated_at=?");
  params.push(nowIso(), id);
  await run(db, `UPDATE runs SET ${assignments.join(",")} WHERE id=?`, params);
  return getRun(db, id);
}

export async function listRuns(db, { limit = 50, offset = 0, status } = {}) {
  requireDb(db);
  limit = pageLimit(limit);
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  if (status) {
    return (await all(db, "SELECT * FROM runs WHERE status=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", [status, limit, offset])).results || [];
  }
  return (await all(db, "SELECT * FROM runs ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", [limit, offset])).results || [];
}
