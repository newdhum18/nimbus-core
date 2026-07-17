import { AppError } from "../api/errors.js";
import { nowIso } from "../db/queries.js";
import { chunkArray } from "../db/batch.js";
import { seedSources } from "./defaults.js";
import { calculateSourceRank, sourceRecommendation } from "./ranking.js";
import { assertPublicHttpUrl } from "../search/crawler.js";


export async function getSourceControlMode(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key='source_control_mode'").first();
  return ["automatic", "manual"].includes(row?.value) ? row.value : "automatic";
}

function userSourceId(url) {
  let hash = 2166136261;
  for (const char of String(url)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `user_${(hash >>> 0).toString(36)}`;
}

export async function addDirectSource(db, { url, name = "", category = "custom", enabled = true } = {}) {
  const parsed = assertPublicHttpUrl(String(url || "").trim());
  parsed.hash = "";
  const templateUrl = parsed.toString();
  const id = userSourceId(templateUrl);
  const cleanName = String(name || parsed.hostname).trim().slice(0, 120) || parsed.hostname;
  const cleanCategory = String(category || "custom").trim().slice(0, 80) || "custom";
  const now = nowIso();
  await db.prepare("DELETE FROM source_tombstones WHERE source_id=?").bind(id).run().catch(() => {});
  await db.prepare(`
    INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,template_url=excluded.template_url,enabled=excluded.enabled,updated_at=excluded.updated_at
  `).bind(id,cleanName,cleanCategory,"custom",templateUrl,enabled?1:0,0,100,0,now,now).run();
  return getSource(db,id);
}

export async function deleteSource(db, sourceId) {
  const source = await db.prepare("SELECT id,name FROM sources WHERE id=?").bind(sourceId).first();
  if (!source) throw new AppError("SOURCE_NOT_FOUND", "Source was not found", "sources", 404);
  const activeTask = await db.prepare(`
    SELECT t.id,t.run_id,t.status FROM run_tasks t
    JOIN runs r ON r.id=t.run_id
    WHERE t.source_id=? AND r.status IN ('running','paused','recovering')
      AND t.status NOT IN ('completed','failed','cancelled','dead')
    LIMIT 1
  `).bind(sourceId).first();
  if (activeTask) throw new AppError("SOURCE_DELETE_BLOCKED", "This source is being used by an active run. Cancel or finish that run first.", "sources", 409, { run_id: activeTask.run_id, task_id: activeTask.id });
  const now = nowIso();
  await db.batch([
    db.prepare("INSERT INTO source_tombstones(source_id,deleted_at,reason) VALUES(?,?,?) ON CONFLICT(source_id) DO UPDATE SET deleted_at=excluded.deleted_at,reason=excluded.reason").bind(sourceId,now,"user_deleted"),
    db.prepare("DELETE FROM sources WHERE id=?").bind(sourceId)
  ]);
  return { deleted: true, source_id: sourceId, name: source.name, permanent: true };
}

const SORT_SQL = Object.freeze({
  priority: "s.priority DESC,s.id ASC",
  rank: "s.rank_score DESC,s.priority DESC,s.id ASC",
  yield: "COALESCE(m.yield_rate,0) DESC,s.rank_score DESC,s.id ASC",
  name: "s.name COLLATE NOCASE ASC,s.id ASC",
  failures: "COALESCE(m.consecutive_failures,0) DESC,s.id ASC",
  speed: "CASE WHEN COALESCE(m.average_latency,0)=0 THEN 1 ELSE 0 END ASC,COALESCE(m.average_latency,0) ASC,s.id ASC",
  health: "COALESCE(m.consecutive_failures,0) ASC,COALESCE(m.yield_rate,0) DESC,COALESCE(m.average_latency,0) ASC,s.id ASC"
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

function sourceTier(row) {
  const requests = Number(row.requests || 0);
  const yieldRate = Number(row.yield_rate || 0);
  const failures = Number(row.consecutive_failures || 0);
  if (requests >= 5 && failures >= 5) return "dead";
  if (requests === 0) return "unrated";
  if (yieldRate >= 25) return "high_yield";
  if (yieldRate >= 5) return "medium_yield";
  return "low_yield";
}
function sourceHealth(row) {
  const requests = Number(row.requests || 0);
  const failures = Number(row.consecutive_failures || 0);
  const blocks = Number(row.blocks || 0);
  if (requests >= 5 && (failures >= 5 || blocks / requests >= 0.6)) return "dead";
  if (failures >= 2 || blocks > 0) return "warning";
  if (requests === 0) return "unknown";
  return "healthy";
}
function decorateSource(row) {
  return { ...row, tier: sourceTier(row), health: sourceHealth(row), recommendation: sourceRecommendation(row) };
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
  // Domain-level discovery is authoritative. source_candidates contains many
  // URL-level evidence rows for the same host, so counting it inflates the UI
  // and makes one promoted source look like dozens of promotions.
  const discovery = await db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN state IN ('candidate','testing','sandbox') THEN 1 ELSE 0 END) AS candidates,
           SUM(CASE WHEN state='promoted' THEN 1 ELSE 0 END) AS promoted
    FROM source_candidate_domains
  `).first().catch(() => ({ total:0,candidates:0,promoted:0 }));
  return {
    total: Number(totals?.total || 0),
    enabled: Number(totals?.enabled || 0),
    default_enabled: Number(totals?.default_enabled || 0),
    categories: categories.results || [],
    source_types: types.results || [],
    performance,
    discovery: { total:Number(discovery?.total||0), candidates:Number(discovery?.candidates||0), promoted:Number(discovery?.promoted||0) }
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
