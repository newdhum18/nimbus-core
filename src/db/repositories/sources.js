import { first, all, run, nowIso } from "../queries.js";
import { requireDb, pageLimit } from "./base.js";

export async function upsertSource(db, source, { preserveEnabled = true } = {}) {
  requireDb(db);
  const now = nowIso();
  const enabledUpdate = preserveEnabled ? "enabled=sources.enabled" : "enabled=excluded.enabled";
  await run(db, `
    INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,category=excluded.category,source_type=excluded.source_type,
      template_url=excluded.template_url,${enabledUpdate},default_enabled=excluded.default_enabled,
      priority=excluded.priority,rank_score=excluded.rank_score,updated_at=excluded.updated_at
  `, [source.id, source.name, source.category, source.source_type, source.template_url, source.enabled ? 1 : 0, source.default_enabled ? 1 : 0, source.priority ?? 50, source.rank_score ?? 0, now, now]);
  return first(db, "SELECT * FROM sources WHERE id=?", [source.id]);
}

export async function getSource(db, id) {
  requireDb(db);
  return first(db, "SELECT * FROM sources WHERE id=?", [id]);
}

export async function listSources(db, { enabled, limit = 100, offset = 0 } = {}) {
  requireDb(db);
  limit = pageLimit(limit, { defaultValue: 100, maximum: 300 });
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  if (enabled === true || enabled === false) {
    return (await all(db, "SELECT * FROM sources WHERE enabled=? ORDER BY priority DESC,id ASC LIMIT ? OFFSET ?", [enabled ? 1 : 0, limit, offset])).results || [];
  }
  return (await all(db, "SELECT * FROM sources ORDER BY priority DESC,id ASC LIMIT ? OFFSET ?", [limit, offset])).results || [];
}

export async function setSourceEnabled(db, id, enabled) {
  requireDb(db);
  await run(db, "UPDATE sources SET enabled=?,updated_at=? WHERE id=?", [enabled ? 1 : 0, nowIso(), id]);
  return getSource(db, id);
}
