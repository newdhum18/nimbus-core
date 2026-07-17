import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchRequest, validateAdapterResult } from "../src/search/contracts/adapter.js";
import { buildSearchUrl } from "../src/search/adapters/template.js";
import { parseHtmlSearchResults } from "../src/search/adapters/html.js";
import { parseRssSearchResults } from "../src/search/adapters/rss.js";
import { adapterForSource, supportedAdapterTypes } from "../src/search/adapters/index.js";
import { normalizeTargetUrl } from "../src/search/normalization.js";
import { decodeSearchTarget, contentVariants, extractHttpTargets } from "../src/search/target-decoder.js";

const template = "https://search.example/?q={q}";

test("keyword adapter request is normalized", () => {
  const request = normalizeSearchRequest({ mode: "keyword", query: "  alpha   beta ", source_id: "s1", template_url: template });
  assert.equal(request.query, "alpha beta");
  assert.equal(request.schema, "nimbus.search-adapter.v1");
});

test("autoscan adapter builds deterministic URL", () => {
  const built = buildSearchUrl({ mode: "autoscan", round: 1, source_id: "s1", template_url: template });
  assert.equal(built.effective_query, "archive");
  assert.match(built.url, /archive/);
});

test("HTML adapter extracts and deduplicates external targets", () => {
  const html = '<a href="https://target.example/a?utm_source=x">A</a><a href="/redirect?uddg=https%3A%2F%2Ftarget.example%2Fa">B</a><a href="https://search.example/internal">I</a>';
  assert.deepEqual(parseHtmlSearchResults(html, "https://search.example/?q=x"), ["https://target.example/a"]);
});

test("RSS adapter extracts item links and excludes engine self-link", () => {
  const xml = '<rss><channel><link>https://search.example/</link><item><link><![CDATA[https://one.example/x]]></link></item><item><link>https://two.example/y</link></item></channel></rss>';
  assert.deepEqual(parseRssSearchResults(xml, "https://search.example/?q=x"), ["https://one.example/x", "https://two.example/y"]);
});

test("adapter registry supports executable source types", () => {
  assert.deepEqual(supportedAdapterTypes(), ["html", "json", "custom", "rss"]);
  assert.equal(adapterForSource({ source_type: "html" }).source_type, "html");
  assert.equal(adapterForSource({ source_type: "json" }).id, "generic-html");
  assert.equal(adapterForSource({ source_type: "custom" }).id, "direct-source-crawler-v1");
  assert.throws(() => adapterForSource({ source_type: "binary" }), /unsupported_search_adapter:binary/);
});

test("target normalization removes fragments and tracking", () => {
  assert.equal(normalizeTargetUrl("https://example.com/a?utm_source=x&keep=1#fragment"), "https://example.com/a?keep=1");
});

test("adapter result contract is strict", () => {
  assert.throws(() => validateAdapterResult({}));
  assert.doesNotThrow(() => validateAdapterResult({ schema: "nimbus.search-adapter.v1", targets: [], warnings: [] }));
});


test("target decoder handles Google, DuckDuckGo and Bing wrappers", () => {
  const target = "https://rentry.co/example";
  assert.equal(decodeSearchTarget(`/url?q=${encodeURIComponent(target)}`, "https://www.google.com/search?q=x"), target);
  assert.equal(decodeSearchTarget(`/l/?uddg=${encodeURIComponent(target)}`, "https://duckduckgo.com/html/?q=x"), target);
  const encoded = "a1" + Buffer.from(target).toString("base64url");
  assert.equal(decodeSearchTarget(`/ck/a?u=${encoded}`, "https://www.bing.com/search?q=x"), target);
});

test("content variants prefer raw Rentry and keep approved note pages direct", () => {
  assert.equal(contentVariants("https://rentry.co/demo")[0], "https://rentry.co/raw/demo");
  assert.equal(contentVariants("https://justpaste.it/demo/")[0], "https://justpaste.it/demo");
  assert.equal(contentVariants("https://pastelink.net/demo/")[0], "https://pastelink.net/demo");
});

test("HTTP target extraction reads anchors and JSON text", () => {
  const text = '<a href="/url?q=https%3A%2F%2Frentry.co%2Fdemo">x</a>{"url":"https://pastelink.net/AbC123"}';
  const targets = extractHttpTargets(text, "https://www.google.com/search?q=x");
  assert.ok(targets.includes("https://rentry.co/raw/demo"));
  assert.ok(targets.includes("https://pastelink.net/AbC123"));
});
