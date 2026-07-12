import { AppError } from "../api/errors.js";
import { nowIso } from "../db/queries.js";
import { chunkArray } from "../db/batch.js";
import { seedSources } from "./defaults.js";
import { calculateSourceRank, sourceRecommendation } from "./ranking.js";

const SORT_SQL = Object.freeze({
  priority: "s.priority DESC,s.id ASC",
  rank: "s.rank_score DESC,s.priority DESC,s.id ASC",
  yield: "COALESCE(m.yield_rate,0) DESC,s.rank_score DESC,s.id ASC",
  name: "s.name COLLATE NOCASE ASC,s.id ASC",
  failures: "COALESCE(m.consecutive_failures,0) DESC,s.id ASC"
});

export async function assertNoActiveRun(db) {
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

function normalizeListOptions(options = {}) {
  const limit = Number(options.limit ?? 100);
  const offset = Number(options.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 300) {
    throw new AppError("INVALID_PARAMETER", "limit must be an integer between 1 and 300", "sources", 400);
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new AppError("INVALID_PARAMETER", "offset must be zero or greater", "sources", 400);
  }
  const sort = SORT_SQL[options.sort] ? options.sort : "priority";
  const search = String(options.search ?? "").trim().slice(0, 200);
  const category = String(options.category ?? "").trim().slice(0, 80);
  const sourceType = String(options.sourceType ?? "").trim().slice(0, 20);
  return { ...options, limit, offset, sort, search, category, sourceType };
}

function buildFilters({ enabled, category, sourceType, search }) {
  const clauses = [];
  const bindings = [];
  if (enabled === true || enabled === false) {
    clauses.push("s.enabled=?");
    bindings.push(enabled ? 1 : 0);
  }
  if (category) {
    clauses.push("s.category=?");
    bindings.push(category);
  }
  if (sourceType) {
    clauses.push("s.source_type=?");
    bindings.push(sourceType);
  }
  if (search) {
    clauses.push("(s.id LIKE ? OR s.name LIKE ? OR s.template_url LIKE ?)");
    const term = `%${search}%`;
    bindings.push(term, term, term);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", bindings };
}

function decorateSource(row) {
  return { ...row, recommendation: sourceRecommendation(row) };
}

export async function listSources(db, options = {}) {
  const normalized = normalizeListOptions(options);
  const { where, bindings } = buildFilters(normalized);
  const statement = db.prepare(`
    SELECT s.*,m.requests,m.successes,m.failures,m.timeouts,m.blocks,
           m.links_found,m.valid_links,m.yield_rate,m.average_latency,
           m.consecutive_failures,m.last_success_at,m.last_failure_at
    FROM sources s
    LEFT JOIN source_metrics m ON m.source_id=s.id
    ${where}
    ORDER BY ${SORT_SQL[normalized.sort]}
    LIMIT ? OFFSET ?
  `);
  const rows = await statement.bind(...bindings, normalized.limit, normalized.offset).all();
  const count = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM sources s
    ${where}
  `).bind(...bindings).first();
  return {
    total: Number(count?.total || 0),
    limit: normalized.limit,
    offset: normalized.offset,
    sources: (rows.results || []).map(decorateSource)
  };
}

export async function getSource(db, sourceId) {
  const row = await db.prepare(`
    SELECT s.*,m.requests,m.successes,m.failures,m.timeouts,m.blocks,
           m.links_found,m.valid_links,m.yield_rate,m.average_latency,
           m.consecutive_failures,m.last_success_at,m.last_failure_at
    FROM sources s
    LEFT JOIN source_metrics m ON m.source_id=s.id
    WHERE s.id=?
  `).bind(sourceId).first();
  if (!row) throw new AppError("SOURCE_NOT_FOUND", "Source was not found", "sources", 404);
  return decorateSource(row);
}

export async function sourceSummary(db) {
  const totals = await db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS enabled,
           SUM(CASE WHEN default_enabled=1 THEN 1 ELSE 0 END) AS default_enabled
    FROM sources
  `).first();
  const categories = await db.prepare(`
    SELECT category,COUNT(*) AS total,SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS enabled
    FROM sources GROUP BY category ORDER BY total DESC,category ASC
  `).all();
  const types = await db.prepare(`
    SELECT source_type,COUNT(*) AS total,SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS enabled
    FROM sources GROUP BY source_type ORDER BY total DESC,source_type ASC
  `).all();
  const performance = await db.prepare(`
    SELECT COALESCE(SUM(requests),0) AS requests,
           COALESCE(SUM(valid_links),0) AS valid_links,
           COALESCE(AVG(CASE WHEN requests>0 THEN yield_rate END),0) AS average_yield,
           COALESCE(AVG(CASE WHEN requests>0 THEN average_latency END),0) AS average_latency
    FROM source_metrics
  `).first();
  return {
    total: Number(totals?.total || 0),
    enabled: Number(totals?.enabled || 0),
    default_enabled: Number(totals?.default_enabled || 0),
    categories: categories.results || [],
    source_types: types.results || [],
    performance
  };
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

export async function setSourcesEnabled(db, sourceIds, enabled) {
  await assertNoActiveRun(db);
  const ids = [...new Set((sourceIds || []).map((value) => String(value).trim()).filter(Boolean))];
  if (!ids.length || ids.length > 300) {
    throw new AppError("INVALID_SOURCE_IDS", "source_ids must contain between 1 and 300 unique IDs", "sources", 400);
  }
  const existing = await db.prepare(
    `SELECT id FROM sources WHERE id IN (${ids.map(() => "?").join(",")})`
  ).bind(...ids).all();
  const found = new Set((existing.results || []).map((row) => row.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new AppError("SOURCE_NOT_FOUND", "One or more sources were not found", "sources", 404, { missing });
  }
  let updated = 0;
  for (const batch of chunkArray(ids, 20)) {
    const now = nowIso();
    const statements = batch.map((id) => db.prepare(
      "UPDATE sources SET enabled=?,updated_at=? WHERE id=?"
    ).bind(enabled ? 1 : 0, now, id));
    const results = await db.batch(statements);
    updated += results.reduce((sum, item) => sum + Number(item.meta?.changes || 0), 0);
  }
  return { updated, enabled: Boolean(enabled), source_ids: ids };
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

export async function refreshSourceRanks(db) {
  await assertNoActiveRun(db);
  const rows = await db.prepare(`
    SELECT s.id,s.priority,m.requests,m.successes,m.timeouts,m.blocks,m.valid_links,
           m.average_latency,m.consecutive_failures
    FROM sources s LEFT JOIN source_metrics m ON m.source_id=s.id
    ORDER BY s.id ASC
  `).all();
  let updated = 0;
  for (const batch of chunkArray(rows.results || [], 20)) {
    const now = nowIso();
    const statements = batch.map((row) => db.prepare(
      "UPDATE sources SET rank_score=?,updated_at=? WHERE id=?"
    ).bind(calculateSourceRank(row, row.priority), now, row.id));
    const results = await db.batch(statements);
    updated += results.reduce((sum, item) => sum + Number(item.meta?.changes || 0), 0);
  }
  return { updated };
}
