import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SYSTEM } from "../src/config.js";
import { EXPECTED_SCHEMA_VERSION } from "../src/db/migration-catalog.js";

test("clean baseline identity and schema version are synchronized", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.version, SYSTEM.version);
  assert.equal(SYSTEM.version, "36.19.2");
  assert.equal(EXPECTED_SCHEMA_VERSION, 14);
});

test("source discovery uses D1-safe inserts and queue-efficient envelopes", async () => {
  const runs = await readFile("src/sources/discovery-runs.js", "utf8");
  assert.match(runs, /chunkItems\(seeds,Math\.min\(SYSTEM\.sqlBatchMax,SYSTEM\.sqlBatchSize\)\)/);
  assert.equal(SYSTEM.sourceDiscoveryTasksPerMessage, 2);
  assert.ok(SYSTEM.sourceDiscoveryDispatchTasks >= SYSTEM.sourceDiscoveryTasksPerMessage);
});

test("source graph preserves source id and real host separately", async () => {
  const discovery = await readFile("src/sources/discovery.js", "utf8");
  const migration = await readFile("src/db/migrations/0010_zero_foundation_hardening.sql", "utf8");
  assert.match(discovery, /from_host,to_host,discovery_method,evidence_url,evidence_count,first_seen_at,last_seen_at,from_source_id/);
  assert.match(discovery, /sourceHost/);
  assert.match(migration, /ADD COLUMN from_source_id TEXT/);
});
