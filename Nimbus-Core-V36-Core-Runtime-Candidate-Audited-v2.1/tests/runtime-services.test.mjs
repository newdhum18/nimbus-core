import test from "node:test";
import assert from "node:assert/strict";
import { positiveInt, nonEmptyString } from "../src/api/validation.js";
import { resultsToCsv } from "../src/results/service.js";

 test("positiveInt accepts boundaries and defaults", () => {
  assert.equal(positiveInt(null, { name: "limit", min: 1, max: 300, fallback: 50 }), 50);
  assert.equal(positiveInt("300", { name: "limit", min: 1, max: 300 }), 300);
});

test("positiveInt rejects invalid values", () => {
  assert.throws(() => positiveInt("0", { name: "limit", min: 1, max: 300 }));
  assert.throws(() => positiveInt("3.5", { name: "limit", min: 1, max: 300 }));
});

test("nonEmptyString normalizes keyword", () => {
  assert.equal(nonEmptyString("  example  ", { name: "keyword" }), "example");
  assert.throws(() => nonEmptyString("   ", { name: "keyword" }));
});

test("CSV export escapes commas, quotes and newlines", () => {
  const csv = resultsToCsv([{
    url: "https://mega.nz/folder/ABCDEFGH#abcdefghijklmnopqrstuv",
    link_type: "folder",
    validation_status: "valid",
    is_complete: 1,
    source_name: 'name, "quoted"',
    source_page_url: "https://example.com/a",
    discovered_at: "2026-07-11T00:00:00.000Z",
    checked_at: null
  }]);
  assert.match(csv, /"name, ""quoted"""/);
});
