import test from "node:test";
import assert from "node:assert/strict";
import { contentVariants, pastetodayContentVariants } from "../src/search/target-decoder.js";
import { createPastetodayAdapter, inspectPastetodayDocument, parsePastetodaySearchResults } from "../src/search/adapters/pastetoday.js";

test("PasteToday page expands to canonical and embed surfaces", () => {
  assert.deepEqual(pastetodayContentVariants("https://pastetoday.com/wic5vif7en"), [
    "https://pastetoday.com/wic5vif7en",
    "https://pastetoday.com/embed/wic5vif7en"
  ]);
  assert.ok(contentVariants("https://pastetoday.com/embed/wic5vif7en").includes("https://pastetoday.com/wic5vif7en"));
});

test("PasteToday adapter keeps only PasteToday note pages", () => {
  const html = `
    <a href="https://pastetoday.com/wic5vif7en">note</a>
    <a href="https://example.com/nope">external</a>`;
  const targets = parsePastetodaySearchResults(html, "https://lite.duckduckgo.com/lite/?q=test");
  assert.ok(targets.includes("https://pastetoday.com/wic5vif7en"));
  assert.ok(targets.includes("https://pastetoday.com/embed/wic5vif7en"));
  assert.equal(targets.some((value) => value.includes("example.com")), false);
});

test("PasteToday document inspection identifies embed and dynamic markers", () => {
  const html = `<div>Loading Please wait...</div><iframe src="/embed/wic5vif7en"></iframe>`;
  const result = inspectPastetodayDocument(html, "https://pastetoday.com/wic5vif7en");
  assert.equal(result.dynamic, true);
  assert.equal(result.hasEmbed, true);
  assert.ok(result.targets.includes("https://pastetoday.com/embed/wic5vif7en"));
});

test("PasteToday source adapter builds and parses a real site query", () => {
  const adapter = createPastetodayAdapter();
  const input = {
    source_id: "pastetoday_direct",
    mode: "keyword",
    round: 0,
    query: "demo",
    template_url: "https://lite.duckduckgo.com/lite/?q=site%3Apastetoday.com%20{q}%20%22mega.nz%2Ffolder%22"
  };
  const result = adapter.parse({ input, body: `<a href="https://pastetoday.com/demo123">demo</a>` });
  assert.equal(result.adapter, "pastetoday-note-v2");
  assert.ok(result.targets.includes("https://pastetoday.com/embed/demo123"));
});

test("PasteToday inspection extracts public script endpoints and MEGA links", () => {
  const html = `
    <script>
      window.note = { endpoint: "/embed/wic5vif7en", content: "https:\\/\\/mega.nz\\/folder\\/0GVwVIqa#V8kHzjYDW-dB8yxKXz9ulg" };
    </script>`;
  const result = inspectPastetodayDocument(html, "https://pastetoday.com/wic5vif7en");
  assert.equal(result.megaLinks.length, 1);
  assert.equal(result.reason, "mega_extracted");
  assert.ok(result.targets.includes("https://pastetoday.com/embed/wic5vif7en"));
});

test("PasteToday unresolved dynamic page produces explicit diagnostics", () => {
  const result = inspectPastetodayDocument(
    `<div>Loading Please wait...</div><script>fetch('/api/content/wic5vif7en')</script>`,
    "https://pastetoday.com/wic5vif7en"
  );
  assert.equal(result.dynamic, true);
  assert.equal(result.reason, "dynamic_content_without_mega");
  assert.ok(result.endpoints.some((value) => value.includes("/api/content/wic5vif7en")));
});

test("catalog separates direct PasteToday validation from external discovery", async () => {
  const { sourceCatalog } = await import("../src/sources/catalog.js");
  const catalog = sourceCatalog();
  const direct = catalog.find((row) => row.id === "pastetoday_direct");
  const discovery = catalog.find((row) => row.id === "pastetoday_search");
  assert.equal(direct?.sourceType, "pastetoday");
  assert.equal(direct?.templateUrl, "https://pastetoday.com/wic5vif7en");
  assert.equal(discovery?.sourceType, "pastetoday");
  assert.match(discovery?.templateUrl || "", /duckduckgo/i);
  assert.doesNotMatch(direct?.templateUrl || "", /duckduckgo|bing|google/i);
});
