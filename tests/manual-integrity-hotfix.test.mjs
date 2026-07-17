import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDirectSourceResults } from "../src/search/adapters/custom.js";

test("manual mode metrics never mutate source enabled state", async () => {
  const source = await readFile(new URL("../src/sources/metrics.js", import.meta.url), "utf8");
  assert.match(source, /control\?\.value === 'manual'/);
  assert.match(source, /UPDATE sources SET rank_score=\?,updated_at=\? WHERE id=\?/);
});

test("DELETE is allowed by CORS for source manager", async () => {
  const source = await readFile(new URL("../src/api/cors.js", import.meta.url), "utf8");
  assert.match(source, /GET,POST,DELETE,OPTIONS/);
});

test("direct source crawler follows useful same-host pages and note destinations", () => {
  const html = `<a href="/post/one">Post</a><a href="https://pastelink.net/abcd1234">Note</a><img src="/image.jpg">`;
  const targets = parseDirectSourceResults(html, "https://example.com/");
  assert.ok(targets.includes("https://example.com/post/one"));
  assert.ok(targets.includes("https://pastelink.net/abcd1234"));
  assert.ok(targets.includes("https://pastelink.net/abcd1234"));
  assert.equal(targets.some((x) => x.endsWith("image.jpg")), false);
});

test("source deletion is persisted with tombstones", async () => {
  const service = await readFile(new URL("../src/sources/service.js", import.meta.url), "utf8");
  const defaults = await readFile(new URL("../src/sources/defaults.js", import.meta.url), "utf8");
  assert.match(service, /INSERT INTO source_tombstones/);
  assert.match(defaults, /source_tombstones/);
});
