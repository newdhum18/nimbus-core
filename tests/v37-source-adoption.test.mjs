import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { extractMegaFolders, inspectMegaSignals } from "../src/extract/mega.js";
import { sourceCatalog } from "../src/sources/catalog.js";
import { validateMegaFolderUrl } from "../src/results/mega-validation.js";

const canonical = "https://mega.nz/folder/0GVwVIqa#V8kHzjYDW-dB8yxKXz9ulg";
const fixture = (name) => readFile(new URL(`./fixtures/v37/${name}`, import.meta.url), "utf8");

test("research-verified and browser-review sources are registered but disabled", () => {
  const catalog = new Map(sourceCatalog().map((row) => [row.id, row]));
  for (const id of ["v37_ulvis_verified", "v37_pastebin_verified", "v37_pastemode_review"]) {
    assert.equal(catalog.get(id)?.enabled, false);
    assert.equal(catalog.get(id)?.defaultEnabled, false);
    assert.equal(catalog.get(id)?.sourceType, "custom");
  }
});

test("sanitized ULVIS fixture extracts one modern root and ignores legacy persistence", async () => {
  const report = inspectMegaSignals(await fixture("ulvis-public.html"));
  assert.deepEqual(report.accepted.map((x) => x.normalizedUrl), [canonical]);
  assert.ok(report.legacySignals >= 1);
});

test("sanitized Pastebin fixture handles escaped underscore and deterministic dedupe", async () => {
  const links = extractMegaFolders(await fixture("pastebin-public.html"));
  assert.deepEqual(links.map((x) => x.normalizedUrl), [canonical]);
});

test("Pastemode loading placeholder is not falsely accepted", async () => {
  assert.deepEqual(extractMegaFolders(await fixture("pastemode-loading.html")), []);
});

test("V37 MEGA validation is structural-only and performs no destination fetch", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("must not fetch"); };
  try {
    const verdict = await validateMegaFolderUrl(canonical);
    assert.equal(verdict.status, "structurally_valid");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("consolidated schema accepts final V37 link validation columns and states", async () => {
  const schema = await readFile(new URL("../src/db/schema.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(schema);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .run("run_v37", "keyword", "fixture", "completed", now, now);
  db.prepare(`INSERT INTO links(id,run_id,url,normalized_url,link_type,has_key,validation_status,is_complete,discovered_at,validation_error,validated_at,validation_http_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run("link_v37", "run_v37", canonical, canonical, "folder", 1, "structurally_valid", 1, now, null, now, null);
  assert.equal(db.prepare("SELECT validation_status FROM links WHERE id='link_v37'").get().validation_status, "structurally_valid");
  db.close();
});
