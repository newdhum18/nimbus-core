import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";

for (const path of ["evidence", "UI_RECOVERY_AUDIT.json", "ENGINEERING_AUDIT_REPORT.md"]) {
  try {
    await access(path);
    throw new Error(`obsolete baseline artifact present: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const worker = JSON.parse(await readFile("wrangler.worker.jsonc", "utf8"));
const ignore = await readFile(".gitignore", "utf8");
assert.equal(pkg.version, "36.13.1");
assert.equal(worker.name, "nimbus-core-v36-worker");
assert.equal(worker.d1_databases[0].database_name, "nimbus-core-v36-db");
assert.equal(worker.queues.producers[0].queue, "nimbus-core-v36-queue");
for (const required of ["node_modules/", "dist/", ".wrangler/", ".env"]) assert.match(ignore, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const migrations = (await readdir("src/db/migrations")).filter((x) => x.endsWith(".sql")).sort();
assert.equal(migrations.at(-1), "0010_zero_foundation_hardening.sql");
await access("backup/nimbus-core-v36-zero.sqlite");
await access("backup/DATABASE_SCHEMA_REFERENCE.sql");
console.log("Clean baseline verification PASS");
