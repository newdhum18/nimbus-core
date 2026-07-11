import { nowIso } from "./queries.js";
import { recoverTasks } from "../runs/recovery.js";
import { seedSources } from "../sources/defaults.js";

export async function repairDatabase(env) {
  const db = env.DB;
  const startedAt = nowIso();
  const tables = await db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const expected = [
    "dead_tasks","events","links","pages","run_tasks","runs",
    "schema_migrations","settings","source_metrics","sources","visited_urls"
  ];
  const existing = new Set((tables.results || []).map((row) => row.name));
  const missing = expected.filter((name) => !existing.has(name));
  if (missing.length) {
    return { ok: false, started_at: startedAt, missing_tables: missing, action: "apply_schema_required" };
  }

  const recovered = await recoverTasks(db);
  const sources = await seedSources(db, { preserveEnabled: true });
  await db.prepare(`
    INSERT INTO settings(key,value,updated_at) VALUES('last_repair_at',?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `).bind(startedAt, startedAt).run();

  return {
    ok: true,
    schema_version: 1,
    missing_tables: [],
    tasks_recovered: recovered,
    sources_upserted: sources.total,
    completed_at: nowIso()
  };
}
