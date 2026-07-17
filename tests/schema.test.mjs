import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tables = [
  "schema_migrations", "runs", "run_tasks", "sources", "source_metrics",
  "pages", "links", "visited_urls", "events", "settings", "dead_tasks"
];

test("schema contains approved tables only", async () => {
  const schema = await readFile("src/db/schema.sql", "utf8");
  for (const table of tables) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.doesNotMatch(schema, /nimbus_v\d/i);
});

test("links are unique per run rather than globally", async () => {
  const schema = await readFile("src/db/schema.sql", "utf8");
  assert.match(schema, /UNIQUE\(run_id, normalized_url\)/);
});

test("task recovery fields exist", async () => {
  const schema = await readFile("src/db/schema.sql", "utf8");
  for (const field of ["lease_until", "queued_at", "updated_at", "attempts"]) {
    assert.match(schema, new RegExp(field));
  }
});


test("fresh schema accepts every catalog source type", async () => {
  const schema = await readFile("src/db/schema.sql", "utf8");
  const match = schema.match(/source_type TEXT NOT NULL CHECK\(source_type IN \(([^)]*)\)\)/);
  assert.ok(match, "sources.source_type CHECK constraint must exist");
  const allowed = new Set([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]));
  for (const type of ["html", "rss", "json", "custom"]) {
    assert.ok(allowed.has(type), `fresh schema is missing source type: ${type}`);
  }
});
