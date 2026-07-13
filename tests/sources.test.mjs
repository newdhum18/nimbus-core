import test from "node:test";
import assert from "node:assert/strict";
import { sourceCatalog } from "../src/sources/catalog.js";

test("catalog has exactly 300 sources", () => {
  assert.equal(sourceCatalog().length, 300);
});

test("catalog has exactly 80 enabled defaults", () => {
  assert.equal(sourceCatalog().filter((source) => source.enabled).length, 80);
});

test("source IDs are unique", () => {
  const ids = sourceCatalog().map((source) => source.id);
  assert.equal(new Set(ids).size, 300);
});

test("source templates are unique", () => {
  const templates = sourceCatalog().map((source) => source.templateUrl);
  assert.equal(new Set(templates).size, 300);
});

test("all templates use q placeholder", () => {
  assert.equal(sourceCatalog().every((source) => source.templateUrl.includes("{q}")), true);
});


test("catalog excludes GitHub and YouTube search sources", () => {
  const catalog = sourceCatalog();
  assert.equal(catalog.some((source) => /github|youtube/i.test(`${source.name} ${source.templateUrl}`)), false);
});

test("Bing sources are disabled and lower priority than DDG defaults", () => {
  const catalog = sourceCatalog();
  const bing = catalog.filter((source) => /bing-/i.test(source.name));
  const ddg = catalog.filter((source) => /ddg-/i.test(source.name) && source.defaultEnabled);
  assert.ok(bing.length > 0);
  assert.equal(bing.every((source) => !source.defaultEnabled), true);
  assert.ok(Math.max(...bing.map((source) => source.priority)) < Math.min(...ddg.map((source) => source.priority)));
});

test("catalog includes approved MEGA-focused direct sources", () => {
  const catalog = sourceCatalog();
  for (const id of ["direct_meawfy_api", "direct_meawfy_search", "direct_ofversedrops", "direct_reddit_comments"]) {
    assert.ok(catalog.some((source) => source.id === id));
  }
});
