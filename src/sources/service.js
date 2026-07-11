import { AppError } from "../api/errors.js";
import { nowIso } from "../db/queries.js";
import { seedSources } from "./defaults.js";

async function assertNoActiveRun(db) {
  const active = await db.prepare(
    "SELECT id,status FROM runs WHERE status IN ('running','paused','recovering') LIMIT 1"
  ).first();
  if (active) {
    throw new AppError(
      "SOURCE_CHANGE_BLOCKED",
      "Source configuration cannot be changed during an active or paused run",
      "sources",
      409,
      { run_id: active.id, status: active.status }
    );
  }
}

export async function listSources(db, { enabled = null, limit = 300 } = {}) {
  const where = enabled === null ? "" : "WHERE enabled=?";
  const statement = db.prepare(`
    SELECT s.*,m.requests,m.successes,m.failures,m.timeouts,m.blocks,
           m.links_found,m.valid_links,m.yield_rate,m.average_latency,
           m.consecutive_failures,m.last_success_at,m.last_failure_at
    FROM sources s
    LEFT JOIN source_metrics m ON m.source_id=s.id
    ${where}
    ORDER BY s.enabled DESC,s.priority DESC,s.id ASC
    LIMIT ?
  `);
  const rows = enabled === null
    ? await statement.bind(limit).all()
    : await statement.bind(enabled ? 1 : 0, limit).all();
  return rows.results || [];
}

export async function setSourceEnabled(db, sourceId, enabled) {
  await assertNoActiveRun(db);
  const result = await db.prepare(
    "UPDATE sources SET enabled=?,updated_at=? WHERE id=?"
  ).bind(enabled ? 1 : 0, nowIso(), sourceId).run();
  if (result.meta?.changes !== 1) {
    throw new AppError("SOURCE_NOT_FOUND", "Source was not found", "sources", 404);
  }
  return { source_id: sourceId, enabled: Boolean(enabled) };
}

export async function setAllSources(db, enabled) {
  await assertNoActiveRun(db);
  const result = await db.prepare(
    "UPDATE sources SET enabled=?,updated_at=?"
  ).bind(enabled ? 1 : 0, nowIso()).run();
  return { updated: result.meta?.changes || 0, enabled: Boolean(enabled) };
}

export async function restoreHighYieldDefaults(db) {
  await assertNoActiveRun(db);
  return seedSources(db, { preserveEnabled: false });
}
