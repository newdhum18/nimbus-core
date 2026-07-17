import test from "node:test";
import assert from "node:assert/strict";
import { sourceCatalog } from "../src/sources/catalog.js";
import { contentVariants } from "../src/search/target-decoder.js";

test("V37.1 adopts exactly the approved note domains", () => {
  assert.deepEqual(sourceCatalog().map((row) => row.domain), [
    "rentry.co", "controlc.com", "justpaste.it", "telegra.ph", "pastemode.com", "pastelink.net"
  ]);
});

test("approved direct pages have deterministic content variants", () => {
  assert.equal(contentVariants("https://rentry.co/demo")[0], "https://rentry.co/raw/demo");
  for (const url of [
    "https://controlc.com/abc123",
    "https://justpaste.it/abc12",
    "https://telegra.ph/example-01-01",
    "https://pastemode.com/abc123",
    "https://pastelink.net/abc123"
  ]) assert.equal(contentVariants(url)[0], url);
});
