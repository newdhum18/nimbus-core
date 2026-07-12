import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { dedupeTargets } from "../normalization.js";

const HREF_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi;

function decodeRedirectCandidate(value, baseUrl) {
  const absolute = new URL(value, baseUrl);
  for (const key of ["uddg", "url", "u", "target", "q"]) {
    const candidate = absolute.searchParams.get(key);
    if (candidate && /^https?:\/\//i.test(candidate)) return candidate;
  }
  return absolute.toString();
}

export function parseHtmlSearchResults(html, baseUrl) {
  const targets = [];
  for (const match of String(html || "").matchAll(HREF_RE)) {
    try { targets.push(decodeRedirectCandidate(match[1], baseUrl)); } catch {}
  }
  return dedupeTargets(targets).filter((url) => new URL(url).hostname !== new URL(baseUrl).hostname);
}

export function createHtmlAdapter(id = "generic-html") {
  return Object.freeze({
    id,
    source_type: "html",
    build(input) { return buildSearchUrl(input); },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parseHtmlSearchResults(body, built.url);
      return baseAdapterResult({ adapter: id, request: built.request, requestUrl: built.url, targets });
    }
  });
}
