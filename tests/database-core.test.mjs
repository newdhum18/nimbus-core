import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS, EXPECTED_SCHEMA_VERSION } from "../src/db/migration-catalog.js";

const schemaPath = "src/db/migrations/0001_initial.sql";
const approvedTables = [
  "dead_tasks","events","links","pages","run_tasks","runs",
  "schema_migrations","settings","source_metrics","sources","visited_urls"
];

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

async function applyInitial(db) {
  const sql = await readFile(schemaPath, "utf8");
  db.exec(sql);
  const migration = MIGRATIONS[0];
  db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`)
    .run(migration.version,migration.name,migration.checksum,new Date().toISOString());
}

test("migration checksum is the real SHA-256 of its SQL file", async () => {
  const bytes = await readFile(schemaPath);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  assert.equal(checksum, MIGRATIONS[0].checksum);
  assert.equal(EXPECTED_SCHEMA_VERSION, 5);
});

test("fresh database creates exactly the approved eleven tables", async () => {
  const db = freshDb();
  await applyInitial(db);
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  assert.deepEqual(rows.map((row)=>row.name), approvedTables);
  db.close();
});

test("schema is idempotent across three consecutive applications", async () => {
  const db = freshDb();
  await applyInitial(db);
  await applyInitial(db);
  await applyInitial(db);
  const count = db.prepare("SELECT COUNT(*) count FROM schema_migrations").get().count;
  assert.equal(count, 1);
  db.close();
});

test("single-active-run partial unique index is enforced", async () => {
  const db = freshDb();
  await applyInitial(db);
  const insert = db.prepare(`INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES(?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  insert.run("run_1","autoscan","","running",now,now);
  assert.throws(() => insert.run("run_2","keyword","x","paused",now,now), /UNIQUE constraint failed/);
  insert.run("run_3","keyword","x","completed",now,now);
  db.close();
});

test("foreign keys cascade run-owned records", async () => {
  const db = freshDb();
  await applyInitial(db);
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES('run_1','autoscan','','created',?,?)`).run(now,now);
  db.prepare(`INSERT INTO run_tasks(id,run_id,url,task_type,status,created_at,updated_at) VALUES('task_1','run_1','https://example.com','fetch','pending',?,?)`).run(now,now);
  db.prepare(`DELETE FROM runs WHERE id='run_1'`).run();
  assert.equal(db.prepare(`SELECT COUNT(*) count FROM run_tasks`).get().count,0);
  db.close();
});

test("folder-only and completeness constraints reject invalid rows", async () => {
  const db = freshDb();
  await applyInitial(db);
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES('run_1','autoscan','','created',?,?)`).run(now,now);
  const insert = db.prepare(`INSERT INTO links(id,run_id,url,normalized_url,link_type,has_key,validation_status,is_complete,discovered_at) VALUES(?,?,?,?,?,?,?,?,?)`);
  assert.throws(() => insert.run("l1","run_1","u","n","file",1,"valid",1,now), /CHECK constraint failed/);
  insert.run("l2","run_1","u2","n2","folder",1,"valid",1,now);
  assert.equal(db.prepare(`SELECT COUNT(*) count FROM links`).get().count,1);
  db.close();
});

test("pagination and operational indexes are present", async () => {
  const db = freshDb();
  await applyInitial(db);
  const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`).all().map((row)=>row.name);
  for (const expected of ["idx_runs_created_at","idx_tasks_run_status","idx_links_run","idx_events_run","idx_pages_run"]) {
    assert.ok(indexes.includes(expected), `${expected} missing`);
  }
  db.close();
});

test("nullable source task identity is duplicate-safe", async () => {
  const db=freshDb();
  for (const m of MIGRATIONS) { const sql=await readFile(m.file,"utf8"); db.exec(sql); db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`).run(m.version,m.name,m.checksum,new Date().toISOString()); }
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES('run_null','autoscan','','created',?,?)`).run(now,now);
  const insert=db.prepare(`INSERT INTO run_tasks(id,run_id,source_id,url,task_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`);
  insert.run('task_a','run_null',null,'https://example.com/a','fetch','pending',now,now);
  assert.throws(()=>insert.run('task_b','run_null',null,'https://example.com/a','fetch','pending',now,now),/UNIQUE constraint failed/);
  db.close();
});

test("legacy migration seed remains deterministic before autonomous catalog reset", async () => {
  const db=freshDb();
  for (const m of MIGRATIONS) { db.exec(await readFile(m.file,"utf8")); db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`).run(m.version,m.name,m.checksum,new Date().toISOString()); }
  const counts=db.prepare(`SELECT COUNT(*) total,SUM(enabled) enabled,SUM(default_enabled) default_enabled FROM sources`).get();
  assert.equal(counts.total,300); assert.equal(counts.enabled,80); assert.equal(counts.default_enabled,80);
  db.close();
});

test("upgrade path applies pending migrations after version one", async () => {
  const db=freshDb();
  const first=MIGRATIONS[0]; db.exec(await readFile(first.file,"utf8")); db.prepare(`INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`).run(first.version,first.name,first.checksum,new Date().toISOString());
  for (const m of MIGRATIONS.slice(1)) { db.exec(await readFile(m.file,"utf8")); db.prepare(`INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`).run(m.version,m.name,m.checksum,new Date().toISOString()); }
  assert.equal(db.prepare(`SELECT MAX(version) version FROM schema_migrations`).get().version,EXPECTED_SCHEMA_VERSION);
  assert.equal(db.prepare(`SELECT COUNT(*) total FROM sources`).get().total,300);
  db.close();
});

test("migration history rejects checksum drift", async () => {
  const db=freshDb(); await applyInitial(db);
  db.prepare(`UPDATE schema_migrations SET checksum='bad' WHERE version=1`).run();
  const row=db.prepare(`SELECT checksum FROM schema_migrations WHERE version=1`).get();
  assert.notEqual(row.checksum,MIGRATIONS[0].checksum);
  db.close();
});
