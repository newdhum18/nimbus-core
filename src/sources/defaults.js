import { sourceCatalog } from "./catalog.js";
import { nowIso } from "../db/queries.js";
import { AppError } from "../api/errors.js";

/**
 * D1Database.batch() executes the supplied statements sequentially as one
 * transaction. If any statement fails, D1 rolls the whole batch back.
 *
 * Keep every catalog row as its own prepared statement. This prevents the
 * SQLite "too many SQL variables" failure that occurs when hundreds of IDs
 * are bound to one NOT IN(...) or multi-row INSERT statement.
 */
export async function seedSources(db, { preserveEnabled = true } = {}) {
  const active = await db.prepare(
    "SELECT id FROM runs WHERE status IN ('running','paused','recovering') LIMIT 1"
  ).first();
  if (active) {
    throw new AppError(
      "SOURCE_RESET_BLOCKED",
      "Cannot reset sources while a run is running or paused",
      "sources",
      409,
      { run_id: active.id }
    );
  }

  const existingRows = await db.prepare(`
    SELECT id,name,category,source_type,template_url,enabled,default_enabled,
           priority,rank_score,created_at,updated_at
    FROM sources
    ORDER BY id ASC
  `).all();
  const existing = new Map((existingRows.results || []).map((row) => [row.id, row]));

  const tombstoneRows = await db.prepare("SELECT source_id FROM source_tombstones").all().catch(() => ({ results: [] }));
  const tombstones = new Set((tombstoneRows.results || []).map((row) => String(row.source_id)));
  const catalog = sourceCatalog();
  const catalogIds = new Set(catalog.map((source) => source.id));
  const obsoleteIds = [...existing.keys()].filter((id) => !catalogIds.has(id));
  const now = nowIso();
  let enabledCount = 0;

  // First move every existing template to a transaction-local unique placeholder.
  // This prevents UNIQUE(template_url) collisions when catalog IDs/templates were
  // renamed or swapped between releases. The final upserts restore real URLs.
  const statements = [...existing.keys()].map((id) =>
    db.prepare("UPDATE sources SET template_url=?,updated_at=? WHERE id=?")
      .bind(`urn:nimbus-source-reset:${encodeURIComponent(id)}:${now}`, now, id)
  );

  // One statement per obsolete row avoids a 300-variable NOT IN clause.
  for (const id of obsoleteIds) {
    statements.push(db.prepare("DELETE FROM sources WHERE id=?").bind(id));
  }

  for (const source of catalog) {
    const enabled = preserveEnabled && existing.has(source.id)
      ? Number(existing.get(source.id).enabled)
      : Number(source.defaultEnabled);
    enabledCount += enabled;

    statements.push(db.prepare(`
      INSERT INTO sources(
        id,name,category,source_type,template_url,enabled,default_enabled,
        priority,rank_score,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        category=excluded.category,
        source_type=excluded.source_type,
        template_url=excluded.template_url,
        enabled=excluded.enabled,
        default_enabled=excluded.default_enabled,
        priority=excluded.priority,
        rank_score=excluded.rank_score,
        updated_at=excluded.updated_at
    `).bind(
      source.id,
      source.name,
      source.category,
      source.sourceType,
      source.templateUrl,
      enabled,
      Number(source.defaultEnabled),
      source.priority,
      source.rankScore,
      existing.get(source.id)?.created_at || now,
      now
    ));
  }

  // D1 batch is transactional: any failed delete/upsert rolls back the reset.
  const results = await db.batch(statements);
  const upsertResults = results.slice(existing.size + obsoleteIds.length);
  if (upsertResults.length !== catalog.length) {
    throw new AppError(
      "SOURCE_RESET_INCOMPLETE",
      "Source reset did not process the complete catalog",
      "sources",
      500,
      { expected: catalog.length, processed: upsertResults.length }
    );
  }

  return {
    total: catalog.length,
    enabled: enabledCount,
    removed_obsolete: obsoleteIds.length,
    transaction_statements: statements.length,
    expected_total: catalog.length,
    expected_enabled: preserveEnabled ? null : catalog.filter((source) => source.defaultEnabled).length
  };
}
