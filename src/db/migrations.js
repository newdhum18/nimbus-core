import { all } from "./queries.js";

export const EXPECTED_SCHEMA_VERSION = 1;

export async function migrationStatus(db) {
  const result = await all(
    db,
    "SELECT version,name,checksum,applied_at FROM schema_migrations ORDER BY version"
  );
  return result.results || [];
}

export async function currentSchemaVersion(db) {
  const row = await db.prepare("SELECT MAX(version) version FROM schema_migrations").first();
  return Number(row?.version || 0);
}
