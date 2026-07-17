import test from "node:test";
import assert from "node:assert/strict";
import { classifyMegaFolder, extractMegaFolders, inspectMegaSignals } from "../src/extract/mega.js";
import { decodeHtmlEntities, decodeRepeated, decodeUnicodeEscapes, normalizeMegaUrl } from "../src/extract/normalize.js";

const canonical = "https://mega.nz/folder/0GVwVIqa#V8kHzjYDW-dB8yxKXz9ulg";

test("V37 decodes decimal and hexadecimal HTML entities", () => {
  assert.equal(decodeHtmlEntities("&#104;&#116;&#116;&#112;&#115;&#58;&#47;&#47;"), "https://");
  assert.equal(decodeHtmlEntities("&#x23;"), "#");
});

test("V37 decodes bounded unicode, percent and escaped characters", () => {
  const escaped = "https\\u003a\\u002f\\u002fmega.nz\\u002ffolder\\u002f0GVwVIqa\\u0023V8kHzjYDW-dB8yxKXz9ulg";
  assert.equal(decodeUnicodeEscapes(escaped), canonical);
  assert.equal(decodeRepeated(encodeURIComponent(encodeURIComponent(canonical))), canonical);
  assert.equal(decodeRepeated(canonical.replace("_", "\\_")), canonical);
});

test("V37 canonicalizes approved MEGA hosts while preserving casing", () => {
  assert.equal(normalizeMegaUrl(canonical.replace("mega.nz", "www.mega.nz")), canonical);
  assert.equal(normalizeMegaUrl(canonical.replace("mega.nz", "mega.io")), canonical);
});

test("V37 accepts modern folder only and rejects legacy, file and missing-key routes", () => {
  assert.equal(classifyMegaFolder(canonical).valid, true);
  assert.equal(classifyMegaFolder("https://mega.nz/file/0GVwVIqa#V8kHzjYDW-dB8yxKXz9ulg").type, "file");
  assert.equal(classifyMegaFolder("https://mega.nz/folder/0GVwVIqa").type, "missing_key");
  assert.equal(classifyMegaFolder("https://mega.nz/#F!0GVwVIqa!V8kHzjYDW-dB8yxKXz9ulg").valid, false);
});

test("V37 strips a verified subfolder suffix from the persisted root folder candidate", () => {
  const link = `${canonical}/folder/fQ8hBZ4B`;
  const result = classifyMegaFolder(link);
  assert.equal(result.valid, true);
  assert.equal(result.normalizedUrl, canonical);
  assert.equal(result.subfolderId, "fQ8hBZ4B");
});

test("V37 extracts visible text, JSON, escaped slash, percent, unicode and base64 variants deterministically", () => {
  const encoded = Buffer.from(`prefix ${canonical} suffix`).toString("base64url");
  const inputs = [
    canonical,
    JSON.stringify({ url: canonical.replaceAll("/", "\\/") }),
    encodeURIComponent(canonical),
    canonical.replace("://", "\\u003a\\u002f\\u002f").replace("#", "\\u0023"),
    encoded,
    canonical.replace("folder", "<span>folder</span>")
  ].join("\n");
  assert.deepEqual(extractMegaFolders(inputs).map((item) => item.normalizedUrl), [canonical]);
});

test("V37 reports but does not persist legacy and file signals", () => {
  const report = inspectMegaSignals(`${canonical}\nhttps://mega.nz/file/0GVwVIqa#V8kHzjYDW-dB8yxKXz9ulg\nhttps://mega.nz/#F!0GVwVIqa!V8kHzjYDW-dB8yxKXz9ulg`);
  assert.equal(report.accepted.length, 1);
  assert.ok(report.fileSignals >= 1);
  assert.ok(report.legacySignals >= 1);
});

test("V37 extraction is idempotent", () => {
  const once = extractMegaFolders(canonical)[0].normalizedUrl;
  const twice = extractMegaFolders(once)[0].normalizedUrl;
  assert.equal(twice, once);
});
