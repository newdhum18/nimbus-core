import { sourceCatalog } from "./catalog.js";
import { chunkArray } from "../db/batch.js";
import { nowIso } from "../db/queries.js";
import { AppError } from "../api/errors.js";

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

  const existing = new Map();
  if (preserveEnabled) {
    const rows = await db.prepare("SELECT id,enabled FROM sources").all();
    for (const row of rows.results || []) existing.set(row.id, Number(row.enabled));
  }

  let processed = 0;
  let enabledCount = 0;
  const catalog = sourceCatalog();
  for (const batch of chunkArray(catalog, 20)) {
    const now = nowIso();
    const statements = batch.map((source) => {
      const enabled = preserveEnabled && existing.has(source.id)
        ? existing.get(source.id)
        : Number(source.defaultEnabled);

      enabledCount += enabled;

      return db.prepare(`
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
        now,
        now
      );
    });
    const results = await db.batch(statements);
    processed += results.length;
  }

  return {
    total: processed,
    enabled: enabledCount
  };
}
