import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sourceCatalog, APPROVED_NOTE_DOMAINS } from "../src/sources/catalog.js";
import { supportedAdapterTypes } from "../src/search/adapters/index.js";

test("runtime catalog is exactly the six approved note sources", () => {
  assert.equal(sourceCatalog().length, 6);
  assert.deepEqual(APPROVED_NOTE_DOMAINS, [
    "rentry.co", "controlc.com", "justpaste.it",
    "telegra.ph", "pastemode.com", "pastelink.net"
  ]);
});

test("obsolete extraction adapters are absent from active runtime", async () => {
  assert.deepEqual(supportedAdapterTypes(), ["html", "json", "custom", "rss"]);
  const consumer = await readFile("src/queue/consumer.js", "utf8");
  assert.doesNotMatch(consumer, /pastetoday|ofversedrops|linkvertise|reddit/i);
});

test("source reset removes every non-catalog source", async () => {
  const defaults = await readFile("src/sources/defaults.js", "utf8");
  assert.match(defaults, /filter\(\(id\) => !catalogIds\.has\(id\)\)/);
  assert.doesNotMatch(defaults, /startsWith\("user_"\)/);
});

test("automatic discovery requires manual approval outside approved hosts", async () => {
  const discovery = await readFile("src/sources/discovery.js", "utf8");
  assert.match(discovery, /manual_approval_required/);
  assert.match(discovery, /APPROVED_NOTE_DOMAINS/);
});
