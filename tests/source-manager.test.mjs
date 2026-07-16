import test from "node:test";
import assert from "node:assert/strict";
import { calculateSourceRank, sourceRecommendation } from "../src/sources/ranking.js";
import { listSources, setSourcesEnabled, refreshSourceRanks } from "../src/sources/service.js";
import { sourceCatalog } from "../src/sources/catalog.js";
import { SYSTEM } from "../src/config.js";

function statementDb() {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const entry = { sql, params: [] };
      calls.push(entry);
      return {
        bind(...params) {
          entry.params = params;
          return {
            async first() {
              if (sql.includes("COUNT(*) AS total")) return { total: 1 };
              if (sql.includes("status IN ('running'")) return null;
              return null;
            },
            async all() {
              if (sql.includes("SELECT s.*")) return { results: [{ id: "high_001", enabled: 1, priority: 999, rank_score: 20 }] };
              if (sql.includes("SELECT id FROM sources")) return { results: params.map((id) => ({ id })) };
              if (sql.includes("SELECT s.id,s.priority")) return { results: [{ id: "high_001", priority: 999, requests: 10, successes: 8, valid_links: 4, average_latency: 500, timeouts: 0, blocks: 0, consecutive_failures: 0 }] };
              return { results: [] };
            },
            async run() { return { meta: { changes: 1 } }; }
          };
        },
        async first() {
          if (sql.includes("status IN ('running'")) return null;
          if (sql.includes("COUNT(*) AS total")) return { total: 1 };
          return null;
        },
        async all() {
          if (sql.includes("SELECT s.id,s.priority")) return { results: [{ id: "high_001", priority: 999, requests: 10, successes: 8, valid_links: 4, average_latency: 500, timeouts: 0, blocks: 0, consecutive_failures: 0 }] };
          return { results: [] };
        },
        async run() { return { meta: { changes: 1 } }; }
      };
    },
    async batch(statements) { return Promise.all(statements.map((item) => item.run())); }
  };
  return db;
}

test("source ranking is deterministic and bounded", () => {
  const good = calculateSourceRank({ requests: 20, successes: 18, valid_links: 12, average_latency: 310 }, 900);
  const poor = calculateSourceRank({ requests: 20, successes: 2, valid_links: 0, timeouts: 8, blocks: 4, consecutive_failures: 6, average_latency: 5000 }, 100);
  assert.ok(good > poor);
  assert.ok(good <= 100 && poor >= 0);
  assert.equal(good, calculateSourceRank({ requests: 20, successes: 18, valid_links: 12, average_latency: 310 }, 900));
});

test("recommendations never auto-disable a source", () => {
  assert.equal(sourceRecommendation({ requests: 20, consecutive_failures: 6, enabled: 1 }), "review_disable");
  assert.equal(sourceRecommendation({ requests: 0, enabled: 1 }), "keep");
});

test("source listing supports filters, pagination and safe sort", async () => {
  const db = statementDb();
  const result = await listSources(db, { enabled: true, category: "paste", sourceType: "html", search: "rentry", sort: "rank", limit: 25, offset: 5 });
  assert.equal(result.total, 1);
  assert.equal(result.limit, 25);
  assert.equal(result.offset, 5);
  assert.equal(result.sources[0].recommendation, "keep");
  const query = db.calls.find((call) => call.sql.includes("SELECT s.*"));
  assert.match(query.sql, /s\.enabled=\?/);
  assert.match(query.sql, /s\.category=\?/);
  assert.match(query.sql, /s\.rank_score DESC/);
});

test("bulk source changes are deduplicated and batched", async () => {
  const db = statementDb();
  const result = await setSourcesEnabled(db, ["high_001", "high_001", "high_002"], true);
  assert.equal(result.updated, 2);
  assert.deepEqual(result.source_ids, ["high_001", "high_002"]);
});

test("rank refresh writes calculated scores in batches", async () => {
  const db = statementDb();
  const result = await refreshSourceRanks(db);
  assert.equal(result.updated, 1);
  const update = db.calls.find((call) => call.sql.includes("UPDATE sources SET rank_score"));
  assert.ok(update);
  assert.equal(typeof update.params[0], "number");
});


test("autonomous source catalog matches dynamic system metadata", () => {
  const catalog = sourceCatalog();
  const enabled = catalog.filter((source) => source.enabled).length;
  assert.equal(catalog.length, SYSTEM.sourceTotal);
  assert.equal(enabled, SYSTEM.sourceEnabledDefault);
  assert.ok(catalog.length > 0);
  assert.ok(enabled > 0 && enabled <= catalog.length);
  assert.equal(new Set(catalog.map((source) => source.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((source) => source.templateUrl)).size, catalog.length);
  assert.equal(catalog.some((source) => /github|youtube/i.test(`${source.name} ${source.templateUrl}`)), false);
});
