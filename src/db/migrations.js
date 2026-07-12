import { MIGRATIONS, EXPECTED_SCHEMA_VERSION } from "./migration-catalog.js";
import { all, first, nowIso } from "./queries.js";

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

export { MIGRATIONS, EXPECTED_SCHEMA_VERSION };

export async function migrationStatus(db) {
  await db.prepare(BOOTSTRAP_SQL).run();
  const result = await all(
    db,
    "SELECT version,name,checksum,applied_at FROM schema_migrations ORDER BY version"
  );
  return result.results || [];
}

export async function currentSchemaVersion(db) {
  await db.prepare(BOOTSTRAP_SQL).run();
  const row = await first(db, "SELECT MAX(version) AS version FROM schema_migrations");
  return Number(row?.version || 0);
}

export async function assertMigrationHistory(db) {
  const applied = await migrationStatus(db);
  const known = new Map(MIGRATIONS.map((migration) => [migration.version, migration]));

  for (const row of applied) {
    const migration = known.get(Number(row.version));
    if (!migration) {
      throw new Error(`Database contains unknown migration version ${row.version}`);
    }
    if (row.name !== migration.name || row.checksum !== migration.checksum) {
      throw new Error(`Migration integrity mismatch at version ${row.version}`);
    }
  }

  return applied;
}

export async function recordMigration(db, migration, appliedAt = nowIso()) {
  await db.prepare(`
    INSERT INTO schema_migrations(version,name,checksum,applied_at)
    VALUES(?,?,?,?)
  `).bind(migration.version, migration.name, migration.checksum, appliedAt).run();
}
