import test from "node:test";
import assert from "node:assert/strict";
import { APPROVED_NOTE_DOMAINS, sourceCatalog } from "../src/sources/catalog.js";

const expected = ["rentry.co","controlc.com","justpaste.it","telegra.ph","pastemode.com","pastelink.net"];

test("catalog contains only the six approved note sources", () => {
  const catalog = sourceCatalog();
  assert.equal(catalog.length, 6);
  assert.deepEqual(catalog.map((row) => row.domain), expected);
  assert.deepEqual([...APPROVED_NOTE_DOMAINS], expected);
  assert.ok(catalog.every((row) => row.enabled && row.defaultEnabled));
  assert.ok(catalog.every((row) => row.category === "approved-note"));
});

test("approved catalog has unique IDs, domains and discovery templates", () => {
  const catalog = sourceCatalog();
  assert.equal(new Set(catalog.map((row) => row.id)).size, 6);
  assert.equal(new Set(catalog.map((row) => row.domain)).size, 6);
  assert.equal(new Set(catalog.map((row) => row.templateUrl)).size, 6);
});

test("approved source access policy is direct and bounded", () => {
  for (const source of sourceCatalog()) {
    assert.equal(source.access.discovery, "search-index");
    assert.equal(source.access.fetch, "direct-http");
    assert.equal(source.access.extraction, "visible-text+href+html");
    assert.equal(source.access.loginRequired, false);
    assert.equal(source.access.javascriptRequired, false);
    assert.equal(source.access.followIntermediates, false);
  }
});
