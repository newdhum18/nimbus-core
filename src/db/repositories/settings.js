import { first, run, nowIso } from "../queries.js";
import { requireDb } from "./base.js";

export async function getSetting(db, key) {
  requireDb(db);
  const row = await first(db, "SELECT value FROM settings WHERE key=?", [key]);
  return row?.value ?? null;
}

export async function setSetting(db, key, value) {
  requireDb(db);
  await run(db, `INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`, [key,String(value),nowIso()]);
  return getSetting(db,key);
}
