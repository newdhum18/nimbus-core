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
