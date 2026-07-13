import test from "node:test";
import assert from "node:assert/strict";
import { buildQuery } from "../src/search/keyword.js";
import { autoscanQuery, AUTOSCAN_QUERIES } from "../src/search/autoscan.js";
import { rankSource } from "../src/search/ranking.js";
import { assertPublicHttpUrl } from "../src/search/crawler.js";

test("keyword query includes folder pattern", () => {
  assert.equal(buildQuery("example"), "example");
});

test("blank keyword is rejected", () => {
  assert.throws(() => buildQuery("   "));
});

test("autoscan rounds are stable", () => {
  assert.equal(autoscanQuery(0), AUTOSCAN_QUERIES[0]);
  assert.equal(autoscanQuery(AUTOSCAN_QUERIES.length), AUTOSCAN_QUERIES[0]);
});

test("ranking penalizes failures", () => {
  assert.ok(
    rankSource({ priority: 10, consecutive_failures: 0 }) >
    rankSource({ priority: 10, consecutive_failures: 2 })
  );
});

test("URL guard blocks local/private addresses", () => {
  assert.throws(() => assertPublicHttpUrl("http://localhost/test"));
  assert.throws(() => assertPublicHttpUrl("http://127.0.0.1/test"));
  assert.throws(() => assertPublicHttpUrl("http://192.168.1.1/test"));
  assert.doesNotThrow(() => assertPublicHttpUrl("https://example.com/test"));
});

test("URL guard blocks credentials, private ranges and unsupported ports", () => {
  assert.throws(() => assertPublicHttpUrl("https://user:pass@example.com/test"));
  assert.throws(() => assertPublicHttpUrl("http://100.64.0.1/test"));
  assert.throws(() => assertPublicHttpUrl("https://example.local/test"));
  assert.throws(() => assertPublicHttpUrl("https://example.com:8443/test"));
});


test("multi-round task URLs remain unique", async () => {
  const { withRoundIdentity } = await import("../src/runs/start.js");
  const base = "https://example.com/search?q=test";
  const urls = Array.from({ length: 100 }, (_, index) => withRoundIdentity(base, index));
  assert.equal(new Set(urls).size, 100);
  assert.match(urls[0], /#nimbus_round=1$/);
  assert.match(urls[99], /#nimbus_round=100$/);
});


test("round plan scales task count exactly", async () => {
  const { totalTasksForRounds } = await import("../src/runs/start.js");
  assert.equal(totalTasksForRounds(80, 1), 80);
  assert.equal(totalTasksForRounds(80, 25), 2000);
  assert.equal(totalTasksForRounds(80, 100), 8000);
});
