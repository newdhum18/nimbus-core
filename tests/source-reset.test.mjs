import test from "node:test";
import assert from "node:assert/strict";
import { seedSources } from "../src/sources/defaults.js";

function transactionalDb({ existing = [], failBatch = false } = {}) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const entry = { sql, params: [] };
      calls.push(entry);
      const statement = {
        bind(...params) {
          entry.params = params;
          return statement;
        },
        async first() {
          if (sql.includes("status IN ('running'")) return null;
          return null;
        },
        async all() {
          if (sql.includes("FROM sources")) return { results: existing };
          return { results: [] };
        },
        async run() { return { success: true, meta: { changes: 1 } }; }
      };
      return statement;
    },
    async batch(statements) {
      db.batchStatements = statements;
      if (failBatch) throw new Error("simulated transactional failure");
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    }
  };
  return db;
}

test("source reset avoids giant NOT IN clauses and writes 300 catalog rows transactionally", async () => {
  const db = transactionalDb({
    existing: [{
      id: "obsolete_source", name: "Old", category: "old", source_type: "html",
      template_url: "https://old.invalid/?q={q}", enabled: 1, default_enabled: 0,
      priority: 1, rank_score: 0, created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    }]
  });
  const result = await seedSources(db, { preserveEnabled: false });
  assert.equal(result.total, 300);
  assert.equal(result.enabled, 80);
  assert.equal(result.removed_obsolete, 1);
  assert.equal(db.batchStatements.length, 302);
  assert.equal(db.calls.some((call) => /NOT IN\s*\(/i.test(call.sql)), false);
  assert.equal(db.calls.filter((call) => call.sql.includes("INSERT INTO sources")).length, 300);
  assert.equal(db.calls.filter((call) => call.sql.includes("UPDATE sources SET template_url")).length, 1);
  assert.ok(db.calls.every((call) => call.params.length <= 11));
});

test("source reset preserves existing enabled state without multi-variable SQL", async () => {
  const db = transactionalDb({
    existing: [{
      id: "direct_meawfy_api", name: "Existing", category: "api", source_type: "json",
      template_url: "https://example.invalid/?q={q}", enabled: 0, default_enabled: 1,
      priority: 999, rank_score: 90, created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    }]
  });
  const result = await seedSources(db, { preserveEnabled: true });
  const meawfy = db.calls.find((call) => call.sql.includes("INSERT INTO sources") && call.params[0] === "direct_meawfy_api");
  assert.ok(meawfy);
  assert.equal(meawfy.params[5], 0);
  assert.equal(result.total, 300);
});

test("source reset propagates batch failure so D1 can roll back the transaction", async () => {
  const db = transactionalDb({ failBatch: true });
  await assert.rejects(() => seedSources(db, { preserveEnabled: false }), /simulated transactional failure/);
});


test("source reset neutralizes old template URLs before catalog upserts", async () => {
  const db = transactionalDb({
    existing: [
      { id: "old_a", name: "A", category: "old", source_type: "html", template_url: "https://collision.invalid/?q={q}", enabled: 1, default_enabled: 0, priority: 1, rank_score: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
      { id: "old_b", name: "B", category: "old", source_type: "html", template_url: "https://another.invalid/?q={q}", enabled: 0, default_enabled: 0, priority: 1, rank_score: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }
    ]
  });
  await seedSources(db, { preserveEnabled: false });
  const neutralizers = db.calls.filter((call) => call.sql.includes("UPDATE sources SET template_url"));
  assert.equal(neutralizers.length, 2);
  assert.ok(neutralizers.every((call) => String(call.params[0]).startsWith("urn:nimbus-source-reset:")));
  const firstInsertIndex = db.calls.findIndex((call) => call.sql.includes("INSERT INTO sources"));
  const lastNeutralizerIndex = Math.max(...neutralizers.map((entry) => db.calls.indexOf(entry)));
  assert.ok(lastNeutralizerIndex < firstInsertIndex);
});
