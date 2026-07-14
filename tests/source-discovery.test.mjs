import test from "node:test";
import assert from "node:assert/strict";
import { discoverCandidateUrls, candidateId, normalizeCandidateUrl } from "../src/sources/discovery.js";

test("source discovery extracts public candidates and blocks search/MEGA hosts", () => {
  const html = `
    <a href="https://example.org/public-index">Index</a>
    <a href="https://mega.nz/folder/abc#key">MEGA</a>
    <a href="https://duckduckgo.com/?q=x">Search</a>
    <script>const api='https://catalog.example.net/api/list.json';</script>
  `;
  const urls = discoverCandidateUrls(html, "https://seed.test/page");
  assert.ok(urls.includes("https://example.org/public-index"));
  assert.ok(urls.includes("https://catalog.example.net/api/list.json"));
  assert.equal(urls.some((url) => /mega\.nz|duckduckgo/.test(url)), false);
});

test("candidate IDs are stable and tracking parameters are removed", () => {
  const a = normalizeCandidateUrl("https://example.org/page?utm_source=x&id=1#frag");
  const b = normalizeCandidateUrl("https://example.org/page?id=1");
  assert.equal(a, b);
  assert.equal(candidateId(a), candidateId(b));
});

test("source discovery decodes wrapped search-result targets", () => {
  const html = `
    <a href="//duckduckgo.com/l/?uddg=${encodeURIComponent("https://example-paste.test/post/42")}">DDG</a>
    <a href="https://www.google.com/url?q=${encodeURIComponent("https://example-forum.test/thread/9")}">Google</a>`;
  const urls = discoverCandidateUrls(html, "https://html.duckduckgo.com/html/?q=mega");
  assert.ok(urls.includes("https://example-paste.test/post/42"));
  assert.ok(urls.includes("https://example-forum.test/thread/9"));
});
